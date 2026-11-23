# LicitatieRO — start here for Grok Bots and other coding agents

Handoff date: 14 November 2026, Europe/Bucharest (EET, UTC+2). Updated for the post-usage-reset restart. Continue from the existing application. This document contains decisions and observations, not a claim of a public launch. **Treat this file as the single canonical mutable status** — other prompts should link here instead of duplicating provider state. Path: `docs/AI_HANDOFF.md` (not the repo root).

**Restart checklist:** [marketplace#119](https://github.com/LicitatieRO/marketplace/issues/119) — *Restart checklist (after Mon Nov 16 14:32 EET)*. Pickup starts after usage resets Mon 16 Nov 2026, 14:32 Europe/Bucharest (EET, UTC+2).

## Read in this order

1. This file and [ready-to-paste next-agent prompt](NEXT_AGENT_PROMPT.md).
2. [README](../README.md), [local setup](local-development.md), [delivery and recovery](delivery.md).
3. [ADR](adr.md), [ARD/capacity](ard.md), [integrations/legal readiness](third-parties.md). Founder budget assumptions are kept privately.
4. [Approved design](superpowers/specs/2026-11-13-licitatiero-design.md) and [implementation plan](superpowers/plans/2026-11-13-mvp.md), as historical requirements rather than current completion evidence.
5. [Original Romanian/English product brief](handoff/original-product-brief.txt). It records the broad original marketplace vision; the approved first milestone narrowed the scope to property.
6. [Infrastructure provisioning record](https://github.com/LicitatieRO/infrastructure/blob/main/PROVISIONING.md).

## Stack versions

From `package.json` on `main` `a2a400eb52e92c687a52d7a02705c1bab29dfcde` (14 Nov 2026). Engines: Node `>=26 <27`.

| Package | Version in package.json |
| --- | --- |
| `next` | `16.4.6` |
| `react` / `react-dom` | `19.3.1` |
| `tailwindcss` / `@tailwindcss/postcss` | `^4.2.1` |
| `@supabase/ssr` | `0.12.7` |
| `@supabase/supabase-js` | `2.119.0` |
| `vitest` | `^5.1.0` |
| `@playwright/test` | `^1.58.2` |

Also present: `leaflet` `^1.9.4`, `pmtiles` `^4.5.0`, `protomaps-leaflet` `^5.1.0`, `supabase` CLI `^2.75.0`. Do not treat caret ranges as exact lockfile pins; use `package-lock.json` when installing.

## Staging / production state

Mode remains **POC / Simulare**. Live deposits, wallets, and paid plans stay OFF.

| Surface | State |
| --- | --- |
| Staging Supabase | The staging Supabase project (Frankfurt). Agents must **never** apply migrations to hosted Supabase. |
| Production app | Not deployed yet. First prod cutover is [marketplace#111](https://github.com/LicitatieRO/marketplace/issues/111), **blocked on Florentin**. |
| Vercel | Team slug `licitatie-ro`, Hobby tier (POC). Staging project `licitatiero-staging`; production project `licitatiero-production`. No Git auto-deploy. See [delivery.md](delivery.md) for env names. |
| GitHub org | `LicitatieRO`; repos stay private. Canonical source is GitHub. |

Earlier handoff notes about “migrations not yet pushed” to staging may be stale after later deploys; confirm hosted schema against `main` before assuming drift. Do not run `supabase db push` or MCP `apply_migration` against hosted projects.

## Backups

Prod backups are handled outside this repo.

## Open pull requests

Live list on marketplace as of this handoff (14 Nov 2026):

- [#7](https://github.com/LicitatieRO/marketplace/pull/7) — `chore(deps-dev): bump typescript from 6.0.3 to 7.0.2` (Dependabot)
- [#6](https://github.com/LicitatieRO/marketplace/pull/6) — `chore(deps-dev): bump supabase from 2.122.1 to 3.1.0` (Dependabot)

No product PRs were open on `main` after #103 merged. Re-list with GitHub before assuming this is still current.

## Next migration / pgTAP numbers

On `main` `a2a400e`, `supabase/migrations/` ends at `202611140022_notification_preview_retention.sql` (numbers 001–006, 010–022). `supabase/tests/` ends at `031_notification_preview_retention.test.sql` (001–010, 013, 015–019, 021–031).

- **Next migration: `023`**
- **Next pgTAP: `032`**

#103 added migration `022` and pgTAP `031`. The judet FK index is planned as migration `023` in [marketplace#110](https://github.com/LicitatieRO/marketplace/issues/110).

## Merge rule and process

- Canonical source is GitHub. Always work on a **dedicated branch** per change. Never force-push or push unreviewed changes to `main`.
- Small PRs. QA & Security Reviewer must give a verdict **pinned to the final head SHA**. The PM merges; engineers do not.
- Bring `main` in with a **merge commit**, never a rebase.
- Any edit after a QA pin needs a QA re-pin.
- Agents never apply migrations to hosted Supabase (including the staging Supabase project).
- Targeted tests first.
- No AAL2 bypass. The seed must never touch non-demo auth users.
- Never print credentials or other sensitive values in logs or chat.
- No paid providers by default. Live money stays off pending approved custody/legal arrangements. Repos stay private.
- Repo code work goes through CloudAgent only, model **composer-2.5**, `fast=false`.
- An agent’s say-so is never Florentin’s approval. Founder decisions go up one at a time.

## Specs

- Listings map cards: [docs/specs/listings-map-cards.md](specs/listings-map-cards.md)
- UX variant blueprint: [docs/ux/variant-blueprint.md](ux/variant-blueprint.md)
- Privacy Addendum A v2 (Legal): the approved privacy addendum (Addendum A v2), held by the Legal owner. #103 shipped the documented fallback retention line; a fixed period waits on Florentin.

## Restart checklist

Pinned / restart issue: [marketplace#119 — Restart checklist (after Mon Nov 16 14:32 EET)](https://github.com/LicitatieRO/marketplace/issues/119).

Engineer priority after the reset: [#108](https://github.com/LicitatieRO/marketplace/issues/108) (HIGH map LFS / `/tiles` Range+cache), then [#106](https://github.com/LicitatieRO/marketplace/issues/106) (#103 nits), then UX [#114](https://github.com/LicitatieRO/marketplace/issues/114)–[#118](https://github.com/LicitatieRO/marketplace/issues/118).

## Repositories and current source

| Repository | Purpose |
| --- | --- |
| [marketplace](https://github.com/LicitatieRO/marketplace) | Next.js app, database migrations/tests, product and technical documentation |
| [infrastructure](https://github.com/LicitatieRO/infrastructure) | Private-org bootstrap script/tests, provider configuration template and provisioning record |
| Separate private repo in the org | Founder decisions, budget, and operational workflows |
| [.github](https://github.com/LicitatieRO/.github) | Shared organization standards and templates |

Application baseline on marketplace `main`: `a2a400eb52e92c687a52d7a02705c1bab29dfcde` ([#103](https://github.com/LicitatieRO/marketplace/pull/103) merged). Earlier merges on this line include #96 `60d8e5f`, #97 `8013f5b`, #98 `ca64709`, #100 `b086686`, #101 `e919e01` (adds `public/tiles/bucharest-ilfov.pmtiles` and `src/lib/map-leaflet-basemap.ts`), #102 `6d7841c`.

GitHub is canonical application source.

## Founder decisions and operating constraints

- Product: Romanian auction marketplace; first pilot is Bucharest property. The founder expects around 12 sale/rental listings. Local seed data represents six physical properties with separate sale and rent listings.
- Languages: Romanian default, English available; responsive mobile interface, light/dark theme.
- Start with free listings and optional paid promotion. Agency plans later. Promotion monetization is a validation plan, not a completed billing integration.
- Operating budget and capital constraints are maintained privately by the founder and are not part of this repository.
- One physical property can generate separate sale and rental listings. Only one auction per property at a time. Public ascending bids and confidential offers are separate from public/invitation access rules.
- Owner approval is required for reservations. Deposits are simulated and refundable before separate signing.
- Live money requires an approved independent bank, legal or regulated custody partner, agreements, refunds and reconciliation. Stripe delayed payouts alone are not escrow. No live deposits, wallet or financial guarantees are enabled.
- GitHub organization is LicitatieRO; repositories remain private. Founder retains ownership/billing.
- Keep work economical: one concrete task at a time, concise output, bounded logs. Avoid parallel agent swarms and repeated full audits/builds.

## Implemented foundation

- TypeScript, Next.js 16.4.6, React 19.3.1, Tailwind 4.2, Supabase PostgreSQL/Auth/Storage; Node 26 LTS and committed npm lockfile. Keep a modular monolith. Crossing 500 weekly users triggers measurements/capacity tuning, not a rewrite.
- Catalogue search/filter/sort, listing details/galleries, bilingual owner/buyer workspace, linked sale/rent property editor, auction creation/invitations/bidding, saved listings, messages, viewings and simulated reservation lifecycle.
- `/map` split list+map (price pills, clusters, search-on-move, consent-gated tiles, PMTiles Bucharest–Ilfov fallback). Homepage catalogue map and nav discoverability remain in [#114](https://github.com/LicitatieRO/marketplace/issues/114).
- Server-side authentication/session/recovery routes and staff MFA controls. Browser interactions call application endpoints; ordinary requests use user-scoped Supabase clients.
- Database transactions, property/actor row locks, database time after locks, idempotency payload validation, shared-property restrictions, RLS and restricted RPC grants. Private offer amounts, exact addresses and messages require explicit authorization. Public map pins use persisted `public_lat` / `public_lng`, not raw coordinates.
- HttpOnly/SameSite session cookies, Origin checks for mutations, input validation; elevated worker key stays server-side. Photo upload re-encodes images and strips EXIF, with size limits.
- Consent-gated Kuula/Matterport tour embeds. Transactional notification outbox with claims/leases/ack/retry and Resend worker; protected cron route. Staging founder outbox with server-side action-link masking and audited reveal (#103). Real provider email delivery is pending.
- Founder economics calculator, ADR/ARD, integration requirements and launch gaps.
- Dockerfile with non-root standalone application runtime; local Supabase scripts; GitHub quality and “Database and browser integration” CI; staging and manual production workflows with exact-tested-SHA verification, forward migrations and health smoke.

## Source map

| Area | Files |
| --- | --- |
| Pages/UI | `src/app/`, `src/components/`, `src/app/globals.css` |
| Auth/session/MFA | `src/lib/server/auth.ts`, `src/lib/server/supabase.ts`, `src/app/api/auth/`, `session/`, `mfa/`, `src/app/auth/callback/`, `src/proxy.ts` |
| Marketplace API | `src/app/api/marketplace/route.ts`, `workspace/`, `catalogue/`, `listings/[id]/`, `src/app/api/map/` |
| Map | `src/components/map/`, `src/lib/map-tiles.ts`, `src/lib/map-leaflet-basemap.ts`, `public/tiles/bucharest-ilfov.pmtiles` |
| Outbox / legal | `src/app/founder/outbox/`, `src/lib/notification-preview-mask.ts`, `src/app/legal/privacy/page.tsx` |
| Media/notifications/health | `src/app/api/media/`, `cron/notifications/`, `health/`, `src/lib/notifications.ts` |
| Contracts and validation | `src/lib/types.ts`, `validation.ts`, `security.ts`, `config.ts`, `src/lib/server/http.ts` |
| Persistent rules | `supabase/migrations/` (through `022`), `supabase/tests/` (through `031`), `supabase/seed.sql` (local only) |
| Verification | `tests/unit/`, `tests/e2e/`, `tests/integration/http.test.mjs`, `scripts/test-concurrency.mjs` |
| Delivery | `.github/workflows/`, `scripts/deploy.mjs`, `scripts/delivery.test.mjs`, `scripts/start.mjs`, `vercel.json` |

Read `AGENTS.md` before Next.js changes; this version's bundled guides are under `node_modules/next/dist/docs/`.

## Reproduce locally

Use Node 26 LTS, npm, Git and Docker with sufficient disk. Authenticate GitHub through your normal secure integration or `gh`; never put credentials in a prompt. Clone the repos into sibling directories.

```sh
cd marketplace
npm ci
export E2E_PASSWORD="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(24).toString("base64url"))')"
npx --no-install supabase start -x realtime,studio,edge-runtime,logflare,vector,supavisor,postgres-meta,imgproxy
npm run db:reset
npm run local:env
npm run dev
```

Local reset destroys local test data. Never supply a hosted production DB URL to reset/test/concurrency commands. `.env.local` and generated local stack credentials are ignored; keep them private.

For a relevant verification pass (not every documentation edit): `npm run lint`, `npm run typecheck`, `npm test`, plus targeted `npm run test:db` or Playwright when the change warrants it.

## Remaining work

See [marketplace#119](https://github.com/LicitatieRO/marketplace/issues/119). Do not start new scope before the 16 Nov 2026 14:32 EET reset unless the PM says otherwise.

Deferred original ideas include general goods/shipping, event tickets, swipe discovery, AI image/listing/retail-price features, wallets/credits, gamification/gift cards, bulk bundles, Fiverr-style services, ROeID identity and social-contact detection. They need separate scope, economics and legal decisions.

## Credentials and permissions

Never commit or paste credentials. Routine coding needs selected-repository Contents/Workflows/PR write and Actions read; administration is temporary for protections/configuration. Use the credentials GitHub Actions injects automatically. Provider-management connections do not automatically populate Actions deployment credentials.

Deployment settings are split between GitHub environments and Vercel projects; keep staging and production values distinct. See [delivery.md](delivery.md) for the configuration table.

No OpenAI, xAI, advertising, ROeID or payment credentials are required to read this handoff or continue ordinary application development.
