# Staging founder staff access (notification outbox)

**Staging only.** Supabase project `<STAGING_PROJECT_REF>` — never run these steps on production.

This runbook grants the founder read-only access to `/founder/outbox` on **licitatiero-staging.vercel.app**. There is no seeded staff user, no shared passwords, no AAL2 bypass, and agents must never execute these steps. This is manual operational SQL in the Supabase SQL editor, **not** a migration.

## Prerequisites

- Florentin has a normal staging account (email verification completed via sign-up on staging).
- Staging app env includes `EMAIL_DELIVERY_MODE=staging_outbox` so undelivered mail is visible in the outbox.
- Optional: `STAGING_SIGNUP_LINK_ENABLED=true` (lowercase `true` only) with the same delivery mode stores sign-up confirmation links in the outbox instead of Supabase email.

## Demo catalogue seed on hosted databases

Migrations define `app.seed_demo_fixture()` and `app.ensure_demo_auth_user()`, but they **raise** unless the session sets `app.allow_demo_seed` to `on` (for example `SELECT set_config('app.allow_demo_seed', 'on', true);` immediately before calling the seed in the same transaction). Local `supabase db reset` sets this in `supabase/seed.sql`. **Staging** may use the same pattern for a deliberate catalogue refresh in the SQL editor; **production never sets this marker**.

## Grant staff (one-time, idempotent)

Run in the **staging** Supabase SQL editor (service role / SQL editor context). Replace the email placeholder with Florentin’s staging login email.

```sql
UPDATE app.profiles AS p
SET is_staff = true
FROM auth.users AS u
WHERE p.id = u.id
  AND lower(u.email) = lower('founder-email@example.com');
```

## Verify

```sql
SELECT p.id, u.email, p.is_staff, p.display_name
FROM app.profiles AS p
JOIN auth.users AS u ON u.id = p.id
WHERE lower(u.email) = lower('founder-email@example.com');
```

Expect `is_staff = true` for that row.

## Revoke

```sql
UPDATE app.profiles AS p
SET is_staff = false
FROM auth.users AS u
WHERE p.id = u.id
  AND lower(u.email) = lower('founder-email@example.com');
```

## MFA and using the outbox

1. Open **/account** on staging while signed in as the founder.
2. In **Account security**, enroll **TOTP** (QR) and complete verification so the session reaches **AAL2** (existing `AccountSecurity` flow).
3. Visit **/founder/outbox** at AAL2. Without staff **and** AAL2 the route returns 404 and metadata stays generic. When sign-up link staging is enabled, copy the confirmation URL from the preview body for new accounts.

Do not disable MFA requirements, paste service-role keys into the browser, or run grant SQL from CI/agents.

Calling Supabase Auth `mfa.unenroll` directly (outside `/api/mfa`) bypasses the app’s staff last-factor guard but still requires an authenticated session and, for verified factors, AAL2—so it is self-DoS only (staff lose privileged access until they re-enroll).
