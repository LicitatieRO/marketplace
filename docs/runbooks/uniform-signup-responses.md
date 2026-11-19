# Uniform signup responses (account enumeration hardening)

After issue #95, `POST /api/auth` with `action: signup` returns **HTTP 200** and the same generic body when email and password pass application validation, whether the address is new or already registered. **GoTrue password policy failures** (`weak_password`) return **HTTP 400** with a neutral message (`Choose a stronger password.`) and do not reveal account existence when policy is checked before user lookup (verified on the local CI Supabase stack).

## Timing note

GoTrue has an inherent new-vs-duplicate latency gap (~49 ms observed for the duplicate error on the CI stack) that the application cannot remove; only the primary `signUp` / `generateLink(signup)` call is awaited before the uniform 200.

## What operators see

- Browsers and API clients usually get: `{"data":{"message":"Check your email to verify your account before bidding."}}` (same `Cache-Control: no-store` headers).
- **Validation failures** (malformed email, short password, Zod errors, GoTrue `weak_password` when applicable) return **HTTP 400** — they do not reveal account existence.
- Login, recover, reset, and logout behavior is unchanged.

## Spotting backend failures in logs

Structured server logs use the prefix `Signup handling` with **no raw email**. Look up issues by `emailHash` (HMAC-SHA256 of the normalized address, keyed by `SUPABASE_SECRET_KEY` or `CRON_SECRET`).

If neither secret is configured, a one-time warning `signup_log_hmac_fallback` is logged and a built-in fallback key is used — **rotating `SUPABASE_SECRET_KEY` or `CRON_SECRET` breaks correlation** of `emailHash` values across log lines before and after rotation.

| `event` | Typical `reason` | Meaning |
| --- | --- | --- |
| `standard_signup` | GoTrue `code` | Non-duplicate `signUp` failure (logged; HTTP still 200). |
| `standard_signup_notice_failed` | `recover_*` | Out-of-band notice (`resetPasswordForEmail`) failed in `after()`. |
| `staging_signup_generate_link` | admin `generateLink` code | Staging signup link step did not yield a new user. |
| `staging_signup_preview` | `store_failed`, etc. | Staging outbox preview store failed. |
| `staging_existing_account_notice_failed` | `user_not_found`, `store_failed` | Token-free existing-account preview in `after()` failed. |
| `signup_log_hmac_fallback` | `server_secret_unavailable` | HMAC uses fallback key; rotate secrets with care (see above). |

Staging with `STAGING_SIGNUP_LINK_ENABLED=true` and `EMAIL_DELIVERY_MODE=staging_outbox` still writes **new-user** confirmation previews to the founder outbox; existing-address attempts may add a **token-free** preview body only (no magic link).

The **hosted-staging GoTrue probe** (HIBP and character-class rules) is a **pre-production** check tracked on [issue #111](https://github.com/LicitatieRO/marketplace/issues/111). Do not run it against hosted staging from CI or cloud agents.

## Staging founder outbox

See [staging-founder-staff.md](./staging-founder-staff.md) for staff access. Sign-up confirmations for **new** staging users still appear in `/founder/outbox` when the staging sign-up link gate is on.
