BEGIN;
SET search_path=public,extensions;
SELECT plan(12);
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
  ('11111111-0000-4000-8000-000000000020','promo-idem-owner@test.local',now());
SELECT set_config('request.jwt.claims','{"sub":"11111111-0000-4000-8000-000000000020","role":"authenticated"}',true);
CREATE TEMP TABLE promo_prop AS
  SELECT public.create_property(
    'Idem promo flat','POC listing','Dorobanti','Private idem address','apartment',62,2,4,2015,18000000,85000,'{}'
  ) j;
CREATE TEMP TABLE promo_prop_other AS
  SELECT public.create_property(
    'Idem promo other','POC listing','Floreasca','Other idem address','studio',38,1,8,2020,12000000,60000,'{}'
  ) j;
SELECT set_config('test.idem_prop_id',(SELECT j->>'id' FROM promo_prop),true);
SELECT set_config('test.idem_other_prop',(SELECT j->>'id' FROM promo_prop_other),true);
SELECT set_config(
  'test.idem_listing_id',
  (SELECT id::text FROM app.listings WHERE property_id=current_setting('test.idem_prop_id')::uuid AND transaction_type='sale' LIMIT 1),
  true
);
SELECT set_config('test.client_idem_key','eeeeeeee-0000-4000-8000-000000000099',true);
SET LOCAL ROLE service_role;
CREATE TEMP TABLE prep_one AS
  SELECT public.prepare_property_promo(
    current_setting('test.idem_prop_id')::uuid,
    '11111111-0000-4000-8000-000000000020',
    current_setting('test.client_idem_key')::uuid,
    'mock'
  ) j;
CREATE TEMP TABLE done_one AS
  SELECT public.complete_mock_property_promo(
    (SELECT (j->>'id')::uuid FROM prep_one),
    '11111111-0000-4000-8000-000000000020',
    current_setting('test.client_idem_key')::uuid
  ) j;
RESET ROLE;
SELECT is((SELECT status FROM app.property_promos WHERE id=(SELECT (j->>'id')::uuid FROM prep_one)),'active','one client key: mock promo activates');
SELECT is((SELECT count(*)::integer FROM app.ledger_entries WHERE promo_id=(SELECT (j->>'id')::uuid FROM prep_one)),1,'one client key: single ledger row');
SELECT is((SELECT amount_minor FROM app.property_promos WHERE id=(SELECT (j->>'id')::uuid FROM prep_one)),1000::bigint,'one client key: promo list price 1000 minor EUR');
SELECT is((SELECT currency FROM app.ledger_entries WHERE promo_id=(SELECT (j->>'id')::uuid FROM prep_one)),'EUR','ledger currency EUR');
SELECT ok(
  abs(extract(epoch FROM ((SELECT expires_at FROM app.property_promos WHERE id=(SELECT (j->>'id')::uuid FROM prep_one)) - (clock_timestamp() + interval '7 days')))) < 10,
  'promo expires_at about seven days ahead'
);
SELECT ok(
  public.get_listing(current_setting('test.idem_listing_id')::uuid)->>'promo_expires_at' IS NOT NULL,
  'listing_json exposes promo_expires_at after mock complete'
);
SET LOCAL ROLE service_role;
CREATE TEMP TABLE prep_replay AS
  SELECT public.prepare_property_promo(
    current_setting('test.idem_prop_id')::uuid,
    '11111111-0000-4000-8000-000000000020',
    current_setting('test.client_idem_key')::uuid,
    'mock'
  ) j;
RESET ROLE;
SELECT is(
  (SELECT j->>'id' FROM prep_replay),
  (SELECT j->>'id' FROM prep_one),
  'prepare replay returns same promo id'
);
SELECT is((SELECT count(*)::integer FROM app.property_promos WHERE property_id=current_setting('test.idem_prop_id')::uuid),1,'prepare replay creates no extra promo row');
SET LOCAL ROLE service_role;
SELECT is(
  public.complete_mock_property_promo(
    (SELECT (j->>'id')::uuid FROM prep_one),
    '11111111-0000-4000-8000-000000000020',
    current_setting('test.client_idem_key')::uuid
  )->>'status',
  'active',
  'complete replay idempotent'
);
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM app.ledger_entries WHERE promo_id=(SELECT (j->>'id')::uuid FROM prep_one)),1,'complete replay adds no second ledger row');
SET LOCAL ROLE service_role;
CREATE TEMP TABLE prep_other_complete AS
  SELECT public.prepare_property_promo(
    current_setting('test.idem_other_prop')::uuid,
    '11111111-0000-4000-8000-000000000020',
    'ffffffff-0000-4000-8000-000000000099',
    'mock'
  ) j;
RESET ROLE;
SELECT throws_ok(
  format(
    'SELECT public.complete_mock_property_promo(%L,%L,%L)',
    (SELECT (j->>'id')::uuid FROM prep_other_complete),
    '11111111-0000-4000-8000-000000000020',
    current_setting('test.client_idem_key')
  ),
  'P0001',
  'Idempotency key payload mismatch',
  'complete with same client key and different promo id raises mismatch'
);
UPDATE app.property_promos SET status='expired',expires_at=clock_timestamp()-interval '1 day'
WHERE id=(SELECT (j->>'id')::uuid FROM prep_one);
SET LOCAL ROLE service_role;
SELECT throws_ok(
  format(
    'SELECT public.prepare_property_promo(%L,%L,%L,%L)',
    current_setting('test.idem_other_prop'),
    '11111111-0000-4000-8000-000000000020',
    current_setting('test.client_idem_key'),
    'stripe_test'
  ),
  'P0001',
  'Idempotency key payload mismatch',
  'different payload with same client key on prepare still raises mismatch'
);
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;