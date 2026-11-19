import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const script = fileURLToPath(new URL('./audit-licenses.mjs', import.meta.url));
const api = await import('./audit-licenses.mjs').catch(() => null);
const policy = {version: 1, allowedLicenses: ['MIT', 'Apache-2.0', 'BSD-3-Clause'], exceptions: []};
const inventory = (license = 'MIT') => ({lockfileVersion: 3, packages: {
  '': {license: 'PRIVATE'}, 'node_modules/example': {version: '1.2.3', license},
}});
const audit = (lock = inventory(), config = policy) => api.auditLicenses(JSON.stringify(lock), config);
const feature = (name, fn) => test(name, {skip: !api}, fn);

test('auditor module is available', () => assert.ok(api, 'license auditor implementation is missing'));

feature('includes dev, optional and nested scoped packages but excludes the root', () => {
  const lock = inventory();
  lock.packages['node_modules/outer/node_modules/@scope/inner'] = {version: '2.0.0', license: 'MPL-2.0', optional: true, dev: true};
  const report = audit(lock);
  assert.deepEqual(report.counts, {total: 2, approved: 1, reviewNeeded: 1});
  assert.equal(report.findings[0].package, '@scope/inner');
  assert.deepEqual(report.findings[0].paths, ['node_modules/outer/node_modules/@scope/inner']);
});

for (const [expression, approved] of [
  ['MIT', true], ['LGPL-3.0-or-later', false], ['BSD', false], ['MIT OR MPL-2.0', true],
  ['MIT AND MPL-2.0', false], ['MIT OR Apache-2.0 AND MPL-2.0', true],
  ['(MIT OR Apache-2.0) AND MPL-2.0', false], ['MIT AND (MPL-2.0 OR Apache-2.0)', true],
  ['(MIT)', true], ['MIT AND Apache-2.0', true],
  ['MIT WITH Classpath-exception-2.0', false], ['MIT OR (Apache-2.0 WITH LLVM-exception)', false],
  ['MIT garbage', false], ['MIT OR', false], ['MIT OR OR Apache-2.0', false], ['MIT AND', false],
  ['MIT OR ()', false], ['(MIT', false], ['MIT)', false], ['MIT || Apache-2.0', false],
  ['', false], [null, false], [undefined, false], [['MIT'], false], [{type: 'MIT'}, false],
]) feature(`evaluates declared license ${JSON.stringify(expression)}`, () => {
  const lock = inventory();
  lock.packages['node_modules/example'].license = expression;
  assert.equal(audit(lock).counts.approved === 1, approved);
});

feature('explains unresolved metadata and WITH exceptions without approving them', () => {
  assert.match(audit(inventory(null)).findings[0].reasons.join(' '), /missing|metadata/i);
  assert.match(audit(inventory('MIT WITH Classpath-exception-2.0')).findings[0].reasons.join(' '), /WITH/);
  assert.match(audit(inventory('MIT OR')).findings[0].reasons.join(' '), /malformed/i);
});

feature('rejects malformed or unavailable inventory', () => {
  for (const value of [null, [], {}, {lockfileVersion: 1, packages: {}}, {lockfileVersion: 3, packages: []},
    {lockfileVersion: 3, packages: {}}, {lockfileVersion: 3, packages: {'': {}, 'node_modules/x': {license: 'MIT'}}},
    {lockfileVersion: 3, packages: {'': {}, '../node_modules/x': {version: '1.0.0', license: 'MIT'}}},
  ]) assert.throws(() => audit(value), /lock|inventory|version|path/i);
  assert.throws(() => api.auditLicenses('{', policy), /lock/i);
  assert.equal(audit({...inventory(), lockfileVersion: 2}).counts.approved, 1);
});

feature('rejects malformed and broad policy entries', () => {
  for (const value of [null, [], {}, {...policy, version: 2}, {...policy, allowedLicenses: ['BSD*']},
    {...policy, allowedLicenses: ['MIT OR MPL-2.0']}, {...policy, allowedLicenses: ['MIT', 'MIT']},
    {...policy, extra: true}, {...policy, exceptions: [{}]},
  ]) assert.throws(() => audit(inventory(), value), /policy/i);
});

feature('exceptions match exact package, version and expression and never resolve missing metadata', () => {
  const exception = {package: 'example', version: '1.2.3', expression: 'MPL-2.0', reason: 'Reviewed use', source: 'review record 123', reviewer: 'Review owner'};
  const config = {...policy, exceptions: [exception]};
  assert.equal(audit(inventory('MPL-2.0'), config).counts.approved, 1);
  const changedVersion = inventory('MPL-2.0'); changedVersion.packages['node_modules/example'].version = '1.2.4';
  assert.equal(audit(changedVersion, config).counts.reviewNeeded, 1);
  const changedName = inventory('MPL-2.0'); changedName.packages['node_modules/other'] = changedName.packages['node_modules/example']; delete changedName.packages['node_modules/example'];
  assert.equal(audit(changedName, config).counts.reviewNeeded, 1);
  assert.equal(audit(inventory('(MPL-2.0)'), config).counts.reviewNeeded, 1);
  assert.equal(audit(inventory(null), config).counts.reviewNeeded, 1);
  for (const patch of [{package: '*'}, {version: '^1.2.3'}, {version: '*'}, {expression: '*'}, {reason: ''}, {source: ''}, {reviewer: ''}, {extra: true}]) {
    assert.throws(() => audit(inventory(), {...policy, exceptions: [{...exception, ...patch}]}), /policy/i);
  }
  assert.throws(() => audit(inventory(), {...policy, exceptions: [exception, exception]}), /policy/i);
});

feature('uses the declared package identity for aliases when matching exceptions', () => {
  const lock = inventory('MPL-2.0');
  lock.packages['node_modules/example'].name = '@actual/package';
  const config = {...policy, exceptions: [{package: 'example', version: '1.2.3', expression: 'MPL-2.0', reason: 'Reviewed use', source: 'record 123', reviewer: 'Owner'}]};
  const report = audit(lock, config);
  assert.equal(report.counts.reviewNeeded, 1);
  assert.equal(report.findings[0].package, '@actual/package');
  lock.packages['node_modules/example'].name = '*';
  assert.throws(() => audit(lock), /inventory|name/i);
});

feature('shipped policy approves only the conservative licenses and no exceptions', () => {
  const config = JSON.parse(readFileSync(new URL('../docs/license-allowlist.json', import.meta.url), 'utf8'));
  for (const license of ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', '0BSD', 'CC0-1.0', 'Unlicense']) {
    assert.equal(audit(inventory(license), config).counts.approved, 1);
  }
  for (const license of ['BSD', 'LGPL-3.0-or-later', 'MPL-2.0', 'CC-BY-4.0', 'BlueOak-1.0.0']) {
    assert.equal(audit(inventory(license), config).counts.reviewNeeded, 1);
  }
  assert.deepEqual(config.exceptions, []);
});

feature('groups duplicate package findings, sorts paths and reports deterministically', () => {
  const lock = inventory('MPL-2.0');
  lock.packages['node_modules/z/node_modules/example'] = {...lock.packages['node_modules/example']};
  const report = audit(lock);
  assert.deepEqual(report.counts, {total: 2, approved: 0, reviewNeeded: 2});
  assert.equal(report.findings.length, 1);
  assert.deepEqual(report.findings[0].paths, ['node_modules/example', 'node_modules/z/node_modules/example']);
  assert.deepEqual(report, audit(lock));
  assert.match(report.lockfileSha256, /^[a-f0-9]{64}$/);
});

feature('CLI exits 0/1/2, omits resolved credentials and has no import side effects or writes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'license-audit-'));
  const lockfile = join(dir, 'lock.json'); const config = join(dir, 'policy.json');
  const run = (...args) => spawnSync(process.execPath, [script, '--lockfile', lockfile, '--policy', config, ...args], {encoding: 'utf8', cwd: dir});
  try {
    writeFileSync(config, JSON.stringify(policy));
    const lock = inventory();
    lock.packages['node_modules/example'].resolved = 'https://fixture-user:fixture-password@registry.invalid/private.tgz?token=fixture-token';
    writeFileSync(lockfile, JSON.stringify(lock));
    assert.equal(run().status, 0);
    const first = run('--json'); const second = run('--json');
    assert.equal(first.status, 0); assert.equal(first.stdout, second.stdout);
    assert.doesNotMatch(first.stdout + first.stderr, /fixture-user|fixture-password|fixture-token|registry\.invalid|resolved/);
    lock.packages['node_modules/example'].license = 'MPL-2.0';
    writeFileSync(lockfile, JSON.stringify(lock));
    assert.equal(run('--json').status, 1);
    assert.match(run().stdout, /example@1\.2\.3/);
    const before = readFileSync(lockfile, 'utf8'); const files = readdirSync(dir);
    run('--json'); assert.equal(readFileSync(lockfile, 'utf8'), before); assert.deepEqual(readdirSync(dir), files);
    writeFileSync(lockfile, '{"secret":"fixture-password"');
    const badLock = run('--json'); assert.equal(badLock.status, 2);
    assert.doesNotMatch(badLock.stdout + badLock.stderr, /fixture-password/);
    writeFileSync(lockfile, JSON.stringify(inventory())); writeFileSync(config, '{');
    assert.equal(run().status, 2);
    rmSync(lockfile); assert.equal(run().status, 2);
    assert.equal(run('--unknown').status, 2);
    const imported = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(new URL('./audit-licenses.mjs', import.meta.url).href)})`], {encoding: 'utf8', cwd: dir});
    assert.equal(imported.status, 0); assert.equal(imported.stdout + imported.stderr, '');
  } finally { rmSync(dir, {recursive: true, force: true}); }
});
