# Public listing comparison

Open `/compare` to choose2–3published listings using native keyboard-accessible selectors. Links may use comma-separated/repeated `ids`, or `property` for linked sale/rent listings, for example `/compare?property=10000000-0000-4000-8000-000000000001` in the demo/local seed. Duplicate selections are deduplicated; invalid/mixed/oversized queries show a safe notice. Unpublished/unavailable records are omitted with a notice; at least two public records are required for a table.

The server-only loader projects an explicit public DTO before any props reach the browser, including for a signed-in owner. It excludes owner IDs, exact address, description, tour URLs, bid counts/amounts and raw schedule timestamps. Invitation-only timing remains hidden regardless of source-viewer privileges. Valid EUR listing prices are required; invalid prices are excluded rather than rendered as zero. Public occupancy disclosure is included.

Sale prices are totals, rental prices are monthly. Linked sale/rent columns are marked as the same physical property. Auction state is a server-time capture of the published schedule, labeled as a snapshot; it is never a bid-eligibility guarantee. Users follow the listing link for current terms/timing. There is no return/yield calculation or promise.

Interface text supports RO/EN and inherited light/dark colors. The table has row/column headers, caption, and a focusable horizontal-scroll region on narrow screens. This route is self-contained; catalogue, workspace and global navigation are intentionally untouched while other agents own those files. A later navigation/link integration can use the documented query format.

```sh
npx --no-install vitest run tests/unit/listing-comparison.test.ts tests/unit/comparison-snapshot.test.ts
npm run test:e2e -- tests/e2e/listing-comparison.spec.ts
```

Data-boundary units inject private fields and elevated-viewer timing. Existing CI builds the demo and runs browser cases against an isolated local Supabase backend, covering linked property, native selection, RO/light desktop, EN/dark mobile, invalid input and document width. The browser command above can also target the local demo; CI does not run a separate demo browser matrix. Manual visual/contrast review remains separate. No database/provider/paid-map/live-money change.
