BEGIN;
SET search_path = public, extensions;
SELECT plan(3);

INSERT INTO auth.users(id, email, email_confirmed_at)
VALUES
  (
    'aaaaaaaa-0000-4000-8000-000000000010',
    'mfa-guard-a@example.test',
    clock_timestamp()
  ),
  (
    'bbbbbbbb-0000-4000-8000-000000000011',
    'mfa-guard-b@example.test',
    clock_timestamp()
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO app.profiles(id, display_name)
VALUES
  ('aaaaaaaa-0000-4000-8000-000000000010', 'MFA guard A'),
  ('bbbbbbbb-0000-4000-8000-000000000011', 'MFA guard B')
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
  'Guard factor A',
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
  'Guard factor B',
  'totp',
  'verified',
  'BBBBBBBBBBBBBBBB',
  clock_timestamp(),
  clock_timestamp()
)
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE service_role;

SELECT throws_ok(
  $$SELECT public.audit_mfa_factor_unenrolled(
    'aaaaaaaa-0000-4000-8000-000000000010'::uuid,
    'cccccccc-0000-4000-8000-000000000030'::uuid
  )$$,
  'P0001',
  'Factor still enrolled',
  'rejects audit while user factor still exists'
);

SELECT throws_ok(
  $$SELECT public.audit_mfa_factor_unenrolled(
    'aaaaaaaa-0000-4000-8000-000000000010'::uuid,
    'dddddddd-0000-4000-8000-000000000040'::uuid
  )$$,
  '42501',
  'Factor not owned by user',
  'rejects attributing another user enrolled factor'
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
  'accepts audit after factor removed for user'
);

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
