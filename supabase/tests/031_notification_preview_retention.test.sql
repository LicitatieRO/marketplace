BEGIN;
SET search_path = public, extensions;
SELECT plan(8);

SELECT has_table(
  'app',
  'notification_previews',
  'notification_previews table still exists after auto-delete off'
);

SELECT ok(
  NOT EXISTS (SELECT 1 FROM pg_catalog.pg_extension WHERE extname = 'pg_cron')
  OR NOT EXISTS (
    SELECT 1
    FROM cron.job AS j
    WHERE j.jobname = 'marketplace-purge-notification-previews'
  ),
  'no pg_cron job named marketplace-purge-notification-previews'
);

SELECT has_function(
  'public',
  'audit_notification_preview_link_reveal',
  ARRAY['uuid', 'bigint'],
  'audit_notification_preview_link_reveal exists'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.audit_notification_preview_link_reveal(uuid,bigint)',
    'EXECUTE'
  ),
  'anon cannot audit preview link reveal'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.audit_notification_preview_link_reveal(uuid,bigint)',
    'EXECUTE'
  ),
  'authenticated cannot audit preview link reveal'
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.audit_notification_preview_link_reveal(uuid,bigint)',
    'EXECUTE'
  ),
  'service_role can audit preview link reveal'
);

INSERT INTO auth.users(id, email, email_confirmed_at)
VALUES (
  '03103103-0000-4000-8000-000000000001',
  'retention-fixture@example.test',
  clock_timestamp()
) ON CONFLICT (id) DO NOTHING;
INSERT INTO app.profiles(id) VALUES ('03103103-0000-4000-8000-000000000001')
ON CONFLICT (id) DO NOTHING;

UPDATE app.notification_outbox
SET next_attempt_at = clock_timestamp() + interval '1 day'
WHERE delivered_at IS NULL;

CREATE TEMP TABLE retention_note AS
WITH n AS (
  INSERT INTO app.notification_outbox(user_id, event, entity_id)
  VALUES ('03103103-0000-4000-8000-000000000001', 'message.received', NULL)
  RETURNING id
)
SELECT id FROM n;

CREATE TEMP TABLE retention_claim AS
SELECT public.claim_notifications(50) j;

SELECT set_config(
  'test.retention_note_id',
  (SELECT id::text FROM retention_note),
  true
);
SELECT set_config(
  'test.retention_lease',
  (SELECT j->0->>'lease_token' FROM retention_claim),
  true
);

SET LOCAL ROLE service_role;
SELECT throws_ok(
  $$SELECT public.store_notification_preview(
    current_setting('test.retention_note_id')::bigint,
    current_setting('test.retention_lease')::uuid,
  'Action link guard',
  'Open https://supabase.example.test/auth/v1/verify?token=secret&redirect_to=https%3A%2F%2Flocalhost%2F',
  NULL::text)$$,
  'P0001',
  NULL,
  'action link preview rejected on generic store RPC'
);

SELECT throws_ok(
  $$SELECT public.store_notification_preview(
    current_setting('test.retention_note_id')::bigint,
    current_setting('test.retention_lease')::uuid,
  'Action link guard encoded',
  'Open https%3A%2F%2Fsupabase.example.test%2Fauth%2Fv1%2Fverify%3Ftoken_hash%3Dsecret',
  NULL::text)$$,
  'P0001',
  NULL,
  'percent-encoded action link rejected on generic store RPC'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;