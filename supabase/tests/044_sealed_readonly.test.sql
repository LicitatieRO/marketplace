-- Initialize pgTAP's session-local temporary bookkeeping before entering read-only mode.
SET search_path=public,extensions;
SELECT plan(2);
BEGIN READ ONLY;
SELECT ok(EXISTS(SELECT 1 FROM auth.users u JOIN app.profiles p ON p.id=u.id WHERE u.email='owner@licitatiero.local' AND u.email_confirmed_at IS NOT NULL),'local seed supplies a verified profile for the read-only regression');
SELECT set_config('request.jwt.claims',(SELECT jsonb_build_object('sub',id,'role','authenticated')::text FROM auth.users WHERE email='owner@licitatiero.local'),true);
-- Unknown ID must reach the deliberate denial, rather than25006 from a hidden profile lock.
SELECT throws_ok('SELECT public.get_sealed_offers(''00000000-0000-4000-8000-000000000000'')','42501','Owner or staff MFA required','STABLE RPC executes without locking in a read-only transaction');
COMMIT;
SELECT * FROM finish();
