/**
 * Zero-dependency CI path classifier for selective verification.
 * See docs/ci-policy.md for routing rules.
 */

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/** @typedef {'minimal' | 'full'} QualityMode */
/** @typedef {'skip' | 'e2e' | 'full'} BackendMode */

/**
 * @param {string} file
 * @returns {'docs' | 'app' | 'db_security' | 'deps_workflow' | 'unknown'}
 */
export function bucketPath(file) {
  const normalized = file.replace(/\\/g, '/').replace(/^\.\//, '');
  if (isDbSecurityPath(normalized)) return 'db_security';
  if (isDepsWorkflowPath(normalized)) return 'deps_workflow';
  if (isDocsOnlyPath(normalized)) return 'docs';
  if (isApplicationPath(normalized)) return 'app';
  return 'unknown';
}

function isDocsOnlyPath(file) {
  if (isDbSecurityPath(file) || isDepsWorkflowPath(file)) return false;
  if (file.startsWith('docs/')) return true;
  if (/^LICENSE(\.|$)/i.test(file)) return true;
  if (file.endsWith('.md')) return true;
  if (/^\.github\/[^/]+\.md$/.test(file)) return true;
  return false;
}

function isDbSecurityPath(file) {
  if (file.startsWith('supabase/')) return true;
  if (file.startsWith('src/app/api/')) return true;
  if (file === 'src/proxy.ts') return true;
  if (file.startsWith('src/lib/security')) return true;
  if (file === 'scripts/test-concurrency.mjs') return true;
  return false;
}

function isDepsWorkflowPath(file) {
  if (/^package(-lock)?\.json$/.test(file)) return true;
  if (file.startsWith('.github/workflows/')) return true;
  if (file.startsWith('scripts/')) return true;
  return false;
}

function isApplicationPath(file) {
  if (file.startsWith('src/')) return true;
  if (file.startsWith('tests/')) return true;
  if (file.startsWith('public/')) return true;
  const appRoots = new Set([
    'next.config.ts',
    'playwright.config.ts',
    'vitest.config.ts',
    'tsconfig.json',
  ]);
  if (appRoots.has(file)) return true;
  if (/^eslint\.config\./.test(file)) return true;
  return false;
}

/**
 * @param {string[]} files
 * @param {{ forceFullSuite?: boolean }} [options]
 */
export function classifyChangedFiles(files, options = {}) {
  if (options.forceFullSuite) {
    return buildResult('full', 'full', 'Release candidate or forced full suite');
  }
  if (!Array.isArray(files)) {
    return buildResult('full', 'full', 'Changed file list unavailable; falling back to full suite');
  }
  if (files.length === 0) {
    return buildResult('full', 'full', 'No changed files detected; falling back to full suite');
  }

  const buckets = new Set(files.map(bucketPath));
  if (buckets.has('unknown')) {
    return buildResult('full', 'full', 'Unclassified paths changed; falling back to full suite');
  }
  if (buckets.has('db_security') || buckets.has('deps_workflow')) {
    return buildResult('full', 'full', 'Database, security, concurrency, dependency, or workflow paths changed');
  }
  const nonDocs = [...buckets].filter((b) => b !== 'docs');
  if (nonDocs.length === 0) {
    return buildResult('minimal', 'skip', 'Docs-only change set');
  }
  if (nonDocs.every((b) => b === 'app')) {
    return buildResult('full', 'e2e', 'Application paths only (no database/security/workflow changes)');
  }
  return buildResult('full', 'full', 'Mixed change categories; running full suite');
}

/**
 * @param {QualityMode} qualityMode
 * @param {BackendMode} backendMode
 * @param {string} reason
 */
function buildResult(qualityMode, backendMode, reason) {
  return {
    qualityMode,
    backendMode,
    reason,
    tier:
      qualityMode === 'minimal' && backendMode === 'skip'
        ? 'docs-only'
        : backendMode === 'e2e'
          ? 'app-only'
          : 'full',
  };
}

/**
 * @param {string} eventName
 * @param {{ ref?: string }} [context]
 */
export function shouldForceFullSuite(eventName, context = {}) {
  if (eventName === 'workflow_dispatch') return true;
  if (eventName === 'push') {
    const ref = context.ref ?? '';
    if (ref === 'refs/heads/main' || ref.startsWith('refs/heads/release/')) return true;
    if (ref.startsWith('refs/tags/v')) return true;
  }
  return false;
}

/**
 * Collect every path touched by a `git diff --name-status` listing, including both
 * sides of renames/copies so a full-suite path cannot be hidden by a rename target.
 *
 * @param {string} diffOutput
 * @returns {string[]}
 */
export function pathsFromNameStatus(diffOutput) {
  /** @type {string[]} */
  const files = [];
  for (const line of diffOutput.split('\n')) {
    if (!line.trim()) continue;
    const parts = line.split('\t');
    const status = parts[0] ?? '';
    if (/^R\d*$|^C\d*$/.test(status)) {
      if (parts[1]) files.push(parts[1]);
      if (parts[2]) files.push(parts[2]);
      continue;
    }
    if (parts[1]) files.push(parts[1]);
  }
  return files;
}

/**
 * @param {typeof execFileSync} runGit
 * @param {string} base
 * @param {string} head
 * @returns {string[] | null}
 */
export function diffChangedFiles(runGit, base, head) {
  try {
    runGit('git', ['fetch', '--no-tags', 'origin', base, '--depth=1'], {
      stdio: ['ignore', 'ignore', 'ignore'],
    });
  } catch {
    // Shallow fetch may still allow diff if base is reachable.
  }
  try {
    const out = runGit('git', ['diff', '--name-status', base, head], { encoding: 'utf8' });
    return pathsFromNameStatus(out);
  } catch {
    return null;
  }
}

export function formatGithubOutput(result) {
  return [
    `quality-mode=${result.qualityMode}`,
    `backend-mode=${result.backendMode}`,
    `tier=${result.tier}`,
    `reason<<EOF`,
    result.reason,
    `EOF`,
  ].join('\n');
}

function parseArgs(argv) {
  const options = {
    event: process.env.GITHUB_EVENT_NAME ?? 'pull_request',
    ref: process.env.GITHUB_REF ?? '',
    base: process.env.CLASSIFY_BASE_SHA ?? '',
    head: process.env.CLASSIFY_HEAD_SHA ?? '',
    files: /** @type {string[] | null} */ (null),
    forceFull: process.env.CLASSIFY_FORCE_FULL === 'true',
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--event' && argv[i + 1]) {
      options.event = argv[++i];
    } else if (arg === '--ref' && argv[i + 1]) {
      options.ref = argv[++i];
    } else if (arg === '--base' && argv[i + 1]) {
      options.base = argv[++i];
    } else if (arg === '--head' && argv[i + 1]) {
      options.head = argv[++i];
    } else if (arg === '--force-full') {
      options.forceFull = true;
    } else if (arg === '--files') {
      options.files = argv[++i].split(',').filter(Boolean);
    }
  }
  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseArgs(process.argv);
  const forceFull =
    options.forceFull || shouldForceFullSuite(options.event, { ref: options.ref });

  let files = options.files;
  if (!forceFull && files === null && options.event === 'pull_request') {
    if (!options.base || !options.head) {
      files = null;
    } else {
      files = diffChangedFiles(execFileSync, options.base, options.head);
    }
  }

  const result = classifyChangedFiles(files ?? [], {
    forceFullSuite: forceFull || files === null,
  });
  process.stdout.write(`${formatGithubOutput(result)}\n`);
}
