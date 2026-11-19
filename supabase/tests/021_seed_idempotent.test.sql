BEGIN;
SET search_path=public,extensions;
SELECT plan(8);

-- Simulate staging: dual@ already exists under a non-preferred id; catalogue children on demo rows.
DELETE FROM auth.identities WHERE user_id IN (
  SELECT id FROM auth.users WHERE email IN ('dual@licitatiero.local')
);
DELETE FROM auth.users WHERE email = 'dual@licitatiero.local';

INSERT INTO auth.users(id, email, email_confirmed_at, raw_user_meta_data)
VALUES (
  '33333333-3333-4333-8333-333333333333',
  'dual@licitatiero.local',
  now(),
  '{"display_name":"Staging dual (regression)"}'
);

INSERT INTO auth.users(id, email, email_confirmed_at)
VALUES ('77777777-7777-4777-8777-777777777777', 'founder@licitatiero.local', now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO app.profiles(id, display_name, is_staff)
VALUES ('77777777-7777-4777-8777-777777777777', 'Founder regression', true)
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, is_staff = EXCLUDED.is_staff;

SELECT set_config('app.allow_demo_seed', 'on', true);
SELECT app.seed_demo_fixture();

INSERT INTO app.favorites VALUES (
  '22222222-2222-4222-8222-222222222222',
  '20000000-0000-4000-8000-000000000002'::uuid
);
INSERT INTO app.property_promos(
  property_id, owner_id, amount_minor, status, mode, expires_at
) VALUES (
  '10000000-0000-4000-8000-000000000002'::uuid,
  '11111111-1111-4111-8111-111111111111'::uuid,
  1000,
  'pending',
  'mock',
  clock_timestamp() + interval '2 hours'
);

SELECT lives_ok('SELECT app.seed_demo_fixture()', 'first idempotent seed replay');
SELECT lives_ok('SELECT app.seed_demo_fixture()', 'second idempotent seed replay');

SELECT is(
  (SELECT id::text FROM auth.users WHERE email = 'dual@licitatiero.local'),
  '33333333-3333-4333-8333-333333333333',
  'dual@ retains existing auth id after seed'
);
SELECT is(
  (SELECT count(*)::int FROM auth.users WHERE email = 'dual@licitatiero.local'),
  1,
  'single dual@ auth row after replay'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM app.favorites
    WHERE user_id = '22222222-2222-4222-8222-222222222222'
      AND listing_id = '20000000-0000-4000-8000-000000000002'::uuid
  ),
  'demo favorite survives double seed replay'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM app.property_promos
    WHERE property_id = '10000000-0000-4000-8000-000000000002'::uuid
      AND status = 'pending'
  ),
  'demo property promo survives double seed replay'
);

SELECT is(
  (SELECT is_staff::text FROM app.profiles WHERE id = '77777777-7777-4777-8777-777777777777'),
  'true',
  'non-demo founder is_staff unchanged'
);
SELECT is(
  (SELECT display_name FROM app.profiles WHERE id = '77777777-7777-4777-8777-777777777777'),
  'Founder regression',
  'non-demo founder display_name unchanged'
);

SELECT * FROM finish();
ROLLBACK;