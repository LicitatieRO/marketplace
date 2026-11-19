# Auction soft-close implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline, task by task. GitHub issue #35 is the scoped spec; the founder authorized autonomous execution of ready issues. PM/QA review the final SHA before merge.

**Goal:** Prevent last-second ascending-auction sniping without implying a fixed cutoff.

**Architecture:** PostgreSQL extends an accepted bid's deadline under the existing property-first lock. Per-auction settings default to a 120-second window and a 30-minute total cap; sealed offers and pre-migration auctions retain fixed deadlines. The listing detail samples database time and deadlines through its private/no-store read endpoint, advances the display with a monotonic clock, and periodically resynchronizes. The database alone accepts bids.

**Tech stack:** Existing PostgreSQL, Next.js, React, TypeScript, Vitest, pgTAP, Playwright; no new dependencies.

**Spec:** [GitHub #35](https://github.com/LicitatieRO/marketplace/issues/35), including its RO/EN pre-bid extension disclosure. Window/cap/defaults and polling interval below are implementer choices, open to PM review.

## Global constraints

- No hosted migrations, live funds, paid providers, workflow edits or dependency changes.
- Keep property-first locking, post-lock `clock_timestamp()`, invitation checks, sealed privacy, bid limits and idempotent replay.
- Do not touch PR146's map helpers/styles or PR150's concurrency harness. Existing harness must still pass against the changed function.
- Historical suggested migration/test numbers are occupied: use migration `202611160036_auction_soft_close.sql` and test `042_soft_close.test.sql` after verifying live tree.

## Review focus

- Retries at/after the original deadline return the same response and cannot extend twice (SQL test).
- At the hard cap the auction still closes; late bids waiting on a lock remain rejected (SQL cap test + existing real concurrency scenario).
- Sealed/invite-only reads retain their privacy gates and no extension (SQL tests).
- Client clock jumps and network errors cannot mislead bidding controls (monotonic helper tests + browser request mocks).
- Legacy active auctions gain no surprise extensions; pre-bid text states the actual window and cap (SQL migration policy + browser assertions).

## Task 1: Database invariant

- [ ] Write `supabase/tests/042_soft_close.test.sql` first: in-window extension, outside-window stability, capped extension, stable replay/conflict, sealed behavior, invalid configuration and listing privacy.
- [ ] Add the migration: additive configuration/initial/cap columns; legacy values disabled; insert trigger for new defaults; replace only `place_bid` and latest `listing_json`, preserving existing behavior. Return safe timing fields only when auction eligibility permits.
- [ ] Verify actual SQL via the existing disposable Node26 backend CI; no pretend local PostgreSQL evidence.
- [ ] Commit the independently testable SQL change.

## Task 2: Server-sampled listing clock and disclosure

- [ ] Write unit tests for `src/lib/auction-clock.ts`: server sample plus monotonic elapsed, expired/equal/scheduled boundaries, invalid/stale samples and bounded RTT.
- [ ] Implement `AuctionClockSample`, `sampleAuctionClock(...)`, `readAuctionClock(...)` in that file. Hook/component lives in `src/components/auction-countdown.tsx`; it polls every 15 seconds, fails closed for bidding when stale, and cancels requests on unmount.
- [ ] Add optional timing fields to `Listing`; have the listing read API supply server time for demo fixtures too. Replace detail's browser-wall-clock timer with the new hook, without editing shared map code.
- [ ] Render RO/EN rule before the bid action, including hard cap and sealed/legacy fixed-close behavior. Static countdown text has no animation and no per-second live announcement.
- [ ] Browser tests mock timing read responses to prove extensions refresh, shifted client Date has no authority, and a stale/unavailable clock prevents misleading live bidding state.
- [ ] Run targeted units/lint first; then existing hosted build/browser/database/concurrency CI. Record exact final head, limits and next step on #35; open PR and hand off without self-merge.
