# Confidential offer comparison

Owners can compare their sealed offers from the owner workspace. The table defaults to newest first and supports amount/time sorting in both directions. It shows profile display names, amounts and submission times. Sorting is read-only; it never declares a winner. The existing explicit selection controls remain below, and PostgreSQL still refuses reservation before closure and permits an owner to choose any sealed offer afterward.

`GET /api/auctions/:id/sealed-offers` uses the authenticated server client and `Cache-Control: no-store`. The new `get_sealed_offers(uuid)` RPC independently requires either the actual owner or a staff profile with AAL2. An invited bidder, other bidder, stranger, staff at AAL1, or anonymous caller cannot obtain this comparison. Unknown and unauthorized auction IDs receive the same safe denial. The RPC returns only bid ID, display name (at most100characters), amount and timestamp; no emails, addresses or identity documents. Existing bidder workspace access to one's own offer remains unchanged.

This STABLE read RPC checks the verified Auth user without calling the existing write-oriented `app.require_user()` helper, which locks the profile row. PostgREST executes STABLE functions in read-only transactions; the new regression044 explicitly tests that mode. Write operations continue using their existing locking helpers.

Comparison while an auction is open preserves the existing owner workspace policy. The table loads on mount and has an explicit refresh button; it does not promise live updates. A failed/access-denied refresh clears previous rows and never substitutes a zero amount. It offers RO/EN text, native labeled sorting, table headers/caption, keyboard-focusable horizontal scrolling and inherited light/dark colors. Existing selection cards are intentionally preserved as the separate action surface. Staff access is available through the guarded API; no new staff dashboard is added.

Run targeted units and then existing local-backend/CI verification:

```sh
npx --no-install vitest run tests/unit/sealed-offers.test.ts tests/unit/sealed-offers-route.test.ts
E2E_BACKEND=1 npm run test:e2e:backend -- tests/e2e/sealed-comparison.spec.ts
npm run test:db
```

The browser test uses separate owner/bidder sessions and new per-project properties; it checks real API403, public amount privacy, owner sorting and clearing on a simulated403 refresh. Desktop uses RO/light, mobile uses EN/dark. pgTAP separately checks actual owner/staff/bidder/anonymous authorization and a lower sealed-offer selection after closure. Unit tests reject malformed amounts instead of silently rendering0.

Migration037 adds only this read RPC and its grants. It does not require soft-close migration036, but PM must coordinate ascending migration merge/deploy order. Follow the existing reviewed delivery process; agents do not apply migrations to hosted projects. Rolling back the UI leaves existing sealed-offer/selection behavior intact. Live deposits remain disabled.
