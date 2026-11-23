BEGIN;
SET search_path = public, extensions;
SELECT plan(11);

SELECT has_function(
  'public',
  'audit_mfa_factor_unenrolled',
  ARRAY['uuid', 'uuid'],
  'audit_mfa_factor_unenrolled(uuid, uuid) exists'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'audit_mfa_factor_unenrolled'
      AND pg_get_function_identity_arguments(p.oid) = 'p_factor_id uuid'
  ),
  'legacy one-argument signature removed'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.audit_mfa_factor_unenrolled(uuid, uuid)',
    'EXECUTE'
  ),
  'anon cannot audit MFA unenroll'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.audit_mfa_factor_unenrolled(uuid, uuid)',
    'EXECUTE'
  ),
  'authenticated cannot audit MFA unenroll'
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.audit_mfa_factor_unenrolled(uuid, uuid)',
    'EXECUTE'
  ),
  'service_role can audit MFA unenroll'
);

INSERT INTO auth.users(id, email, email_confirmed_at)
VALUES
  (
    'aaaaaaaa-0000-4000-8000-000000000010',
    'mfa-sr-a@example.test',
    clock_timestamp()
  ),
  (
    'bbbbbbbb-0000-4000-8000-000000000011',
    'mfa-sr-b@example.test',
    clock_timestamp()
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO app.profiles(id, display_name)
VALUES
  ('aaaaaaaa-0000-4000-8000-000000000010', 'MFA SR A'),
  ('bbbbbbbb-0000-4000-8000-000000000011', 'MFA SR B')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.mfa_factors (
  id,
  user_id,
  friendly_name,
  factor_type,
  status,
  secret,
  created_at,
  updated_at
)
VALUES (
  'cccccccc-0000-4000-8000-000000000030'::uuid,
  'aaaaaaaa-0000-4000-8000-000000000010'::uuid,
  'SR factor A',
  'totp',
  'verified',
  'AAAAAAAAAAAAAAAA',
  clock_timestamp(),
  clock_timestamp()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.mfa_factors (
  id,
  user_id,
  friendly_name,
  factor_type,
  status,
  secret,
  created_at,
  updated_at
)
VALUES (
  'dddddddd-0000-4000-8000-000000000040'::uuid,
  'bbbbbbbb-0000-4000-8000-000000000011'::uuid,
  'SR factor B',
  'totp',
  'verified',
  'BBBBBBBBBBBBBBBB',
  clock_timestamp(),
  clock_timestamp()
)
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub',
    'aaaaaaaa-0000-4000-8000-000000000010',
    'role',
    'authenticated'
  )::text,
  true
);

SELECT throws_ok(
  $$SELECT public.audit_mfa_factor_unenrolled(
    'aaaaaaaa-0000-4000-8000-000000000010'::uuid,
    'eeeeeeee-0000-4000-8000-000000000050'::uuid
  )$$,
  '42501',
  NULL,
  'authenticated call denied without execute grant'
);

RESET ROLE;

SET LOCAL ROLE anon;
SELECT throws_ok(
  $$SELECT public.audit_mfa_factor_unenrolled(
    'aaaaaaaa-0000-4000-8000-000000000010'::uuid,
    'eeeeeeee-0000-4000-8000-000000000050'::uuid
  )$$,
  '42501',
  NULL,
  'anon call denied without execute grant'
);

RESET ROLE;

SET LOCAL ROLE service_role;

SELECT throws_ok(
  $$SELECT public.audit_mfa_factor_unenrolled(
    'aaaaaaaa-0000-4000-8000-000000000010'::uuid,
    'cccccccc-0000-4000-8000-000000000030'::uuid
  )$$,
  'P0001',
  'Factor still enrolled',
  'service_role rejects audit while factor still enrolled'
);

SELECT throws_ok(
  $$SELECT public.audit_mfa_factor_unenrolled(
    'aaaaaaaa-0000-4000-8000-000000000010'::uuid,
    'dddddddd-0000-4000-8000-000000000040'::uuid
  )$$,
  '42501',
  'Factor not owned by user',
  'service_role rejects another user enrolled factor'
);

RESET ROLE;

DELETE FROM auth.mfa_factors
WHERE id = 'cccccccc-0000-4000-8000-000000000030'::uuid;

SET LOCAL ROLE service_role;

SELECT lives_ok(
  $$SELECT public.audit_mfa_factor_unenrolled(
    'aaaaaaaa-0000-4000-8000-000000000010'::uuid,
    'cccccccc-0000-4000-8000-000000000030'::uuid
  )$$,
  'service_role audits unenrolled factor for user'
);

RESET ROLE;

SELECT is(
  (
    SELECT count(*)::integer
    FROM app.audit_events
    WHERE actor_id = 'aaaaaaaa-0000-4000-8000-000000000010'::uuid
      AND event = 'mfa.factor_unenrolled'
      AND entity_id = 'cccccccc-0000-4000-8000-000000000030'::uuid
  ),
  1,
  'audit row attributed to p_user_id'
);

SELECT * FROM finish();
ROLLBACK;
