# Confidential offer comparison implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline. Founder-approved autonomous work; #37 is the scoped spec. No self-merge; PM/QA review the final SHA.

**Goal:** Let owners compare confidential offers by amount/time without exposing them to other bidders or automatically awarding one.

**Architecture:** A new narrowly scoped PostgreSQL RPC checks ownership or actual staff profile plus AAL2 before returning only bid ID, display name, amount and timestamp. A server GET route authenticates and validates this payload. A read-only owner-workspace table fetches it on demand and sorts locally; existing selection actions/after-close rules stay unchanged.

**Tech stack:** Existing Next.js/React/TypeScript/PostgreSQL/Vitest/pgTAP/Playwright, no new dependencies.

**Spec:** [#37](https://github.com/LicitatieRO/marketplace/issues/37). Comparison during the auction preserves existing owner workspace policy; no new confidentiality or award policy.

## Global constraints

- No changes to active PR146–153 files, globals.css, http.ts, types.ts, listing-detail, place_bid or their tests/migrations.
- Use migration202611160037 and pgTAP043; PM coordinates ascending migration merge/deploy order with036.
- No hosted migrations, live funds, provider/workflow/dependency changes.
- Nonowners receive403/empty; never zero-valued replacement offers. Staff access requires database profile+aal2, not a caller-supplied role.

## Review focus

- Bidder, stranger, staff-AAL1 and anonymous calls return no other person's offer data (realDB tests).
- Missing/invalid amounts fail instead of displaying0; equal values sort deterministically without mutating data (unit tests).
- Owner selection can choose a lower sealed offer only after closing; reading/sorting never awards anything (DB test).
- Switching accounts/auctions or receiving403 must not retain previous rows (component state identity guard, browser test).
- RO/EN names/time/currency and keyboard controls remain readable on mobile/dark without shared style edits (browser matrix).

## Task1: Authorized read contract

- [ ] Write pgTAP043 privacy/owner/staff/empty/selection tests first.
- [ ] Add `public.get_sealed_offers(uuid)` in migration037, security definer with empty search path and authenticated-only execute.
- [ ] Write failing parser/sort and GET authorization unit tests; implement `src/lib/sealed-offers.ts` and `src/app/api/auctions/[id]/sealed-offers/route.ts`. Route authenticates, DB remains authoritative, all failures contain no rows.
- [ ] Verify targeted units/lint, then real disposable PostgreSQL CI; never claim unavailable localDB results.

## Task2: Owner comparison table

- [ ] Add `src/components/sealed-offer-comparison.tsx`, owner workspace hook only for own sealed auctions. Default newest-first; explicit amount/time ascending/descending controls. Read-only with no winner or award action; existing owner cards remain the selection workflow.
- [ ] Add focused backend browser test for owner table sorting and bidder403, language/theme/mobile coverage. Preserve public sealed amount privacy.
- [ ] Run targeted checks then existing Node26 build/DB/concurrency/browser CI. One fresh whole-branch review; fix verified important findings, record exact final evidence and limits on #37. Open PR and hand off without merging.
