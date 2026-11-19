# Sandbox payments and €10 / 7-day promotion (POC)

This milestone adds **test-mode or deterministic mock** checkout for listing promotions. It does **not** enable live billing, escrow, property deposits, or wallet balances.

## Environment variables

See `.env.example` for placeholder names. Only `sk_test_`, `pk_test_`, and test `whsec_` values are accepted. The application **fails closed** on `pk_live_` / `sk_live_` keys and on `STRIPE_MODE=live` / `STRIPE_LIVEMODE=1`.

| Variable | Purpose |
| --- | --- |
| `STRIPE_SECRET_KEY` | Server-only test secret (`sk_test_…`) |
| `STRIPE_WEBHOOK_SECRET` | Test webhook signing secret (`whsec_…`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Optional publishable test key if client UI needs it later |
| `PAYMENTS_MOCK_ENABLED` | Set to `true` (exact string) for deterministic mock checkout |

Without full test keys, the API returns **`503` `{ "error": "payments_unavailable" }`** unless `PAYMENTS_MOCK_ENABLED=true`. **Production** means `VERCEL_ENV=production` **or** (`VERCEL_ENV` unset/empty and `NODE_ENV=production`, e.g. `next start`). `VERCEL_ENV=preview` / `development` stay non-production. On non-production, mock is allowed when the flag is set (request host not checked). On production, mock requires the flag **and** allowlisted `APP_URL` hostname **and** a present, allowlisted request `Host` header (every checkout path must pass the header explicitly; `undefined`, `null`, or empty fail closed). Allowlist: `src/lib/payments/stripe-guard.ts` (`licitatiero-staging.vercel.app`, `localhost`, `127.0.0.1`; port stripped; exact match only).

Checkout uses **card-only** hosted Sessions (`allowed_payment_method_types: ['card']`) to avoid async payment methods without a webhook handler.

## Timing

| Layer | Value | Notes |
| --- | --- | --- |
| Stripe Checkout `expires_at` | now + **31 min** | Stripe’s minimum is 30 min; extra minute avoids latency `invalid_request_error` |
| DB pending `expires_at` | now + **35 min** | `prepare_property_promo` + `expire_property_promos` sweep; outlives the Session so abandonment is cancelled, not mismatch-rejected |

## API

| Route | Description |
| --- | --- |
| `POST /api/payments/promo/checkout` | Authenticated owner starts a €10 / 7-day **property-level** promo (covers linked sale + rent listings) |
| `POST /api/webhooks/stripe` | Verifies Stripe signatures on the raw body, rejects `livemode=true`, idempotent on `event.id` |

## Database (migration `202611140006_payments_ledger.sql`)

- `app.stripe_events` — webhook idempotency and livemode audit
- `app.ledger_entries` — append-only ledger (`stripe_test` \| `mock`), no card data
- `app.property_promos` — one active/pending window per physical property

## Server keys

`SUPABASE_SECRET_KEY` is the server-only Supabase **service role** key. Payments checkout and the Stripe webhook use it for promo RPCs; the notification cron worker uses the same secret pattern (not an end-user session key).

## Verification

```sh
npm ci
npm run lint && npm run typecheck && npm test
npm run security:scan && npm run build
npm run test:db   # requires local Supabase
```

Stripe test card `4242 4242 4242 4242` is documentation-only help for hosted Checkout in test mode; mock mode never collects PAN/CVV on LicitatieRO servers.