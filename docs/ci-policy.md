# Selective CI policy

Version-controlled routing rules for [`.github/workflows/ci.yml`](../.github/workflows/ci.yml). Path classification is implemented in [`.github/scripts/classify-ci.mjs`](../.github/scripts/classify-ci.mjs) (unit-tested with `node --test .github/scripts/classify-ci.test.mjs`).

## Required check compatibility

The job names below are designed for branch protection on `main`. **Branch protection is not yet enabled** on this repository (private-plan limits); once it is, both jobs should be required on every run:

| Job name (required) | Role |
| --- | --- |
| **Quality and demo build** | Delivery checks, secret scan, dependency audit, lint, typecheck, Vitest, demo build |
| **Database and browser integration** | Local Supabase, pgTAP, concurrency script, production build, Playwright with `E2E_BACKEND=1` |

Neither job may be **skipped** or left **pending**. Selective CI narrows **steps inside** each job; both jobs always complete with **`success`**.

## Path → verification matrix

Changed paths are taken from `git diff --name-status` between the pull request base and head SHAs. Rename and copy lines contribute **both** the old and new paths (see `pathsFromNameStatus` in `classify-ci.mjs`) so a sensitive path cannot be hidden behind a docs-only rename target. If the diff cannot be computed, or any path is unclassified, the workflow falls back to the **full suite**.

### Docs-only

**Paths:** `docs/**`, any `*.md`, `LICENSE*`, `.github/*.md` (markdown only under `.github/`, not workflows). Markdown under `supabase/**` or `.github/workflows/**` is **not** docs-only — it routes to the full suite (database or workflow buckets) via `classify-ci.mjs`.

| Job | What runs |
| --- | --- |
| Quality and demo build | `node scripts/scan-secrets.mjs` only (no `npm ci`, lint, typecheck, unit tests, or demo build) |
| Database and browser integration | Skip summary only (no Docker, Supabase, Playwright) |

### Application (UI, unit tests, config — no DB/security/workflow)

**Paths:** `src/**` (except API routes below), `tests/**`, `public/**`, `next.config.ts`, `playwright.config.ts`, `vitest.config.ts`, `eslint.config.*`, `tsconfig.json`.

| Job | What runs |
| --- | --- |
| Quality and demo build | Full quality path: delivery tests, secret scan, dependency audit, lint, typecheck, Vitest, demo build |
| Database and browser integration | Local Supabase start, `db:reset`, production build, Playwright `test:e2e:backend` — **skips** `npm run test:db` (pgTAP) and `scripts/test-concurrency.mjs` because migrations/concurrency code did not change. E2E still uses local Supabase for auth and data routes. |

### Database, auth, authz, auction/reservation, concurrency

**Paths:** `supabase/**`, `src/app/api/**`, `src/lib/security*`, `src/proxy.ts`, `scripts/test-concurrency.mjs`.

| Job | What runs |
| --- | --- |
| Both jobs | **Full suite** (pgTAP, concurrency, security-sensitive paths, full backend E2E) |

### Dependencies and workflows

**Paths:** `package*.json`, `.github/workflows/**`, `scripts/**`.

| Job | What runs |
| --- | --- |
| Both jobs | **Full suite** (delivery tests, audit, and all backend checks that might be affected) |

### Unclassified changes

Any path outside the buckets above (for example `vercel.json`, `Dockerfile`, `.github/dependabot.yml`) triggers the **full suite**.

### Release candidates (always full suite)

Unconditional full verification — classification is not used:

- Push to `main`
- Push to `release/**` branches
- Push of tags matching `v*` (including `v0.*`)
- `workflow_dispatch` (manual full run)

## Telemetry and billing accuracy

When reporting CI cost or duration:

1. **Measured workflow elapsed time** — wall-clock duration from GitHub Actions run timestamps (`created_at` → `updated_at` on the workflow run). This is what you observe in the Actions UI timeline.
2. **Billable CI runner-minutes** — per-job usage rounded per [GitHub Actions billing rules](https://docs.github.com/en/billing/managing-billing-for-github-actions/about-billing-for-github-actions) (job minutes × runner multiplier, rounded per job). This is **not** the same as elapsed wall time when jobs run in parallel or when steps are skipped inside a job.
3. **Org allowance and remaining balance** — monthly included minutes and current remaining balance are **unknown** when GitHub billing APIs return `404` or are unavailable to automation. **Never report unknown allowance or balance as zero.**

**Expected savings (qualitative):** Docs-only pull requests avoid `npm ci`, application build, Supabase/Docker startup, pgTAP, concurrency runs, and Playwright — typically the largest share of backend job time. App-only pull requests still run E2E against local Supabase but skip pgTAP and concurrency when database and security paths are untouched. **Exact billable savings** should be measured after merge by comparing runner-minute summaries for representative PR types; do not invent precise percentages before measurement.

## Local verification

```bash
node --test .github/scripts/classify-ci.test.mjs
node .github/scripts/classify-ci.mjs --event pull_request --files docs/foo.md
```
