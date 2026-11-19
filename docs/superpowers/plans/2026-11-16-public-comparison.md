# Public listing comparison implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline; #42 is the scoped spec under founder-authorized autonomous execution. PM/QA pin final SHA; no self-merge.

**Goal:** Compare2–3published listings, including sale/rent of one physical property, without exposing private fields or inventing ROI.

**Architecture:** Server reads the existing catalogue and whitelists an explicit public comparison DTO before serialization. Query parser accepts bounded listing IDs or one property ID. Native GET selectors drive a responsive client table; server-time snapshot states never claim current bid eligibility.

**Tech stack:** Existing Next.js/React/TypeScript/Vitest/Playwright; no dependencies, schemas, provider or workflow changes.

**Spec:** [#42](https://github.com/LicitatieRO/marketplace/issues/42).

## Global constraints / review focus

- Only new files; avoid catalogue/platform/workspace/types/security and all activePR146–155files.
- Exclude unpublished/invalid listings. Strip owner IDs, exact addresses, descriptions, tours, bids and raw timestamps. Invitation-only schedule stays hidden even for an owner viewer.
- Sale prices are totals; rent prices monthly. No yield/valuation claims.
- Query count/UUID/duplicates/mixed selectors have deterministic validation; unavailable public selections produce a safe notice.
- Native labels/table headers and horizontal overflow preserve keyboard/mobile access; RO/EN light/dark and POC disclosure.

## Task1: Public data boundary

- [ ] Write failing query/DTO/selection tests:2–3IDs, property linking, duplicate/malformed/oversized/mixed input, private fields, sealed/invite timing, invalid price and unpublished rows.
- [ ] Implement `src/lib/listing-comparison.ts` pure helpers and explicit DTO. Server page catches catalogue failure and passes only sanitized data/snapshot to client.
- [ ] Targeted units must pass before committing; no new database tests required because existing catalogue/RPC remains untouched.

## Task2: Table and evidence

- [ ] Add native selection form and side-by-side table with linked sale/rent highlight, public metrics, timing snapshot disclaimer and direct listing links.
- [ ] Browser coverage on desktopRO/light and mobileEN/dark for linked property, native selector flow, malicious query and responsive width. Test demo/real catalogue through existing CI.
- [ ] Lint/typecheck/unit/build/browser CI, one fresh whole-branch review, meaningful fixes, exact evidence/limits on #42; hand off in-review without merge.
