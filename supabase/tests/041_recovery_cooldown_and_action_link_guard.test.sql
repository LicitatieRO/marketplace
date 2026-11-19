BEGIN;
SET search_path=public,extensions;
SELECT plan(14);

SELECT has_function(
  'public',
  'recovery_generate_link_cooldown_active',
  ARRAY['text'],
  'recovery cooldown RPC exists'
);
SELECT ok(
  NOT has_function_privilege('public','public.recovery_generate_link_cooldown_active(text)','EXECUTE'),
  'PUBLIC cannot check recovery cooldown'
);
SELECT ok(
  NOT has_function_privilege('anon','public.recovery_generate_link_cooldown_active(text)','EXECUTE'),
  'anon cannot check recovery cooldown'
);
SELECT ok(
  NOT has_function_privilege('authenticated','public.recovery_generate_link_cooldown_active(text)','EXECUTE'),
  'authenticated cannot check recovery cooldown'
);
SELECT ok(
  has_function_privilege('service_role','public.recovery_generate_link_cooldown_active(text)','EXECUTE'),
  'service_role can check recovery cooldown'
);

SELECT ok(
  app.preview_body_contains_action_link(
    E'https://app.example.test/auth/callback?token_hash=abc&type=recovery'
  ),
  'action link guard matches token_hash callback URLs'
);
SELECT ok(
  NOT app.preview_body_contains_action_link(
    E'https://app.example.test/auth/callback?type=recovery'
  ),
  'callback without token_hash is not an action link'
);
SELECT ok(
  NOT app.preview_body_contains_action_link('plain text body'),
  'plain bodies are not action links'
);
SELECT ok(
  app.preview_body_contains_action_link(
    E'https://supabase.example.test/auth/v1/verify?token=abc'
  ),
  'verify links still match'
);

INSERT INTO auth.users(id,email) VALUES('88888888-0000-4000-8000-000000000004','cooldown@example.test') ON CONFLICT (id) DO NOTHING;
INSERT INTO app.profiles(id) VALUES('88888888-0000-4000-8000-000000000004') ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE service_role;
SELECT ok(
  NOT public.recovery_generate_link_cooldown_active('cooldown@example.test'),
  'no cooldown before first recovery preview'
);
SELECT ok(
  public.store_staging_recovery_notification_preview(
    '88888888-0000-4000-8000-000000000004',
    'LicitatieRO — resetează parola / reset your password',
    E'Reset\nhttp://localhost:3000/auth/callback?token_hash=x',
    'cooldown@example.test'
  ),
  'seed recovery preview for cooldown'
);
SELECT ok(
  public.recovery_generate_link_cooldown_active('cooldown@example.test'),
  'cooldown active within 60s after preview'
);
RESET ROLE;

UPDATE app.notification_previews
SET created_at = clock_timestamp() - interval '2 minutes'
WHERE notification_id IN (
  SELECT id FROM app.notification_outbox
  WHERE user_id = '88888888-0000-4000-8000-000000000004'
    AND event = 'auth.password_recovery'
);

SET LOCAL ROLE service_role;
SELECT ok(
  NOT public.recovery_generate_link_cooldown_active('cooldown@example.test'),
  'cooldown expires after window'
);
RESET ROLE;

SET LOCAL ROLE anon;
SELECT throws_ok(
  $$SELECT public.recovery_generate_link_cooldown_active('cooldown@example.test')$$,
  '42501',
  NULL,
  'anon cooldown check denied'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
