import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bucketPath,
  classifyChangedFiles,
  shouldForceFullSuite,
  formatGithubOutput,
  pathsFromNameStatus,
} from './classify-ci.mjs';

test('bucketPath recognizes documentation paths', () => {
  assert.equal(bucketPath('docs/ci-policy.md'), 'docs');
  assert.equal(bucketPath('README.md'), 'docs');
  assert.equal(bucketPath('.github/pull_request_template.md'), 'docs');
  assert.equal(bucketPath('LICENSE'), 'docs');
});

test('markdown under database or workflow paths is not docs-only', () => {
  assert.equal(bucketPath('supabase/README.md'), 'db_security');
  assert.equal(bucketPath('supabase/migrations/notes.md'), 'db_security');
  assert.equal(bucketPath('.github/workflows/ci-notes.md'), 'deps_workflow');
});

test('bucketPath prioritizes database and security paths', () => {
  assert.equal(bucketPath('supabase/migrations/001.sql'), 'db_security');
  assert.equal(bucketPath('src/app/api/health/route.ts'), 'db_security');
  assert.equal(bucketPath('src/lib/security.ts'), 'db_security');
  assert.equal(bucketPath('src/proxy.ts'), 'db_security');
  assert.equal(bucketPath('scripts/test-concurrency.mjs'), 'db_security');
});

test('bucketPath routes workflows and dependencies to deps_workflow', () => {
  assert.equal(bucketPath('package.json'), 'deps_workflow');
  assert.equal(bucketPath('package-lock.json'), 'deps_workflow');
  assert.equal(bucketPath('.github/workflows/ci.yml'), 'deps_workflow');
  assert.equal(bucketPath('scripts/deploy.mjs'), 'deps_workflow');
});

test('bucketPath routes application paths', () => {
  assert.equal(bucketPath('src/components/Button.tsx'), 'app');
  assert.equal(bucketPath('tests/unit/foo.test.ts'), 'app');
  assert.equal(bucketPath('public/icon.svg'), 'app');
  assert.equal(bucketPath('next.config.ts'), 'app');
  assert.equal(bucketPath('eslint.config.mjs'), 'app');
});

test('bucketPath marks unclassified infrastructure', () => {
  assert.equal(bucketPath('vercel.json'), 'unknown');
  assert.equal(bucketPath('.github/dependabot.yml'), 'unknown');
});

test('classifyChangedFiles selects docs-only tier', () => {
  const result = classifyChangedFiles(['docs/foo.md', 'README.md']);
  assert.equal(result.qualityMode, 'minimal');
  assert.equal(result.backendMode, 'skip');
  assert.equal(result.tier, 'docs-only');
});

test('classifyChangedFiles selects app-only backend tier', () => {
  const result = classifyChangedFiles(['src/app/page.tsx', 'tests/unit/a.test.ts']);
  assert.equal(result.qualityMode, 'full');
  assert.equal(result.backendMode, 'e2e');
  assert.equal(result.tier, 'app-only');
});

test('classifyChangedFiles forces full suite for database touches', () => {
  const result = classifyChangedFiles(['src/components/x.tsx', 'supabase/migrations/1.sql']);
  assert.equal(result.backendMode, 'full');
  assert.equal(result.tier, 'full');
});

test('classifyChangedFiles forces full suite for workflow edits', () => {
  const result = classifyChangedFiles(['.github/workflows/ci.yml']);
  assert.equal(result.tier, 'full');
});

test('classifyChangedFiles forces full suite for unknown paths', () => {
  const result = classifyChangedFiles(['Dockerfile']);
  assert.equal(result.tier, 'full');
});

test('shouldForceFullSuite on main, tags, and workflow_dispatch', () => {
  assert.equal(shouldForceFullSuite('push', { ref: 'refs/heads/main' }), true);
  assert.equal(shouldForceFullSuite('push', { ref: 'refs/heads/release/1.0' }), true);
  assert.equal(shouldForceFullSuite('push', { ref: 'refs/tags/v0.2.0' }), true);
  assert.equal(shouldForceFullSuite('workflow_dispatch'), true);
  assert.equal(shouldForceFullSuite('pull_request'), false);
});

test('formatGithubOutput exposes modes for workflow steps', () => {
  const text = formatGithubOutput(
    classifyChangedFiles(['docs/a.md'], { forceFullSuite: false }),
  );
  assert.match(text, /quality-mode=minimal/);
  assert.match(text, /backend-mode=skip/);
});

test('pathsFromNameStatus includes both sides of renames and copies', () => {
  const renamed = pathsFromNameStatus(
    'R100\tsupabase/migrations/001.sql\tdocs/migration-archive.md',
  );
  assert.deepEqual(renamed, [
    'supabase/migrations/001.sql',
    'docs/migration-archive.md',
  ]);
  const copied = pathsFromNameStatus(
    'C90\t.github/workflows/ci.yml\t.github/workflows/ci-backup.yml',
  );
  assert.deepEqual(copied, [
    '.github/workflows/ci.yml',
    '.github/workflows/ci-backup.yml',
  ]);
});

test('rename from full-suite path cannot downgrade tier', () => {
  const renameStatus =
    'R100\tpackage.json\tdocs/deprecated-package-json.md\n' +
    'R100\tsupabase/seed.sql\tsrc/app/page.tsx';
  const files = pathsFromNameStatus(renameStatus);
  const result = classifyChangedFiles(files);
  assert.equal(result.tier, 'full');
  assert.equal(result.backendMode, 'full');
});

test('name-only diff would miss rename source and wrongly downgrade', () => {
  const renameOnlyNewPath = ['docs/migration-archive.md'];
  const downgraded = classifyChangedFiles(renameOnlyNewPath);
  assert.equal(downgraded.tier, 'docs-only');
  const withBothPaths = pathsFromNameStatus(
    'R100\tsupabase/migrations/001.sql\tdocs/migration-archive.md',
  );
  const safe = classifyChangedFiles(withBothPaths);
  assert.equal(safe.tier, 'full');
});

test('rename migration or API route into docs cannot downgrade tier', () => {
  const migrationRename = pathsFromNameStatus(
    'R100\tsupabase/migrations/20251114001_feature.sql\tdocs/migration-notes.md',
  );
  const migrationResult = classifyChangedFiles(migrationRename);
  assert.equal(migrationResult.tier, 'full');
  assert.equal(migrationResult.qualityMode, 'full');
  assert.equal(migrationResult.backendMode, 'full');

  const apiRename = pathsFromNameStatus(
    'R100\tsrc/app/api/marketplace/route.ts\tdocs/api-route-reference.md',
  );
  const apiResult = classifyChangedFiles(apiRename);
  assert.equal(apiResult.tier, 'full');
  assert.equal(apiResult.backendMode, 'full');
});
