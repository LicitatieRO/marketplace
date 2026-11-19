BEGIN;
SET search_path=public,extensions;
SELECT plan(3);

SELECT set_config('app.allow_demo_seed', 'on', true);
SELECT lives_ok('SELECT app.seed_demo_fixture()', 'seed_demo_fixture replay after Ilfov fix');

SELECT is(
  (SELECT judet FROM app.properties WHERE id = '10000000-0000-4000-8000-000000000002'::uuid),
  'Ilfov',
  'demo Voluntari property judet is Ilfov'
);

SELECT is(
  (SELECT judet FROM app.properties WHERE id = '10000000-0000-4000-8000-000000000001'::uuid),
  'București',
  'demo Floreasca property remains București'
);

SELECT * FROM finish();
ROLLBACK;