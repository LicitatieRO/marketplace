# Staging notification previews

This is a verification guide for the already implemented outbox preview mode, not evidence of a live email send. It requires no Resend API key, sender DNS or paid email service. It never proves a message reached an external inbox.

## Current configuration

The implemented flag is `EMAIL_DELIVERY_MODE=staging_outbox`; the original issue's proposed `NOTIFICATION_SANDBOX=1` is not a supported alternative. On a production runtime, preview mode additionally requires an allowlisted staging application URL and matching request host. Keep these restrictions; do not enable previews on an arbitrary production domain.

Configure `APP_URL` to the actual approved staging origin and `EMAIL_DELIVERY_MODE=staging_outbox` in that project's secure settings. The worker also needs server-only `SUPABASE_SECRET_KEY` and `CRON_SECRET`, and the reviewed notification-preview migrations must be applied. Leave Resend credentials unset for this check. Keep secret values out of Git, browser URLs, screenshots and issue comments.

The project's dedicated staging Vercel project deploys its own production target, so `VERCEL_ENV=production` does not by itself identify a real production marketplace. The explicit staging-host allowlist is required there. Local non-production mode can default to outbox previews without Resend, as covered by the delivery-mode tests.

## Authorized staging check

1. Confirm this is the isolated staging project and use disposable test accounts/resources. Perform a normal test action that enqueues a generic notification, such as a message or bid. Do not fabricate a real payment or use another person's data.
2. An authorized operator invokes the protected notification worker through the approved secure mechanism. Do not send the cron secret to a third-party tool or include it in a query string. Record only the response counts and `delivery_mode`.
3. Expect `delivery_mode: staging_outbox`. The `sent` count means **successfully stored preview and acknowledged outbox work**, not delivery by Resend. A successful preview is stored before the worker finalizes that notification. Failed storage remains retryable; an invalid/stale lease must not be counted as sent.
4. Sign in as an approved staff account at AAL2 and inspect `/founder/outbox`. Ordinary users, signed-out visitors and staff at AAL1 must not see these previews. Recipient addresses are masked; existing recovery/action-link reveal controls remain separate and audited. Verify the preview uses RO/EN generic notification copy and the simulation disclosure, with no bid amounts, exact addresses or private message contents.
5. A repeated invocation must not produce duplicate preview records for the same notification. Database tests in `016_notification_previews.test.sql` cover lease and idempotency rules; the route unit tests use a mocked RPC boundary and do not establish physical database locking or hosted authorization.
6. On a non-allowlisted production host, with no Resend credentials, the worker must return503 before claiming/finalizing notifications. An invalid cron authorization must return401. Neither case is an invitation to relax the host/secret guards.

Record the staging commit, redacted counts, observed staff access results and any discrepancy on the issue. Do not record recipients, rendered private content, action-link tokens or secrets. UI/access steps remain unverified until actually performed by an authorized operator.

## Automated local verification

`npm test -- --run tests/unit/notifications-sandbox-route.test.ts` exercises a nonempty leased row through the real route and notification functions while replacing only RPC/network boundaries. It verifies store-before-ack ordering, generic bilingual copy, retry and stale accounting, authorization/host rejection, and zero Resend transport calls. Existing notification unit tests cover mode selection; pgTAP covers preview permissions and leases.
