# Delivery and release runbook

## Repository and account setup

Create only the existing `LicitatieRO` organization's private `marketplace`, `infrastructure` and `.github` repositories. The infrastructure bootstrap first checks authenticated organization membership, defaults to a read-only plan, and refuses a personal-account fallback. The founder controls billing and account ownership. Root delivery owns remote repository creation and pushes; local files do not prove any remote operation occurred.

GitHub **Team** (paid) is required for enforceable branch protection rules on **private** repositories. GitHub **Free** allows private repos but does not offer the same required-status-check and protection controls; treat unverified protection settings as advisory until the organization plan supports them. Configure main to require pull requests, resolved discussions and these CI job checks once the plan allows it: `Quality and demo build`, `Database and browser integration`. Confirm check names from an actual run before enforcing them. Prevent force pushes/deletion, restrict bypass and keep the branch current when the plan permits. **GitHub Environments** (staging/production) add deployment secrets and optional protection rules; required reviewers on environments are a paid-plan feature—do not assume independent approval gates on private Team repos without verifying the organization's current GitHub plan. Production workflow dispatch is founder release control, not a substitute for configured environment reviewers. Never use `pull_request_target` to check out PR code with secrets.

Enable Dependabot alerts where available. Dependabot opens npm and pinned GitHub Action update PRs weekly. Secret scanning here is a custom tracked-file scanner with tests; it is not a claim that paid GitHub Secret Protection/CodeQL is enabled. Review scanner findings privately; values are withheld in output. It covers known credential patterns rather than proving the absence of all secrets. If a credential is exposed, revoke it before removing it from history.

## Minimal configuration matrix

Create **separate** staging and production Supabase projects in Frankfurt and **separate** Vercel projects in the same intended team. Each GitHub environment has the same variable names but distinct project identifiers and secrets.

| Location | Names | Purpose |
| --- | --- | --- |
| GitHub environment secret | `VERCEL_TOKEN` | Normal Vercel access token with access to the intended team/projects |
| GitHub environment secret | `VERCEL_AUTOMATION_BYPASS_SECRET` | Matching project's Protection Bypass for Automation secret when deployment protection includes the production target; required for SSO protection of all deployments |
| GitHub environment secret | `DATABASE_URL` | Direct or session-pooler PostgreSQL connection for that environment; URL-encode password |
| GitHub environment variables | `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | Explicit team and project IDs |
| GitHub environment variables | `SUPABASE_PROJECT_REF`, `DEPLOY_ORIGIN` | Expected database project identity and canonical HTTPS health-check origin |
| Vercel project environment | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `APP_URL` | Corresponding Supabase project and callback/app origin |
| Vercel project environment | `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET` | Only when the implemented email/outbox adapter is enabled; use a verified sender domain |
| Local bootstrap only | `gh` signed-in account | Active organization membership/repository creation rights; no PAT in runtime workflows |
| Optional manual CLI alternative | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` | Link/push through Supabase CLI if choosing that documented alternative; not used by supplied deployment script |

A public Supabase anon/publishable key is subject to RLS and is not a service-role key. Ordinary app traffic must use user-scoped clients. Keep server-only elevated keys out of browser configuration, logs, Docker layers and repository files. Use platform dashboards/secret inputs, not copied plaintext in chat.

Vercel CLI uses the ordinary token and `--scope` team ID, with explicit `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID`. Both dedicated Vercel projects deploy their own production target, so staging never aliases the production project. Configure project environment values before release; `vercel pull` retrieves that project's production configuration. Restrict who can alter environment secrets and workflows.

## What CI and release verify

`CI` has two jobs capped at 20 minutes. Quality runs `npm ci`, delivery-script tests, tracked secret scan, dependency audit, ESLint, TypeScript, Vitest and a build without Supabase configuration in explicit demo mode. Backend starts actual disposable Supabase with unused services excluded, resets local migrations/seed, runs pgTAP and concurrent transaction tests, creates local integration users/configuration, builds and runs Playwright. No external credentials enter pull-request jobs. Failures remain failures; missing production secrets never produce a fake successful deployment.

A successful main push CI triggers staging for **that exact run's head SHA**. Production is a manual workflow dispatch on main with a lowercase 40-character SHA. Before checking out that SHA, a trusted workflow step verifies it is reachable from main and has completed successful main push CI. The deployment script repeats exact-SHA CI/reachability verification, matches checkout HEAD, checks all configuration, validates database project identity, and checks the Vercel API project/team scope before writes. `GITHUB_TOKEN` grants only contents/read and actions/read. No personal token is used at runtime.

Action pins were verified against official Git repositories on 2026-11-13:

| Action | Tag | Verified SHA |
| --- | --- | --- |
| `actions/checkout` | v7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| `actions/setup-node` | v7.1.0 | `949feb2413d6458794dcd2491c4babbbce0c15c1` |

Vercel CLI `65.15.0` was verified via the npm registry on the same date. Supabase CLI comes from `npm ci`/the committed lockfile. Reverify pins when accepting updates.

The script applies forward SQL migrations, builds/deploys the selected project's Vercel production target, and polls canonical `/api/health` for a healthy JSON response. This smoke check establishes endpoint availability; verify login, RLS, catalogue and one simulated transaction after release as well.

Keep prelaunch deployment protection enabled. For each protected project, generate a project-specific [Protection Bypass for Automation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation) secret and store it as `VERCEL_AUTOMATION_BYPASS_SECRET` in the matching GitHub environment. Both workflows pass it explicitly; the Vercel system environment variable inside a deployment does not populate the GitHub runner. It is separate from `VERCEL_TOKEN`. Before applying migrations, the script rejects a missing bypass secret when the verified Vercel project has SSO protection for all deployments and rejects invalid header values without printing them. When configured, the smoke request sends the secret only in the `x-vercel-protection-bypass` header and refuses redirects to prevent forwarding it to another origin. Use the canonical HTTPS origin directly, including the correct hostname without redirects. Unprotected projects can omit this secret. Missing/invalid credentials, authentication pages and unhealthy responses never count as a successful smoke check.

## Migration and recovery policy

Use expand/contract migrations: add nullable columns/new tables first, deploy compatible readers/writers, backfill separately with limits, then remove old schema only after all consumers have migrated. Review lock duration, indexes, RLS changes and data loss before merging. A successful SQL transaction does not establish application compatibility. Keep staging and production refs distinct and test the exact migration sequence on staging.

No automatic database rollback is attempted after a failed app deploy. Prefer a forward corrective migration; application rollback is safe only while the schema remains backward compatible. For recovery, select an earlier CI-tested main SHA, verify compatibility, and dispatch production manually. Configure and exercise backups and PITR **before live funds or irreplaceable customer data**. Restore drills need an isolated project and operator authorization; never overwrite production as an automatic health-check response.

## Dependency audit baseline

`docs/dependency-audit-baseline.json` starts empty and records **npm security advisory** exceptions only, not SPDX license inventory (see `THIRD_PARTY_NOTICES.md` and `docs/license-review-needed.json`). The audit script fails on every unreviewed high/critical advisory and on audit-service errors. An exception needs exact package/advisory ID, reason tied to reachable exposure, owner review and expiry date; broad severity ignores are prohibited. Low/moderate issues still require review through `npm audit`. No high-severity exception is implied by a green file existing.

## Evidence to record at first real release

Record private repository URLs, organization plan/branch-protection verification, successful CI URL and exact SHA, distinct project IDs/regions, migrations applied, staging smoke/manual journey results, production dispatch URL and smoke result, DNS and verified sender status. Keep secrets out of this record. Until these observations exist, account-backed deployment, email delivery and independent provider contracts remain unverified.

Official references: [GitHub private branch protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches), [deployment environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments), [Vercel CLI](https://vercel.com/docs/cli), [Supabase migrations](https://supabase.com/docs/guides/deployment/database-migrations), [Supabase backups](https://supabase.com/docs/guides/platform/backups).

## Notification worker

The service-only outbox RPCs lease up to five deliveries per worker run, bound retry attempts, and reject stale acknowledgements. `GET /api/cron/notifications` requires the configured `CRON_SECRET` bearer value.

**Vercel cron schedule (`vercel.json`):** On the current **Vercel Hobby** POC path, `vercel.json` sets the notification cron to **`0 9 * * *`** because Hobby rejects schedules more frequent than daily. On Hobby, that expression triggers **once per day somewhere between 09:00 and 09:59 UTC** (Vercel does not guarantee the exact minute). After upgrading to **Vercel Pro**, change the schedule back to **`*/5 * * * *`** for five-minute notification worker runs. Until then, expect notification email delivery to lag up to ~24 hours unless the route is invoked manually. Auction/reservation expiry still relies on Supabase **`pg_cron`** (`marketplace-close-expired`, every minute), not the Vercel notification cron; the hosted **`cron.job`** assertion in pgTAP (`009_cron_and_expiry.test.sql`) remains the staging gate that proves `pg_cron` is installed and the expiry job is registered before treating staging as ready.

`SUPABASE_SECRET_KEY` is used only by this worker, never ordinary marketplace requests. Resend delivery uses stable outbox idempotency keys. Notifications contain a generic workspace link, not messages, exact addresses, or bid values. Missing credentials fail closed with HTTP503. Database pg_cron separately closes expired auctions; requests independently enforce deadlines. Provider delivery and schedule execution remain unverified until account-backed deployment.

## Pre-production cutover gate ([#111](https://github.com/LicitatieRO/marketplace/issues/111))

Before the first production dispatch, complete these auth checks on **staging** after the recovery-email template cutover (hosted dashboard change; local reference is `supabase/templates/recovery.html` wired through `supabase/config.toml`):

1. Request account recovery in browser A.
2. Open the email link in a **fresh** browser profile or device B (no shared cookies with A).
3. Confirm `/auth/callback` lands on `/account?mode=reset` without `?error=verification`.
4. Complete password reset and sign in with the new password.

Until the hosted recovery template uses `token_hash` plus `type=recovery` (not PKCE-only `ConfirmationURL`), cross-browser recovery will fail in production. Do not change hosted Supabase templates for production until Florentin approves the #111 cutover.
