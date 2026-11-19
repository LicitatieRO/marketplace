BEGIN;
SET search_path=public,extensions;
SELECT plan(20);

SELECT has_column('app','properties','lat','properties.lat exists');
SELECT has_column('app','properties','lng','properties.lng exists');
SELECT col_is_null('app','properties','lat','properties.lat is nullable');
SELECT col_is_null('app','properties','lng','properties.lng is nullable');

SELECT throws_ok(
  $$INSERT INTO app.properties(id,owner_id,title,description,neighborhood,exact_address,property_type,area_sqm,rooms,floor,built_year,lat,lng)
    VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','11111111-1111-4111-8111-111111111111','x','x','x','x','apartment',50,2,1,2000,42.700,23.320)$$,
  '23514',
  NULL,
  'foreign coordinates outside Romania rejected (Sofia)'
);

SELECT throws_ok(
  $$INSERT INTO app.properties(id,owner_id,title,description,neighborhood,exact_address,property_type,area_sqm,rooms,floor,built_year,lat,lng)
    VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','11111111-1111-4111-8111-111111111111','x','x','x','x','apartment',50,2,1,2000,44.400,NULL)$$,
  '23514',
  NULL,
  'lat without lng rejected'
);

SELECT ok(
  public.get_listing('20000000-0000-4000-8000-000000000001'::uuid) ? 'lat',
  'public listing JSON includes lat'
);
SELECT ok(
  public.get_listing('20000000-0000-4000-8000-000000000001'::uuid) ? 'lng',
  'public listing JSON includes lng'
);
SELECT ok(
  NOT public.get_listing('20000000-0000-4000-8000-000000000001'::uuid) ? 'exact_address',
  'public listing JSON omits exact_address'
);

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims','{"role":"anon"}',true);
SELECT ok(
  NOT (SELECT elem FROM jsonb_array_elements(public.get_catalogue()) AS t(elem) LIMIT 1) ? 'exact_address',
  'catalogue JSON omits exact_address'
);
SELECT ok(
  NOT (SELECT elem FROM jsonb_array_elements(public.get_catalogue()) AS t(elem) WHERE elem->>'property_id'='10000000-0000-4000-8000-000000000001' LIMIT 1) ? 'owner_id',
  'anon catalogue omits owner_id'
);
SELECT ok(
  (SELECT (elem->>'lat')::double precision FROM jsonb_array_elements(public.get_catalogue()) AS t(elem) WHERE elem->>'property_id'='10000000-0000-4000-8000-000000000001' LIMIT 1) BETWEEN 43.47 AND 48.42,
  'seed Floreasca public lat within Romania bounds (fuzzed)'
);
RESET ROLE;

SET LOCAL ROLE anon;
SELECT throws_ok('SELECT * FROM app.properties','42501',NULL,'anon cannot select app.properties directly');
RESET ROLE;

INSERT INTO auth.users(id, email, email_confirmed_at)
VALUES ('55555555-5555-4555-8555-555555555555', 'founder@licitatiero.local', now())
ON CONFLICT (id) DO NOTHING;
UPDATE app.profiles
SET is_staff = true, display_name = 'Founder staff'
WHERE id = '55555555-5555-4555-8555-555555555555';

INSERT INTO app.favorites VALUES (
  '22222222-2222-4222-8222-222222222222',
  '20000000-0000-4000-8000-000000000001'::uuid
);
INSERT INTO app.property_promos(
  property_id, owner_id, amount_minor, status, mode, expires_at
) VALUES (
  '10000000-0000-4000-8000-000000000002'::uuid,
  '11111111-1111-4111-8111-111111111111'::uuid,
  1000,
  'pending',
  'mock',
  clock_timestamp() + interval '1 hour'
);

SELECT set_config('app.allow_demo_seed', 'on', true);
SELECT lives_ok('SELECT app.seed_demo_fixture()', 'demo seed replay is callable with demo favorites and promos');

SELECT ok(
  EXISTS (
    SELECT 1 FROM app.favorites
    WHERE user_id = '22222222-2222-4222-8222-222222222222'
      AND listing_id = '20000000-0000-4000-8000-000000000001'::uuid
  ),
  'demo favorite survives seed replay'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM app.property_promos
    WHERE property_id = '10000000-0000-4000-8000-000000000002'::uuid
  ),
  'demo property promo survives seed replay'
);

SELECT ok(
  NOT has_function_privilege('anon', 'app.seed_demo_fixture()', 'EXECUTE'),
  'anon cannot execute demo seed replay'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'app.seed_demo_fixture()', 'EXECUTE'),
  'authenticated cannot execute demo seed replay'
);

SELECT is(
  (SELECT is_staff::text FROM app.profiles WHERE id = '55555555-5555-4555-8555-555555555555'),
  'true',
  'non-demo founder is_staff survives demo seed replay'
);
SELECT is(
  (SELECT count(*)::int FROM auth.users WHERE email = 'founder@licitatiero.local'),
  1,
  'non-demo founder auth row survives demo seed replay'
);

SELECT * FROM finish();
ROLLBACK;