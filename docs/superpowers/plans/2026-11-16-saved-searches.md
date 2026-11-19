# Saved searches implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline. #41 is the scoped spec; founder authorized autonomous ready work. Final PM/QA SHA pin and no self-merge.

**Goal:** Save private search filters and queue generic, verified-email price/status alerts reliably.

**Architecture:** New owner-only saved-search table and CRUD RPC/API. A listings-update trigger matches old/new public price/status snapshots, locks matching searches in ID order, inserts one generic outbox row and sets its cooldown atomically. No provider call inside business locks. Existing service worker excludes unverified search-alert recipients at claim time.

**Tech stack:** Existing PostgreSQL/Next.js/React/TypeScript/Vitest/pgTAP/Playwright; no new dependencies or schedules.

**Spec:** [#41](https://github.com/LicitatieRO/marketplace/issues/41).

## Global constraints / implementer defaults

- Dedicated `/saved-searches`, no catalogue/workspace/map/active PR files. New migration038, pgTAP045; coordinate ascending migration order with036/037.
- Five searches/account and1,000global, enforced on insert; duplicates update the same search. Hard limit fails explicitly; never silently drops recipients. One alert/search/hour and five alerts/account/hour (including deleted/recreated searches), disclosed in UI.
- Supported public filters: sale/rent, judet, neighborhood, min/max listing price, minimum rooms. No exact addresses, sealed bid amounts, or personal matching fields.
- Verified email on save, enqueue and service-worker claim. Owner-only RLS/read/delete; no staff bypass.
- No hosted migrations, provider purchases, real money, workflow edits, dependency changes or Resend calls in tests.

## Review focus

- Foreign search IDs and direct table writes cannot cross ownership (DB/API tests).
- Replayed saves, unchanged price/status, rapid repeated updates and rollback do not duplicate alerts (DB tests).
- Concurrent matching updates lock search IDs consistently; cooldown+outbox are transactional (realDB tests and review).
- Unverified recipients cannot save or receive queued search alerts (DB tests, claim-function guard).
- Filters/limits fail explicitly instead of unsafe casts, broad personal-data matching or truncated fanout (validator and capacity tests).

## Task1: Bounded transactional data path

- [ ] Write schema/ownership/idempotency/matching/cooldown/verification/rollback tests before migration implementation.
- [ ] Add saved-search CRUD RPCs, validation, RLS, capacity trigger and listing-change fanout. Read RPC uses no writer-lock helper. Preserve existing claim function except search-alert verified-email condition.
- [ ] Add dedicated GET/POST/DELETE route with same-origin mutation checks and strict filter schema. Unit-test malformed filters, auth/CSRF denial and ownership response.
- [ ] Add generic bilingual event label, keep workspace-only email link; verify no private details.

## Task2: User flow and evidence

- [ ] Standalone RO/EN light/dark page with named search/filter form, list/delete, explicit limits/cooldown/delivery delay. Query params may initialize the form. Navigation link in unowned platform component; no catalogue rewrite.
- [ ] Backend browser cases use disposable verified users to save/list/delete and prove isolation. No provider sends.
- [ ] Targeted units/lint first; existing fresh Node26 DB/Auth/browser CI proves actual behavior. One fresh review, fix important findings, exact head/evidence/limits on #41, then in-review without merging.
