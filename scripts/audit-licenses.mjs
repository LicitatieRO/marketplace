import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const identifier = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9.+-]*$/.test(value) && !['AND', 'OR', 'WITH'].includes(value);
const packageName = value => typeof value === 'string' && /^(?:@[a-z0-9._-]+\/)?[a-z0-9][a-z0-9._-]*$/i.test(value);
const exactVersion = value => typeof value === 'string' && /^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?(?:\+[A-Za-z0-9.-]+)?$/.test(value);
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const exactKeys = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

// A deliberately bounded expression grammar, not an SPDX registry validator.
// Parse the whole expression before evaluating OR; malformed branches cannot hide.
function parseExpression(expression) {
  if (expression.length > 4096) throw new Error('Malformed license expression (too long)');
  const tokens = expression.match(/[A-Za-z0-9][A-Za-z0-9.+-]*|[()]|[^\s]/g) ?? [];
  if (tokens.includes('WITH')) throw new Error('WITH license exceptions require manual review; unsupported by this parser');
  let cursor = 0;
  let depth = 0;
  function primary() {
    const token = tokens[cursor++];
    if (token === '(') {
      if (++depth > 64) throw new Error('Malformed license expression (too deeply nested)');
      const node = or();
      if (tokens[cursor++] !== ')') throw new Error('Malformed license expression');
      depth--;
      return node;
    }
    if (!identifier(token)) throw new Error('Malformed license expression');
    return {id: token};
  }
  function and() {
    let node = primary();
    while (tokens[cursor] === 'AND') { cursor++; node = {and: [node, primary()]}; }
    return node;
  }
  function or() {
    let node = and();
    while (tokens[cursor] === 'OR') { cursor++; node = {or: [node, and()]}; }
    return node;
  }
  const tree = or();
  if (cursor !== tokens.length) throw new Error('Malformed license expression');
  return tree;
}

function evaluate(tree, allowed) {
  if (tree.id) return allowed.has(tree.id);
  if (tree.and) return tree.and.every(node => evaluate(node, allowed));
  return tree.or.some(node => evaluate(node, allowed));
}

function outsidePolicy(tree, allowed) {
  if (tree.id) return allowed.has(tree.id) ? [] : [tree.id];
  return (tree.and ?? tree.or).flatMap(node => outsidePolicy(node, allowed));
}

function validatePolicy(policy) {
  if (!exactKeys(policy, ['version', 'allowedLicenses', 'exceptions']) || policy.version !== 1 ||
      !Array.isArray(policy.allowedLicenses) || !policy.allowedLicenses.length ||
      !policy.allowedLicenses.every(identifier) || new Set(policy.allowedLicenses).size !== policy.allowedLicenses.length ||
      !Array.isArray(policy.exceptions)) throw new Error('Invalid license policy structure or allowed identifiers');
  const seen = new Set();
  for (const entry of policy.exceptions) {
    if (!exactKeys(entry, ['package', 'version', 'expression', 'reason', 'source', 'reviewer']) ||
        !packageName(entry.package) || !exactVersion(entry.version) || !nonempty(entry.expression) ||
        !nonempty(entry.reason) || !nonempty(entry.source) || !nonempty(entry.reviewer)) {
      throw new Error('Invalid license policy exception; exact identity and review attribution required');
    }
    try { parseExpression(entry.expression); } catch { throw new Error('Invalid license policy exception expression'); }
    const key = JSON.stringify([entry.package, entry.version, entry.expression]);
    if (seen.has(key)) throw new Error('Duplicate license policy exception');
    seen.add(key);
  }
  return new Set(policy.allowedLicenses);
}

function nameFromPath(path) {
  const segments = path.split('/');
  let name;
  for (let i = 0; i < segments.length;) {
    if (segments[i++] !== 'node_modules') throw new Error('Unsupported lock inventory package path');
    name = segments[i++];
    if (name?.startsWith('@')) name += `/${segments[i++] ?? ''}`;
    if (!packageName(name)) throw new Error('Invalid lock inventory package path');
  }
  return name;
}

export function auditLicenses(lockfileText, policy) {
  const allowed = validatePolicy(policy);
  let lock;
  try { lock = JSON.parse(lockfileText); } catch { throw new Error('Invalid lockfile JSON'); }
  if (!object(lock) || ![2, 3].includes(lock.lockfileVersion) || !object(lock.packages) || !object(lock.packages[''])) {
    throw new Error('Lockfile v2/v3 packages inventory with root entry required');
  }
  const findings = new Map();
  const counts = {total: 0, approved: 0, reviewNeeded: 0};
  for (const path of Object.keys(lock.packages).sort(compare)) {
    if (path === '') continue;
    const installedName = nameFromPath(path);
    const entry = lock.packages[path];
    if (!object(entry) || !nonempty(entry.version)) throw new Error('Invalid lock inventory entry or missing version');
    if (Object.hasOwn(entry, 'name') && !packageName(entry.name)) throw new Error('Invalid lock inventory package name');
    const name = entry.name ?? installedName;
    // Versions are displayed; reject control characters, URLs and range-like metadata.
    if (!exactVersion(entry.version)) throw new Error('Lock inventory requires an exact package version');
    const expression = typeof entry.license === 'string' ? entry.license : null;
    const reasons = [];
    let approved = false;
    if (!nonempty(expression)) {
      reasons.push('Missing or ambiguous license metadata; manual review required');
    } else {
      let tree;
      try { tree = parseExpression(expression); } catch (error) { reasons.push(error.message); }
      if (tree) {
        approved = evaluate(tree, allowed) || policy.exceptions.some(exception =>
          exception.package === name && exception.version === entry.version && exception.expression === expression);
        if (!approved) reasons.push(`Outside allowed policy: ${[...new Set(outsidePolicy(tree, allowed))].sort(compare).join(', ')}`);
      }
    }
    counts.total++;
    if (approved) { counts.approved++; continue; }
    counts.reviewNeeded++;
    const key = JSON.stringify([name, entry.version, expression, reasons]);
    if (!findings.has(key)) findings.set(key, {package: name, version: entry.version, declaredLicense: expression, paths: [], reasons});
    findings.get(key).paths.push(path);
  }
  return {
    formatVersion: 1,
    lockfileSha256: createHash('sha256').update(lockfileText).digest('hex'),
    counts,
    findings: [...findings.values()].sort((a, b) => compare(JSON.stringify([a.package, a.version, a.declaredLicense]), JSON.stringify([b.package, b.version, b.declaredLicense]))),
  };
}

function readInput(path, label) {
  try { return readFileSync(path, 'utf8'); } catch { throw new Error(`Cannot read ${label}`); }
}

function main(args) {
  let lockfile = new URL('../package-lock.json', import.meta.url);
  let policyPath = new URL('../docs/license-allowlist.json', import.meta.url);
  let json = false;
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (seen.has(arg)) throw new Error('Duplicate CLI option');
    seen.add(arg);
    if (arg === '--json') { json = true; continue; }
    if (!['--lockfile', '--policy'].includes(arg) || !args[i + 1] || args[i + 1].startsWith('--')) {
      throw new Error('Usage: node scripts/audit-licenses.mjs [--json] [--lockfile PATH] [--policy PATH]');
    }
    if (arg === '--lockfile') lockfile = args[++i];
    else policyPath = args[++i];
  }
  let policy;
  try { policy = JSON.parse(readInput(policyPath, 'license policy')); } catch { throw new Error('Cannot read valid license policy JSON'); }
  const report = auditLicenses(readInput(lockfile, 'lockfile'), policy);
  if (json) console.log(JSON.stringify(report, null, 2));
  else {
    const {total, approved, reviewNeeded} = report.counts;
    console.log(`License inventory: ${total} dependency entries; ${approved} approved; ${reviewNeeded} need review.`);
    for (const finding of report.findings) {
      console.log(`${finding.package}@${finding.version}: ${finding.reasons.join('; ')} [${finding.paths.join(', ')}]`);
    }
  }
  return report.counts.reviewNeeded ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) { console.error(`License audit input/configuration error: ${error.message}`); process.exitCode = 2; }
}
