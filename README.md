# LicitatieRO marketplace

Private Bucharest real-estate MVP: bilingual property catalogue, linked sale/rent listings, public or confidential offers, reservations, viewings, messaging and owner selection. Seed data represents six physical properties and twelve listings. Financial flows are simulations. No live deposits, wallet, escrow, investment yield or guaranteed return is offered.

## Continue with Grok Bots or another agent

Start with the [complete project handoff](docs/AI_HANDOFF.md) and [ready-to-paste agent prompt](docs/NEXT_AGENT_PROMPT.md). They include source/provider state, decisions, verification evidence and prioritized remaining work.

Organization contribution rules, the external-agent claim protocol, and Windows 11 access guidance live in the private [`LicitatieRO/.github`](https://github.com/LicitatieRO/.github) handbook: [CONTRIBUTING.md](https://github.com/LicitatieRO/.github/blob/main/CONTRIBUTING.md) and [EXTERNAL_AGENTS.md](https://github.com/LicitatieRO/.github/blob/main/EXTERNAL_AGENTS.md) (those files land on `main` when [`.github#2`](https://github.com/LicitatieRO/.github/pull/2) merges). QA Step 0 onboarding is [issue #18](https://github.com/LicitatieRO/marketplace/issues/18).

## Run locally

Use Node.js 26 LTS and Docker Desktop/Engine with permission to run containers. No administrator account on a personal computer is required when using the managed development workspace. Install Docker only through your organization's normal process if running elsewhere.

On Windows 11, use PowerShell or `cmd.exe` and read the **Windows 11** section in [local development](docs/local-development.md). Set the CurrentUser `RemoteSigned` execution policy (or use `npm.cmd`) if `npm.ps1` is blocked. Run the explicit demo Playwright suite **before** `npm run local:env`. `npm run test:e2e` uses Playwright `webServer.env` and works the same in PowerShell, cmd, and bash (no manual server tab required). Use Node **26 LTS** matching [`.nvmrc`](.nvmrc).

The Bucharest–Ilfov map extract (`data/tiles/bucharest-ilfov.pmtiles`, served at `/tiles/…`) is stored with **Git LFS**. After clone, run `git lfs pull` once so the file is the real archive (see [map-tile-fallback runbook](docs/runbooks/map-tile-fallback.md)).

```sh
npm ci
npx --no-install supabase start -x realtime,studio,edge-runtime,logflare,vector,supavisor,postgres-meta,imgproxy
npm run db:reset
npm run local:env
npm run dev
```

`local:env` writes ignored `.env.local` from the local Supabase status and creates local integration accounts. Follow its required test-password environment contract. Never copy production credentials into local development. Database reset destroys only the local development database; never point local commands at a remote project. Without Supabase configuration, the application supports explicit demo browsing; authenticated actions require the real backend. See [local development](docs/local-development.md).

```sh
npm run lint
npm run typecheck
npm test
node --test scripts/delivery.test.mjs
node scripts/scan-secrets.mjs
node scripts/audit-dependencies.mjs
npm run test:db
node scripts/test-concurrency.mjs
npm run build
npx --no-install playwright install chromium
npm run test:e2e # explicit demo browser suite
E2E_BACKEND=1 npm run test:e2e:backend # real local accounts and transactions
```

CI repeats quality/demo build and real local-backend database/browser checks with no external production credentials. See [delivery runbook](docs/delivery.md), [architecture decisions](docs/adr.md), [architecture and capacity](docs/ard.md), and [third-party/legal readiness](docs/third-parties.md). Founder budget assumptions live in the private companion repo (see `docs/security/scrub/companion-private-repo.md`).

## Deployment status

Third-party license notices (LGPL libvips/sharp, CC-BY caniuse-lite) are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md); the license audit workflow is in [docs/license-audit.md](docs/license-audit.md).

The source includes staging and manually triggered production workflows. Deployments require configured accounts, isolated projects, environment variables and secrets; their presence in source does not establish a live service. Staging follows successful main CI. Production releases a full exact commit SHA already tested on main. See the delivery runbook for configuration and verification evidence. Source is private/proprietary; no open-source license is granted.

## Constrained environments

A [lightweight local integration harness](dev/lightweight/README.md) provides genuine GoTrue/PostgREST with an isolated PostgreSQL database when the complete Supabase Docker images do not fit. It deliberately excludes Storage, SMTP and durable scheduling; use the full Supabase environment to verify those integrations.

The founder workspace UI (`/founder`) is separate from the production marketplace deployment; internal budget documentation is not stored in this public tree.
