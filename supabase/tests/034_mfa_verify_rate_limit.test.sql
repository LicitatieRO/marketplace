BEGIN;
SET search_path = public, extensions;
SELECT plan(17);

SELECT ok(
  (SELECT c.relrowsecurity FROM pg_class c
   JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'app' AND c.relname = 'mfa_verify_factor_limits'),
  'factor limit table has RLS enabled'
);
SELECT ok(
  (SELECT c.relrowsecurity FROM pg_class c
   JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'app' AND c.relname = 'mfa_verify_ip_limits'),
  'IP limit table has RLS enabled'
);

SELECT ok(
  NOT has_table_privilege('authenticated', 'app.mfa_verify_factor_limits', 'SELECT'),
  'authenticated cannot read MFA factor limit table'
);
SELECT ok(
  NOT has_table_privilege('anon', 'app.mfa_verify_ip_limits', 'SELECT'),
  'anon cannot read MFA IP limit table'
);

SELECT ok(
  has_function_privilege('service_role', 'public.mfa_verify_rate_limit(uuid, uuid, text, text)', 'EXECUTE'),
  'service_role may call MFA rate RPC'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.mfa_verify_rate_limit(uuid, uuid, text, text)', 'EXECUTE'),
  'authenticated cannot call MFA rate RPC'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.mfa_verify_rate_limit(uuid, uuid, text, text)', 'EXECUTE'),
  'anon cannot call MFA rate RPC'
);

SELECT public.mfa_verify_rate_limit(
  'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
  'bbbbbbbb-0000-4000-8000-000000000002'::uuid,
  '203.0.113.50',
  'reset'
);

SELECT is(
  public.mfa_verify_rate_limit(
    'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
    'bbbbbbbb-0000-4000-8000-000000000002'::uuid,
    '203.0.113.50',
    'attempt'
  )->>'allowed',
  'true',
  'first attempt reserved'
);

SELECT is(
  public.mfa_verify_rate_limit(
    'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
    'bbbbbbbb-0000-4000-8000-000000000002'::uuid,
    '203.0.113.50',
    'attempt'
  )->>'allowed',
  'true',
  'second attempt reserved'
);

SELECT is(
  public.mfa_verify_rate_limit(
    'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
    'bbbbbbbb-0000-4000-8000-000000000002'::uuid,
    '203.0.113.50',
    'attempt'
  )->>'allowed',
  'true',
  'third attempt reserved'
);

SELECT is(
  public.mfa_verify_rate_limit(
    'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
    'bbbbbbbb-0000-4000-8000-000000000002'::uuid,
    '203.0.113.50',
    'attempt'
  )->>'allowed',
  'true',
  'fourth attempt reserved'
);

SELECT is(
  public.mfa_verify_rate_limit(
    'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
    'bbbbbbbb-0000-4000-8000-000000000002'::uuid,
    '203.0.113.50',
    'attempt'
  )->>'allowed',
  'true',
  'fifth attempt reserved'
);

SELECT is(
  public.mfa_verify_rate_limit(
    'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
    'bbbbbbbb-0000-4000-8000-000000000002'::uuid,
    '203.0.113.50',
    'attempt'
  )->>'allowed',
  'false',
  'sixth attempt denied before verify'
);

UPDATE app.mfa_verify_factor_limits
SET window_started_at = clock_timestamp() - interval '11 minutes'
WHERE user_id = 'aaaaaaaa-0000-4000-8000-000000000001'::uuid
  AND factor_id = 'bbbbbbbb-0000-4000-8000-000000000002'::uuid;

SELECT is(
  public.mfa_verify_rate_limit(
    'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
    'bbbbbbbb-0000-4000-8000-000000000002'::uuid,
    '203.0.113.50',
    'attempt'
  )->>'allowed',
  'true',
  'expired window unlocks factor attempts'
);

SELECT public.mfa_verify_rate_limit(
  'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
  'bbbbbbbb-0000-4000-8000-000000000002'::uuid,
  '',
  'reset'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM app.mfa_verify_factor_limits
    WHERE user_id = 'aaaaaaaa-0000-4000-8000-000000000001'::uuid
      AND factor_id = 'bbbbbbbb-0000-4000-8000-000000000002'::uuid
  ),
  0,
  'reset on success clears factor counter'
);

SELECT public.mfa_verify_rate_limit(
  'aaaaaaaa-0000-4000-8000-000000000003'::uuid,
  'bbbbbbbb-0000-4000-8000-000000000004'::uuid,
  '203.0.113.51',
  'reset'
);

SELECT public.mfa_verify_rate_limit(
  'aaaaaaaa-0000-4000-8000-000000000003'::uuid,
  'bbbbbbbb-0000-4000-8000-000000000004'::uuid,
  '203.0.113.51',
  'attempt'
);
SELECT public.mfa_verify_rate_limit(
  'aaaaaaaa-0000-4000-8000-000000000003'::uuid,
  'bbbbbbbb-0000-4000-8000-000000000004'::uuid,
  '203.0.113.51',
  'attempt'
);
SELECT public.mfa_verify_rate_limit(
  'aaaaaaaa-0000-4000-8000-000000000003'::uuid,
  'bbbbbbbb-0000-4000-8000-000000000004'::uuid,
  '203.0.113.51',
  'attempt'
);
SELECT public.mfa_verify_rate_limit(
  'aaaaaaaa-0000-4000-8000-000000000003'::uuid,
  'bbbbbbbb-0000-4000-8000-000000000004'::uuid,
  '203.0.113.51',
  'attempt'
);
SELECT public.mfa_verify_rate_limit(
  'aaaaaaaa-0000-4000-8000-000000000003'::uuid,
  'bbbbbbbb-0000-4000-8000-000000000004'::uuid,
  '203.0.113.51',
  'attempt'
);

SELECT ok(
  (
    SELECT count(*)::integer
    FROM app.audit_events
    WHERE actor_id = 'aaaaaaaa-0000-4000-8000-000000000003'::uuid
      AND entity_id = 'bbbbbbbb-0000-4000-8000-000000000004'::uuid
      AND event = 'mfa.verify_locked'
      AND payload = '{}'::jsonb
  ) >= 1,
  'lockout audit stores user, factor, empty payload'
);

SELECT public.mfa_verify_rate_limit(
  'cccccccc-0000-4000-8000-000000000005'::uuid,
  'dddddddd-0000-4000-8000-000000000006'::uuid,
  '',
  'reset'
);

SELECT is(
  public.mfa_verify_rate_limit(
    'cccccccc-0000-4000-8000-000000000005'::uuid,
    'dddddddd-0000-4000-8000-000000000006'::uuid,
    '',
    'attempt'
  )->>'allowed',
  'true',
  'missing IP skips IP bucket but factor attempt still reserves'
);

SELECT * FROM finish();
ROLLBACK;
