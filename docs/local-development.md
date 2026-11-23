# Local development

Node **26 LTS** (see [`.nvmrc`](../.nvmrc)), npm lockfile and Docker are required. `npm ci` installs the lockfile exactly; do not replace it with an unlocked install in CI. The Supabase CLI is a development dependency. The app uses PostgreSQL, Auth and Storage locally; it does not use a fake SQL-only authentication stack.

### `npm ci` peer warnings (ESLint 10)

This repository pins **ESLint 10** with `eslint-config-next@16.4.6`, which documents support for ESLint ≥9. `eslint-config-next` still pulls nested `eslint-plugin-import`, `eslint-plugin-jsx-a11y`, and `eslint-plugin-react` releases whose **npm** `peerDependencies` caps end at ESLint 9. During `npm ci`, npm may print `ERESOLVE overriding peer dependency` warnings for those nested plugins. The install still completes, `npm run lint` matches CI, and we do **not** use `--legacy-peer-deps`. Upstream plugin peer-range updates (or a future `eslint-config-next` release with ESLint-10-aware plugin pins) are required before those warnings disappear without downgrading ESLint.

Start the CLI backend, run migrations and seed, generate ignored local configuration, then run Next.js as described in the README. Use separate terminals for the dev server and tests. `supabase status` reports local endpoints; avoid copying secret output into chat or logs. `scripts/local-env.mjs` consumes its JSON output without printing keys. Seed and integration accounts are local test data; do not import that seed into a live production database.

`npm run test:db` runs pgTAP authorization and lifecycle tests against local migrations. `node scripts/test-concurrency.mjs` exercises simultaneous requests against PostgreSQL. Playwright runs against the actual local Auth/database integration after `npm run local:env` and `npm run build`. CI creates a random `E2E_PASSWORD` for disposable test users; it is not a repository secret or reusable production credential. Read the current local-env script for its supported variables before changing the test setup.

## Windows 11 (PowerShell)

Use **PowerShell**, not `cmd.exe`. Organization onboarding and access rules are in the private [`LicitatieRO/.github`](https://github.com/LicitatieRO/.github) handbook ([CONTRIBUTING.md](https://github.com/LicitatieRO/.github/blob/main/CONTRIBUTING.md); those files land on `main` when [`.github#2`](https://github.com/LicitatieRO/.github/pull/2) merges). The first QA environment-setup task is [marketplace issue #18](https://github.com/LicitatieRO/marketplace/issues/18).

### Execution policy

The default PowerShell `Restricted` policy can block `npm.ps1`. If `npm ci` or `npm test` fails with an execution-policy error, run this once in your user scope, or invoke `npm.cmd` instead (for example `npm.cmd ci`):

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Do not use `Bypass`, and do not change the machine-wide policy.

### Setup order

Work in this order so the app is in the mode you intend:

1. Install **Node.js 26 LTS** (match [`.nvmrc`](../.nvmrc); for example `nvm install` / `nvm use` where available) and Git. Fix the execution policy above if needed.
2. Clone the repo, then run `npm ci`, `npm run lint`, `npm run typecheck`, and `npm test`. These do not require Supabase or Docker.
3. Run the **demo** Playwright suite (below) **before** `npm run local:env`.
4. When you need the real local backend, enable Docker / WSL 2, start Supabase, then run `npm run db:reset` and `npm run local:env`.
5. Only then run production-mode / backend browser tests.

Demo vs backend mode is governed by `isConfigured()` in `src/lib/config.ts`: the app is configured (backend mode) when both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are set. There is no `NEXT_PUBLIC_DEMO_MODE` flag. `npm run local:env` writes those values into ignored `.env.local`, and `npm run dev` will then boot in backend mode. In PowerShell, `$env:VAR = ""` unsets a process variable; it does not blank values already loaded from `.env.local`.

If `.env.local` already exists and you need demo mode again, temporarily rename it and restore it afterward:

```powershell
if (Test-Path .env.local) { Rename-Item .env.local .env.local.bak }
# ... run the demo server and npm run test:e2e ...
if (Test-Path .env.local.bak) { Rename-Item .env.local.bak .env.local }
```

### Playwright browser tests (all platforms)

`playwright.config.ts` starts its `webServer` with plain `npm start` / `npm run dev` commands and a `webServer.env` object (no POSIX `VAR=value cmd` prefixes). **`npm run test:e2e` works the same in PowerShell, cmd.exe, and bash:** Playwright launches the app on port **3000** (same as default `next dev` and `APP_URL` from `npm run local:env`) and applies demo env overrides when needed.

Install the browser once, then run the demo suite **before** `npm run local:env`:

```powershell
npx --no-install playwright install chromium
npm run test:e2e
```

If `.env.local` already exists and you need demo mode, temporarily rename it (see above) so the dev server does not pick up backend public keys from disk.

### Local Supabase and backend / production-mode tests

When you need the local Supabase stack, install **Docker Desktop** in **per-user WSL 2** mode (WSL 2 based engine, per-user installation). A per-user Docker Desktop install does not require administrator rights, but **enabling WSL 2 for the first time does require administrator elevation and may need a reboot**. After Docker is running, follow the same flow as on Linux/macOS (`npx --no-install supabase start ...`, `npm run db:reset`, `npm run local:env`). `docker run --network host` is Linux-specific; do not assume it works on Docker Desktop for Windows.

Optional server flag `DEMO_BANNER=1` shows an extra “Demo – simulated data” strip when the flag is set and either the runtime is non-production or the deployment matches the same staging host rules as `POC_SWITCHER_ENABLED` / mock payments (`APP_URL` plus request `Host` on `STAGING_HOST_ALLOWLIST`). Set `DEMO_BANNER=1` only on the **licitatiero-staging** Vercel project; never on **licitatiero-production**.

Backend browser tests need that local stack, `.env.local` from `npm run local:env`, and `npm run build`. Playwright starts the production-mode server through `webServer` when `E2E_BACKEND` is set:

```powershell
$env:E2E_BACKEND = "1"
npm run test:e2e:backend
```

In bash: `E2E_BACKEND=1 npm run test:e2e:backend`.

## App container

The Dockerfile packages only the Next.js app using the official Node 26 LTS image and standalone output, with a non-root runtime user. Supabase remains managed by the local CLI or a separate hosted project. There is deliberately no incomplete Compose database pretending to provide Auth/Storage.

```sh
docker build -t licitatiero-app .
docker run --rm -p 3000:3000 licitatiero-app
```

The commands above build a credential-free demo. For an authenticated container, set the public Supabase URL/anon key through build arguments and server environment using an ignored env file. Public `NEXT_PUBLIC_*` values are compiled into browser assets; they must describe an endpoint the browser can reach. Never pass service-role keys as build arguments.

On Linux, `docker run --network host --env-file .env.local licitatiero-app` lets the app reach the CLI endpoint on host loopback. This host-network option is platform dependent; do not assume it works on Docker Desktop. With bridged networking, `127.0.0.1` inside the app container is the app container. Use `--add-host=host.docker.internal:host-gateway` on Linux and a server-side reachable host address, while preserving a browser-reachable public URL. If the app uses a single public URL for both server and browser clients, host networking or a reachable development hostname is simpler than publishing a container-only hostname. Validate sign-in and callbacks from the actual browser after changing networking.

The runtime image does not contain development tools or Supabase CLI. Rebuild when public configuration changes. `supabase stop` stops the local backend; it does not delete hosted data. Local `db reset` is destructive to local test data and is never part of a production rollback.

### MFA verify rate limits

Staff MFA verify reserves attempts in Postgres through `SUPABASE_SECRET_KEY` (same service credential as the notification worker; set on staging and production targets, not on preview deploys). Without that variable, verify returns HTTP 503, logs an error that names `SUPABASE_SECRET_KEY` only, and does not call Supabase Auth. On Vercel, the per-IP bucket uses `x-real-ip` or the first `x-forwarded-for` hop. Docker or other hosts without those proxy headers still enforce the per-factor limit; the per-IP bucket is skipped and a one-time server warning is logged. An unparseable IP string skips the IP bucket (factor limit still applies); the route does not return 503 for that case.

Outside Vercel, `x-forwarded-for` is not validated by the platform: clients can spoof it unless the reverse proxy overwrites or appends trusted hops. Self-hosted production must terminate TLS at a proxy that sets `x-real-ip` or an operator-trusted forwarded chain before traffic reaches the app.

`mfa.verify_ip_locked` audit rows store a SHA-256 hash of the client IP in `payload.client_ip_hash`, not the raw address. Treat `client_ip_hash` as **pseudonymous personal data**: it is a deterministic, unsalted digest of an IP address, so an attacker with database access can brute-force the IPv4 space to recover likely client IPs. Rows live in `app.audit_events` and follow the same **audit retention** policy as other security events (see privacy and retention notes; legal may set a fixed period later). **TODO:** replace plain SHA-256 with an HMAC using a server-side pepper (see issue #138) before production if counsel requires stronger pseudonymisation.

Docker images in this repo are for local development and CI only, not self-hosted production.

## Production-mode local verification

After `npm run build`, `npm start` copies static assets into the standalone build and starts its Node server. `npm run test:http` checks CSRF, protected cookies, private-offer visibility, invitation eligibility and idempotency against that local application. The HTTP test refuses non-loopback targets. Run `E2E_BACKEND=1 npm run test:e2e:backend` (or the PowerShell `$env:E2E_BACKEND = "1"` form above) for actual account and transaction browser tests; the default `npm run test:e2e` explicitly uses demo mode.
