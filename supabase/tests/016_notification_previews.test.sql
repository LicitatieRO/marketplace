BEGIN;
SET search_path=public,extensions;
SELECT plan(22);
SELECT has_table('app','notification_previews','staging preview table exists');
SELECT ok(NOT has_table_privilege('anon','app.notification_previews','SELECT'),'anon cannot read previews');
SELECT ok(NOT has_table_privilege('authenticated','app.notification_previews','SELECT'),'authenticated cannot read previews');
SELECT ok(NOT has_table_privilege('anon','app.notification_previews','INSERT'),'anon cannot write previews');
SELECT ok(NOT has_table_privilege('authenticated','app.notification_previews','INSERT'),'authenticated cannot write previews');
SELECT has_function('public','store_notification_preview',ARRAY['bigint','uuid','text','text','text'],'store preview RPC exists');
SELECT ok(NOT has_function_privilege('anon','public.store_notification_preview(bigint,uuid,text,text,text)','EXECUTE'),'anon cannot store preview');
SELECT ok(NOT has_function_privilege('authenticated','public.store_notification_preview(bigint,uuid,text,text,text)','EXECUTE'),'authenticated cannot store preview');
SELECT ok(has_function_privilege('service_role','public.store_notification_preview(bigint,uuid,text,text,text)','EXECUTE'),'service worker can store preview');
SELECT ok(NOT has_function_privilege('anon','public.list_notification_previews(integer)','EXECUTE'),'anon cannot list previews');
SELECT ok(NOT has_function_privilege('authenticated','public.list_notification_previews(integer)','EXECUTE'),'authenticated cannot list previews');
SELECT ok(has_function_privilege('service_role','public.list_notification_previews(integer)','EXECUTE'),'service worker can list previews');
SET LOCAL ROLE anon;
SELECT throws_ok(
  $$SELECT public.store_notification_preview(1::bigint,gen_random_uuid(),'s'::text,'b'::text,NULL::text)$$,
  '42501',
  NULL,
  'anon store call denied'
);
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$SELECT public.store_notification_preview(1::bigint,gen_random_uuid(),'s'::text,'b'::text,NULL::text)$$,
  '42501',
  NULL,
  'authenticated store call denied'
);
SELECT throws_ok('SELECT public.list_notification_previews(10)','42501',NULL,'authenticated list call denied');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT throws_ok('SELECT * FROM app.notification_previews LIMIT 1','42501',NULL,'anon cannot select previews table');
SELECT throws_ok('SELECT public.list_notification_previews(10)','42501',NULL,'anon list call denied');
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT throws_ok('SELECT * FROM app.notification_previews LIMIT 1','42501',NULL,'authenticated cannot select previews table');
RESET ROLE;
UPDATE app.notification_outbox SET next_attempt_at=clock_timestamp()+interval '1 day' WHERE delivered_at IS NULL;
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES('88888888-0000-4000-8000-000000000001','preview-fixture@example.test',clock_timestamp()) ON CONFLICT (id) DO NOTHING;
INSERT INTO app.profiles(id) VALUES('88888888-0000-4000-8000-000000000001') ON CONFLICT (id) DO NOTHING;
CREATE TEMP TABLE preview_note AS WITH n AS(
  INSERT INTO app.notification_outbox(user_id,event,entity_id) VALUES('88888888-0000-4000-8000-000000000001','bid.placed',NULL) RETURNING id
) SELECT id FROM n;
CREATE TEMP TABLE preview_claim AS SELECT public.claim_notifications(50) j;
SELECT set_config('test.preview_id',(SELECT id::text FROM preview_note),true);
SELECT set_config('test.preview_lease',(SELECT j->0->>'lease_token' FROM preview_claim),true);
SET LOCAL ROLE service_role;
SELECT ok(public.store_notification_preview(
  current_setting('test.preview_id')::bigint,
  current_setting('test.preview_lease')::uuid,
  'Staging subject',
  'Staging body text',
  NULL::text
),'preview row stored under active lease');
SELECT ok(public.finish_notification(
  current_setting('test.preview_id')::bigint,
  current_setting('test.preview_lease')::uuid,
  true
),'outbox marked delivered after preview');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM app.notification_previews WHERE notification_id=current_setting('test.preview_id')::bigint),1,'exactly one preview row');
SELECT ok((SELECT delivered_at IS NOT NULL FROM app.notification_outbox WHERE id=current_setting('test.preview_id')::bigint),'outbox delivered_at set');
SELECT * FROM finish();
ROLLBACK;