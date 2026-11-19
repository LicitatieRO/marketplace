BEGIN;
SET search_path = public, extensions;
SELECT plan(17);

SELECT ok(
  (SELECT c.relrowsecurity FROM pg_class c
   JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'app' AND c.relname = 'auth_http_rate_limits'),
  'auth rate limit table has RLS enabled'
);

SELECT ok(
  NOT has_table_privilege('authenticated', 'app.auth_http_rate_limits', 'SELECT'),
  'authenticated cannot read auth rate limit table'
);
SELECT ok(
  NOT has_table_privilege('anon', 'app.auth_http_rate_limits', 'SELECT'),
  'anon cannot read auth rate limit table'
);

SELECT ok(
  has_function_privilege('service_role', 'public.auth_http_rate_limit_consume(text, integer, integer, boolean)', 'EXECUTE'),
  'service_role may call auth HTTP rate RPC'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.auth_http_rate_limit_consume(text, integer, integer, boolean)', 'EXECUTE'),
  'authenticated cannot call auth HTTP rate RPC'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.auth_http_rate_limit_consume(text, integer, integer, boolean)', 'EXECUTE'),
  'anon cannot call auth HTTP rate RPC'
);

CREATE TEMP TABLE auth_rl_keys (
  ip_key text,
  id_key text
);

INSERT INTO auth_rl_keys (ip_key, id_key) VALUES (
  encode(extensions.digest('ip-bucket', 'sha256'), 'hex'),
  encode(extensions.digest('id-bucket', 'sha256'), 'hex')
);

SELECT is(
  public.auth_http_rate_limit_consume(
    (SELECT ip_key FROM auth_rl_keys),
  3,
    60
  )->>'allowed',
  'true',
  'first consume allowed'
);

SELECT is(
  public.auth_http_rate_limit_consume(
    (SELECT ip_key FROM auth_rl_keys),
    3,
    60
  )->>'allowed',
  'true',
  'second consume allowed'
);

SELECT is(
  public.auth_http_rate_limit_consume(
    (SELECT ip_key FROM auth_rl_keys),
    3,
    60
  )->>'allowed',
  'true',
  'third consume allowed'
);

SELECT is(
  public.auth_http_rate_limit_consume(
    (SELECT ip_key FROM auth_rl_keys),
    3,
    60
  )->>'allowed',
  'false',
  'fourth consume denied at limit'
);

SELECT isnt(
  public.auth_http_rate_limit_consume(
    (SELECT ip_key FROM auth_rl_keys),
    3,
    60
  )->>'retry_after_seconds',
  NULL,
  'denied response includes retry_after_seconds'
);

SELECT is(
  public.auth_http_rate_limit_consume(
    (SELECT id_key FROM auth_rl_keys),
    2,
    60
  )->>'allowed',
  'true',
  'identifier bucket independent of ip bucket'
);

UPDATE app.auth_http_rate_limits
SET window_started_at = clock_timestamp() - interval '2 hours'
WHERE key_hash = (SELECT ip_key FROM auth_rl_keys);

SELECT is(
  public.auth_http_rate_limit_consume(
    (SELECT ip_key FROM auth_rl_keys),
    3,
    60
  )->>'allowed',
  'true',
  'window reset allows attempts again'
);

SELECT is(
  (SELECT hit_count FROM app.auth_http_rate_limits WHERE key_hash = (SELECT ip_key FROM auth_rl_keys)),
  1,
  'counter restarts after window reset'
);

SELECT throws_ok(
  $$SELECT public.auth_http_rate_limit_consume('short', 1, 60, true)$$,
  'P0001',
  'Invalid auth rate-limit request',
  'rejects malformed key hash'
);

SELECT is(
  public.auth_http_rate_limit_consume(
    (SELECT ip_key FROM auth_rl_keys),
    3,
    60,
    false
  )->>'allowed',
  'true',
  'peek without increment does not advance count'
);

SELECT is(
  (SELECT hit_count FROM app.auth_http_rate_limits WHERE key_hash = (SELECT ip_key FROM auth_rl_keys)),
  1,
  'peek leaves counter unchanged'
);

SELECT * FROM finish();
ROLLBACK;
