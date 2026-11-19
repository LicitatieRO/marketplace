# Saved searches and generic alerts (POC)

`/saved-searches` supports verified-account save/list/delete without changing catalogue or workspace ownership. Query parameters can prefill the form: `transaction_type=sale|rent`, `judet`, `neighborhood`, `min_price`, `max_price` (EUR), `min_rooms`. Invalid query filters show a review notice before saving. Rental budgets are monthly, sale budgets are totals. The page is linked in navigation/footer and supports RO/EN and inherited light/dark styles. It does not automatically change the catalogue's independent filter controls.

Filters match only public listing fields. Exact address, sealed bid amounts, identity details, and caller-supplied ownership are rejected. Owner-only RLS protects stored names/filters; writes go through dedicated authenticated RPCs and same-origin server endpoints. The private app schema remains unavailable directly; tests temporarily grant schema usage inside their rollback-only transaction to exercise RLS separately. The read RPC does not use a locking writer helper, so it remains compatible with PostgREST read-only transactions. A switched account cannot keep the prior account's rows or unsaved form name. Sign-in preserves the validated filter link through the internal return-path allowlist.

## Bounds and delivery

These are reversible POC defaults for PM review, not a paid plan:

- Five active searches per account;1,000total. Inserts enforce both limits; a duplicate filter payload updates the same search even at capacity. A full prototype returns an explicit error instead of silently truncating matching recipients.
- At most one queued alert per search per hour and five queued search alerts per account per hour. The account budget survives deleting/recreating a search. Changes blocked by a cooldown/budget are not deferred individual emails; users receive a generic update link and can review current listings.
- Trigger fanout is serialized with saved-search CRUD/capacity checks using a single transaction advisory lock and at most1,000active searches. This is a POC throughput bound, not a claim about500+WAU capacity; measure lock wait/fanout time before increasing it. No property lock is acquired after this lock by these functions.
- Verified email is checked at save, alert enqueue, and delivery claim. Deleting a search removes its pending alerts; in-flight provider sends may already be underway. Claiming also requires a current subscription. Existing other notification events retain their prior behavior.

Only an actual price/status change can trigger alerts. Matching either the old or new public snapshot covers price movements out of a budget and closing a published listing. Enqueue plus cooldown/account-budget updates occur in the same transaction as the listing change and roll back together. Replayed/no-op changes do not create duplicate rows. No email provider is called from these locks.

`search.updated` email is bilingual and generic, links only to the workspace, and contains no filter values, amounts, addresses or recipient details in its body. Delivery follows the existing POC outbox schedule and may be delayed. Tests use the preview transport and never send real mail.

## Verification / recovery

```sh
npx --no-install vitest run tests/unit/saved-searches.test.ts tests/unit/saved-searches-route.test.ts tests/unit/search-notifications.test.ts
E2E_BACKEND=1 npm run test:e2e:backend -- tests/e2e/saved-searches.spec.ts
npm run test:db
```

pgTAP045 covers RLS, verified recipients, replay, no-op/cooldown, rollback, old/new matching, status changes, account budget, exact global capacity and deletion cleanup. Backend browser cases use separate owner/buyer sessions and unique per-project neighborhoods; they exercise persistence and a real price change. Manual visual/contrast review remains separate.

Migration038 is independent of036/037 business logic but PM must coordinate ascending migration order. It replaces the existing leased `claim_notifications` function only to add verification/subscription conditions for search alerts; limits, leases, retry behavior and grants stay unchanged. Agents do not migrate hosted databases. Roll back the UI separately if needed; an operator can disable the new trigger for incident recovery, preserving stored searches and existing outbox records rather than dropping user data. Live deposits remain disabled.
