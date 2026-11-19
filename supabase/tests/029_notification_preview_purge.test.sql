BEGIN;
SET search_path = public, extensions;
SELECT plan(6);

SELECT has_function(
  'public',
  'purge_notification_previews_older_than_30_days',
  ARRAY[]::text[],
  'purge_notification_previews_older_than_30_days exists'
);

INSERT INTO auth.users(id, email, email_confirmed_at)
VALUES
  ('02902902-0000-4000-8000-000000000001', 'purge-old@example.test', clock_timestamp()),
  ('02902902-0000-4000-8000-000000000002', 'purge-new@example.test', clock_timestamp())
ON CONFLICT (id) DO NOTHING;

INSERT INTO app.profiles(id)
VALUES
  ('02902902-0000-4000-8000-000000000001'),
  ('02902902-0000-4000-8000-000000000002')
ON CONFLICT (id) DO NOTHING;

CREATE TEMP TABLE purge_old_note AS
WITH n AS (
  INSERT INTO app.notification_outbox(user_id, event, entity_id)
  VALUES ('02902902-0000-4000-8000-000000000001', 'message.received', NULL)
  RETURNING id
)
SELECT id FROM n;

CREATE TEMP TABLE purge_new_note AS
WITH n AS (
  INSERT INTO app.notification_outbox(user_id, event, entity_id)
  VALUES ('02902902-0000-4000-8000-000000000002', 'message.received', NULL)
  RETURNING id
)
SELECT id FROM n;

INSERT INTO app.notification_previews(notification_id, subject, body, created_at)
VALUES
  (
    (SELECT id FROM purge_old_note),
    'Purge fixture old',
    'Old body',
    clock_timestamp() - interval '31 days'
  ),
  (
    (SELECT id FROM purge_new_note),
    'Purge fixture new',
    'New body',
    clock_timestamp() - interval '1 day'
  );

SET LOCAL ROLE service_role;
SELECT is(
  public.purge_notification_previews_older_than_30_days(),
  1::bigint,
  'purge deletes exactly one preview older than 30 days'
);
RESET ROLE;

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM app.notification_previews
    WHERE subject = 'Purge fixture old'
  ),
  'preview older than 30 days removed'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM app.notification_previews
    WHERE subject = 'Purge fixture new'
  ),
  'preview newer than 30 days kept'
);

SET LOCAL ROLE anon;
SELECT throws_ok(
  'SELECT public.purge_notification_previews_older_than_30_days()',
  '42501',
  NULL,
  'anon purge call denied'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"02902902-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
SELECT throws_ok(
  'SELECT public.purge_notification_previews_older_than_30_days()',
  '42501',
  NULL,
  'buyer purge call denied'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;