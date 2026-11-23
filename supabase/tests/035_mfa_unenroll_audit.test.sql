BEGIN;
SET search_path = public, extensions;
SELECT plan(6);

SELECT has_function(
  'public',
  'audit_mfa_factor_unenrolled',
  ARRAY['uuid', 'uuid'],
  'audit_mfa_factor_unenrolled exists'
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
VALUES (
  'aaaaaaaa-0000-4000-8000-000000000010',
  'mfa-unenroll-audit@example.test',
  clock_timestamp()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO app.profiles(id, display_name)
VALUES ('aaaaaaaa-0000-4000-8000-000000000010', 'MFA audit tester')
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
  'bbbbbbbb-0000-4000-8000-000000000020'::uuid,
  'aaaaaaaa-0000-4000-8000-000000000010'::uuid,
  'Audit factor',
  'totp',
  'verified',
  'AAAAAAAAAAAAAAAA',
  clock_timestamp(),
  clock_timestamp()
)
ON CONFLICT (id) DO NOTHING;

DELETE FROM auth.mfa_factors
WHERE id = 'bbbbbbbb-0000-4000-8000-000000000020'::uuid;

SET LOCAL ROLE service_role;

SELECT lives_ok(
  $$SELECT public.audit_mfa_factor_unenrolled(
    'aaaaaaaa-0000-4000-8000-000000000010'::uuid,
    'bbbbbbbb-0000-4000-8000-000000000020'::uuid
  )$$,
  'service_role appends audit after factor removed'
);

RESET ROLE;

SELECT is(
  (
    SELECT count(*)::integer
    FROM app.audit_events
    WHERE actor_id = 'aaaaaaaa-0000-4000-8000-000000000010'::uuid
      AND event = 'mfa.factor_unenrolled'
      AND entity_id = 'bbbbbbbb-0000-4000-8000-000000000020'::uuid
  ),
  1,
  'audit event recorded without extra payload'
);

SELECT * FROM finish();
ROLLBACK;