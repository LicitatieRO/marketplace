BEGIN;
SET search_path = public, extensions;
SELECT plan(2);

SET LOCAL ROLE service_role;

SELECT is(
  public.mfa_verify_rate_limit(
    'eeeeeeee-0000-4000-8000-000000000010'::uuid,
    'ffffffff-0000-4000-8000-000000000011'::uuid,
    'not-a-valid-ip',
    'attempt'
  )->>'allowed',
  'true',
  'unparseable client IP skips IP bucket without error'
);

DO $$
DECLARE
  i integer;
BEGIN
  FOR i IN 1..20 LOOP
    PERFORM public.mfa_verify_rate_limit(
      gen_random_uuid(),
      gen_random_uuid(),
      '198.51.100.42',
      'attempt'
    );
  END LOOP;
END
$$;

RESET ROLE;

SELECT is(
  (
    SELECT count(*)::integer
    FROM app.audit_events
    WHERE event = 'mfa.verify_ip_locked'
      AND payload ? 'client_ip_hash'
      AND length(payload->>'client_ip_hash') = 64
  ),
  1,
  'service_role rate RPC writes exactly one ip_locked audit with sha256 client_ip_hash'
);

SELECT * FROM finish();
ROLLBACK;