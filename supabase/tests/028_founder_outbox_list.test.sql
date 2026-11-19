BEGIN;
SET search_path = public, extensions;
SELECT plan(5);

INSERT INTO auth.users(id, email, email_confirmed_at)
VALUES (
  '02802802-0000-4000-8000-000000000001',
  'outbox-list-raw@example.test',
  clock_timestamp()
) ON CONFLICT (id) DO NOTHING;
INSERT INTO app.profiles(id) VALUES ('02802802-0000-4000-8000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users(id, email, email_confirmed_at)
VALUES (
  '02802802-0000-4000-8000-000000000002',
  'outbox-list-buyer@example.test',
  clock_timestamp()
) ON CONFLICT (id) DO NOTHING;
INSERT INTO app.profiles(id) VALUES ('02802802-0000-4000-8000-000000000002')
ON CONFLICT (id) DO NOTHING;

UPDATE app.notification_outbox
SET next_attempt_at = clock_timestamp() + interval '1 day'
WHERE delivered_at IS NULL;

CREATE TEMP TABLE outbox_note AS
WITH n AS (
  INSERT INTO app.notification_outbox(user_id, event, entity_id)
  VALUES ('02802802-0000-4000-8000-000000000001', 'message.received', NULL)
  RETURNING id
)
SELECT id FROM n;

CREATE TEMP TABLE outbox_claim AS
SELECT public.claim_notifications(50) j;

SELECT set_config(
  'test.outbox_note_id',
  (SELECT id::text FROM outbox_note),
  true
);
SELECT set_config(
  'test.outbox_lease',
  (SELECT j->0->>'lease_token' FROM outbox_claim),
  true
);

SET LOCAL ROLE service_role;
SELECT ok(
  public.store_notification_preview(
    current_setting('test.outbox_note_id')::bigint,
    current_setting('test.outbox_lease')::uuid,
    'Outbox list fixture subject',
    'Outbox list fixture body',
    'outbox-list-raw@example.test'::text
  ),
  'preview row stored for list RPC fixture'
);
RESET ROLE;

SET LOCAL ROLE service_role;
SELECT is(
  (
    SELECT elem->>'recipient_email'
    FROM jsonb_array_elements(public.list_notification_previews(20)) AS elem
    WHERE elem->>'subject' = 'Outbox list fixture subject'
  ),
  'o***@example.test',
  'list_notification_previews returns masked recipient email'
);
SELECT ok(
  (
    SELECT count(*)::integer
    FROM jsonb_array_elements(public.list_notification_previews(20)) AS elem
    WHERE elem->>'subject' = 'Outbox list fixture subject'
      AND elem->>'recipient_email' = 'outbox-list-raw@example.test'
  ) = 0,
  'list_notification_previews never returns raw recipient email'
);
RESET ROLE;

SET LOCAL ROLE anon;
SELECT throws_ok(
  'SELECT public.list_notification_previews(10)',
  '42501',
  NULL,
  'anon cannot list notification previews'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"02802802-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
SELECT throws_ok(
  'SELECT public.list_notification_previews(10)',
  '42501',
  NULL,
  'buyer cannot list notification previews'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;