BEGIN;
SET search_path=public,extensions;
SELECT plan(12);

SELECT has_function(
  'public',
  'store_staging_recovery_notification_preview',
  ARRAY['uuid','text','text','text'],
  'staging recovery preview RPC exists'
);
SELECT ok(
  NOT has_function_privilege('public','public.store_staging_recovery_notification_preview(uuid,text,text,text)','EXECUTE'),
  'PUBLIC cannot store staging recovery preview'
);
SELECT ok(
  NOT has_function_privilege('anon','public.store_staging_recovery_notification_preview(uuid,text,text,text)','EXECUTE'),
  'anon cannot store staging recovery preview'
);
SELECT ok(
  NOT has_function_privilege('authenticated','public.store_staging_recovery_notification_preview(uuid,text,text,text)','EXECUTE'),
  'authenticated cannot store staging recovery preview'
);
SELECT ok(
  has_function_privilege('service_role','public.store_staging_recovery_notification_preview(uuid,text,text,text)','EXECUTE'),
  'service_role can store staging recovery preview'
);

SET LOCAL ROLE anon;
SELECT throws_ok(
  $$SELECT public.store_staging_recovery_notification_preview('88888888-0000-4000-8000-000000000003','LicitatieRO — resetează parola / reset your password','body','recovery-preview@example.test')$$,
  '42501',
  NULL,
  'anon store call denied'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$SELECT public.store_staging_recovery_notification_preview('88888888-0000-4000-8000-000000000003','LicitatieRO — resetează parola / reset your password','body','recovery-preview@example.test')$$,
  '42501',
  NULL,
  'authenticated store call denied'
);
RESET ROLE;

INSERT INTO auth.users(id,email) VALUES('88888888-0000-4000-8000-000000000003','recovery-preview@example.test') ON CONFLICT (id) DO NOTHING;
INSERT INTO app.profiles(id) VALUES('88888888-0000-4000-8000-000000000003') ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE service_role;
SELECT throws_ok(
  $$SELECT public.store_staging_recovery_notification_preview('88888888-0000-4000-8000-000000000003','bid.placed template','body','recovery-preview@example.test')$$,
  'P0001',
  NULL,
  'rejects non-recovery preview subject'
);
SELECT ok(
  public.store_staging_recovery_notification_preview(
    '88888888-0000-4000-8000-000000000003',
    'LicitatieRO — resetează parola / reset your password',
    E'Reset password\nhttp://localhost:3000/auth/callback?token_hash=test&type=recovery',
    'recovery-preview@example.test'
  ),
  'recovery preview stored'
);
RESET ROLE;

SELECT is(
  (SELECT event FROM app.notification_outbox WHERE user_id='88888888-0000-4000-8000-000000000003' ORDER BY id DESC LIMIT 1),
  'auth.password_recovery',
  'outbox event is password recovery'
);
SELECT is(
  (SELECT count(*)::integer FROM app.notification_previews p
   JOIN app.notification_outbox n ON n.id=p.notification_id
   WHERE n.user_id='88888888-0000-4000-8000-000000000003' AND n.event='auth.password_recovery'),
  1,
  'exactly one recovery preview row'
);
SELECT ok(
  (SELECT recipient_email = 'recovery-preview@example.test' FROM app.notification_previews p
   JOIN app.notification_outbox n ON n.id=p.notification_id
   WHERE n.user_id='88888888-0000-4000-8000-000000000003' AND n.event='auth.password_recovery'
   LIMIT 1),
  'preview stores recovery recipient email'
);

SELECT * FROM finish();
ROLLBACK;
