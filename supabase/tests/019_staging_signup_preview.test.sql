BEGIN;
SET search_path=public,extensions;
SELECT plan(12);

SELECT has_function(
  'public',
  'store_staging_signup_notification_preview',
  ARRAY['uuid','text','text','text'],
  'staging signup preview RPC exists'
);
SELECT ok(
  NOT has_function_privilege('public','public.store_staging_signup_notification_preview(uuid,text,text,text)','EXECUTE'),
  'PUBLIC cannot store staging signup preview'
);
SELECT ok(
  NOT has_function_privilege('anon','public.store_staging_signup_notification_preview(uuid,text,text,text)','EXECUTE'),
  'anon cannot store staging signup preview'
);
SELECT ok(
  NOT has_function_privilege('authenticated','public.store_staging_signup_notification_preview(uuid,text,text,text)','EXECUTE'),
  'authenticated cannot store staging signup preview'
);
SELECT ok(
  has_function_privilege('service_role','public.store_staging_signup_notification_preview(uuid,text,text,text)','EXECUTE'),
  'service_role can store staging signup preview'
);

SET LOCAL ROLE anon;
SELECT throws_ok(
  $$SELECT public.store_staging_signup_notification_preview('88888888-0000-4000-8000-000000000002','LicitatieRO — confirmă contul / confirm your account','body','signup-preview@example.test')$$,
  '42501',
  NULL,
  'anon store call denied'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$SELECT public.store_staging_signup_notification_preview('88888888-0000-4000-8000-000000000002','LicitatieRO — confirmă contul / confirm your account','body','signup-preview@example.test')$$,
  '42501',
  NULL,
  'authenticated store call denied'
);
RESET ROLE;

INSERT INTO auth.users(id,email) VALUES('88888888-0000-4000-8000-000000000002','signup-preview@example.test') ON CONFLICT (id) DO NOTHING;
INSERT INTO app.profiles(id) VALUES('88888888-0000-4000-8000-000000000002') ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE service_role;
SELECT throws_ok(
  $$SELECT public.store_staging_signup_notification_preview('88888888-0000-4000-8000-000000000002','bid.placed template','body','signup-preview@example.test')$$,
  'P0001',
  NULL,
  'rejects non-signup confirmation subject'
);
SELECT ok(
  public.store_staging_signup_notification_preview(
    '88888888-0000-4000-8000-000000000002',
    'LicitatieRO — confirmă contul / confirm your account',
    E'Confirm signup\nhttps://auth.example.test/verify?token=test',
    'signup-preview@example.test'
  ),
  'signup confirmation preview stored'
);
RESET ROLE;

SELECT is(
  (SELECT event FROM app.notification_outbox WHERE user_id='88888888-0000-4000-8000-000000000002' ORDER BY id DESC LIMIT 1),
  'auth.signup_confirm',
  'outbox event is signup confirmation only'
);
SELECT is(
  (SELECT count(*)::integer FROM app.notification_previews p
   JOIN app.notification_outbox n ON n.id=p.notification_id
   WHERE n.user_id='88888888-0000-4000-8000-000000000002' AND n.event='auth.signup_confirm'),
  1,
  'exactly one signup preview row'
);
SELECT ok(
  (SELECT recipient_email = 'signup-preview@example.test' FROM app.notification_previews p
   JOIN app.notification_outbox n ON n.id=p.notification_id
   WHERE n.user_id='88888888-0000-4000-8000-000000000002' AND n.event='auth.signup_confirm'
   LIMIT 1),
  'preview stores signup recipient email'
);

SELECT * FROM finish();
ROLLBACK;