BEGIN;
SET search_path=public,extensions;
SELECT plan(12);

SELECT throws_ok(
  $$SELECT app.seed_demo_fixture()$$,
  'P0001',
  'demo seed requires app.allow_demo_seed=on',
  'seed_demo_fixture without marker raises'
);
SELECT throws_ok(
  $$SELECT app.ensure_demo_auth_user('owner@licitatiero.local','11111111-1111-4111-8111-111111111111','Alex')$$,
  'P0001',
  'demo seed requires app.allow_demo_seed=on',
  'ensure_demo_auth_user without marker raises'
);

SELECT set_config('app.allow_demo_seed', 'on', true);

SELECT lives_ok(
  $$SELECT app.ensure_demo_auth_user('owner@licitatiero.local','11111111-1111-4111-8111-111111111111','Alex')$$,
  'ensure_demo_auth_user succeeds with marker'
);
SELECT lives_ok(
  $$SELECT app.seed_demo_fixture()$$,
  'seed_demo_fixture succeeds with marker'
);

SELECT throws_ok(
  $$SELECT app.ensure_demo_auth_user('founder@licitatiero.local','55555555-5555-4555-8555-555555555555','Founder')$$,
  'P0001',
  'demo auth user email founder@licitatiero.local is not allowed',
  'non-demo email rejected for ensure_demo_auth_user'
);

SELECT ok(
  NOT has_function_privilege('public', 'app.seed_demo_fixture()', 'EXECUTE'),
  'PUBLIC cannot execute seed_demo_fixture'
);
SELECT ok(
  NOT has_function_privilege('anon', 'app.seed_demo_fixture()', 'EXECUTE'),
  'anon cannot execute seed_demo_fixture'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'app.seed_demo_fixture()', 'EXECUTE'),
  'authenticated cannot execute seed_demo_fixture'
);
SELECT ok(
  NOT has_function_privilege('public', 'app.ensure_demo_auth_user(text,uuid,text)', 'EXECUTE'),
  'PUBLIC cannot execute ensure_demo_auth_user'
);
SELECT ok(
  NOT has_function_privilege('anon', 'app.ensure_demo_auth_user(text,uuid,text)', 'EXECUTE'),
  'anon cannot execute ensure_demo_auth_user'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'app.ensure_demo_auth_user(text,uuid,text)', 'EXECUTE'),
  'authenticated cannot execute ensure_demo_auth_user'
);
SELECT ok(
  has_function_privilege('service_role', 'app.seed_demo_fixture()', 'EXECUTE'),
  'service_role can execute seed_demo_fixture'
);

SELECT * FROM finish();
ROLLBACK;