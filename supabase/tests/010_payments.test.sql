BEGIN;
SET search_path=public,extensions;
SELECT no_plan();
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
  ('11111111-0000-4000-8000-000000000010','pay-owner@test.local',now()),
  ('11111111-0000-4000-8000-000000000011','pay-other@test.local',now());
SELECT set_config('request.jwt.claims','{"sub":"11111111-0000-4000-8000-000000000010","role":"authenticated"}',true);
CREATE TEMP TABLE prop AS
  SELECT public.create_property('Payments duplex','POC listing','Cotroceni','Private pay address','apartment',70,3,2,2018,20000000,90000,'{}') j;
SELECT set_config('test.pay_prop_id',(SELECT j->>'id' FROM prop),true);
SELECT is((SELECT count(*)::integer FROM app.listings WHERE property_id=current_setting('test.pay_prop_id')::uuid),2,'linked sale and rent listings exist');
SELECT ok(NOT has_table_privilege('anon','app.ledger_entries','SELECT'),'anon cannot read ledger');
SELECT ok(NOT has_table_privilege('anon','app.property_promos','SELECT'),'anon cannot read promos');
SELECT ok(NOT has_table_privilege('authenticated','app.stripe_events','SELECT'),'authenticated cannot read stripe_events');
SELECT is(
  (SELECT count(*)::integer FROM cron.job WHERE jobname='marketplace-expire-promos' AND schedule='*/5 * * * *' AND command LIKE '%expire_property_promos()%'),
  1,
  'marketplace-expire-promos cron scheduled'
);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"11111111-0000-4000-8000-000000000010","role":"authenticated"}',true);
SELECT throws_ok(
  format('SELECT public.prepare_property_promo(%L,%L,%L,%L)',current_setting('test.pay_prop_id'),'11111111-0000-4000-8000-000000000010',gen_random_uuid(),'mock'),
  '42501',NULL,'authenticated cannot execute prepare_property_promo');
SELECT throws_ok(
  format('SELECT public.complete_mock_property_promo(%L,%L,%L)',gen_random_uuid(),'11111111-0000-4000-8000-000000000010',gen_random_uuid()),
  '42501',NULL,'authenticated cannot execute complete_mock_property_promo');
SELECT throws_ok(
  format('SELECT public.attach_promo_checkout_session(%L,%L,%L)',gen_random_uuid(),'11111111-0000-4000-8000-000000000010','cs_test_denied'),
  '42501',NULL,'authenticated cannot execute attach_promo_checkout_session');
SELECT throws_ok('SELECT public.expire_property_promos()','42501',NULL,'authenticated cannot execute expire_property_promos');
RESET ROLE;
SET LOCAL ROLE service_role;
CREATE TEMP TABLE prep AS
  SELECT public.prepare_property_promo(
    current_setting('test.pay_prop_id')::uuid,
    '11111111-0000-4000-8000-000000000010',
    'aaaaaaaa-0000-4000-8000-000000000001',
    'mock'
  ) j;
CREATE TEMP TABLE done AS
  SELECT public.complete_mock_property_promo(
    (SELECT (j->>'id')::uuid FROM prep),
    '11111111-0000-4000-8000-000000000010',
    'aaaaaaaa-0000-4000-8000-000000000001'
  ) j;
RESET ROLE;
SELECT is((SELECT status FROM app.property_promos WHERE id=(SELECT (j->>'id')::uuid FROM prep)),'active','mock promo activates');
SELECT is(
  (SELECT count(*)::integer FROM app.listings l, app.property_promos p
    WHERE l.property_id=p.property_id AND p.id=(SELECT (j->>'id')::uuid FROM prep)
      AND app.active_promo_expires(l.property_id) IS NOT NULL),
  2,
  'active promo covers both linked listings'
);
SET LOCAL ROLE service_role;
SELECT is(public.complete_mock_property_promo(
    (SELECT (j->>'id')::uuid FROM prep),
    '11111111-0000-4000-8000-000000000010',
    'aaaaaaaa-0000-4000-8000-000000000001'
  )->>'status','active','mock promo completion idempotent');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM app.ledger_entries WHERE promo_id=(SELECT (j->>'id')::uuid FROM prep)),1,'ledger has one promo entry');
SELECT is((SELECT amount_minor FROM app.ledger_entries WHERE promo_id=(SELECT (j->>'id')::uuid FROM prep)),0::bigint,'mock ledger records zero amount');
UPDATE app.property_promos SET expires_at=clock_timestamp()-interval '1 minute'
WHERE id=(SELECT (j->>'id')::uuid FROM prep);
SET LOCAL ROLE service_role;
SELECT public.expire_property_promos();
RESET ROLE;
SELECT is((SELECT status FROM app.property_promos WHERE id=(SELECT (j->>'id')::uuid FROM prep)),'expired','active promo expires');
SELECT is(app.active_promo_expires(current_setting('test.pay_prop_id')::uuid),NULL,'listing_json promo cleared after expiry');
SET LOCAL ROLE service_role;
CREATE TEMP TABLE prep_repromo AS
  SELECT public.prepare_property_promo(
    current_setting('test.pay_prop_id')::uuid,
    '11111111-0000-4000-8000-000000000010',
    'bbbbbbbb-0000-4000-8000-000000000003',
    'mock'
  ) j;
RESET ROLE;
SELECT is((SELECT status FROM app.property_promos WHERE id=(SELECT (j->>'id')::uuid FROM prep_repromo)),'pending','re-promo allowed after expiry');
UPDATE app.property_promos SET expires_at=clock_timestamp()-interval '1 minute'
WHERE property_id=current_setting('test.pay_prop_id')::uuid AND status='pending';
SET LOCAL ROLE service_role;
SELECT public.expire_property_promos();
CREATE TEMP TABLE abandon AS
  SELECT public.prepare_property_promo(
    current_setting('test.pay_prop_id')::uuid,
    '11111111-0000-4000-8000-000000000010',
    'cccccccc-0000-4000-8000-000000000004',
    'stripe_test'
  ) j;
RESET ROLE;
UPDATE app.property_promos SET expires_at=clock_timestamp()-interval '1 minute'
WHERE id=(SELECT (j->>'id')::uuid FROM abandon);
SET LOCAL ROLE service_role;
SELECT public.expire_property_promos();
RESET ROLE;
SELECT is((SELECT status FROM app.property_promos WHERE id=(SELECT (j->>'id')::uuid FROM abandon)),'cancelled','abandoned pending cancelled');
SET LOCAL ROLE service_role;
CREATE TEMP TABLE prep_after_cancel AS
  SELECT public.prepare_property_promo(
    current_setting('test.pay_prop_id')::uuid,
    '11111111-0000-4000-8000-000000000010',
    'dddddddd-0000-4000-8000-000000000005',
    'stripe_test'
  ) j;
SELECT set_config('test.prep_after_cancel_id',(SELECT j->>'id' FROM prep_after_cancel),true);
RESET ROLE;
SELECT is((SELECT status FROM app.property_promos WHERE id=current_setting('test.prep_after_cancel_id')::uuid),'pending','re-promo allowed after abandonment');
SET LOCAL ROLE service_role;
SELECT public.attach_promo_checkout_session(
  current_setting('test.prep_after_cancel_id')::uuid,
  '11111111-0000-4000-8000-000000000010',
  'cs_test_fixture_010'
);
SELECT is(
  (public.complete_promo_stripe_checkout(
    'evt_test_webhook_010','checkout.session.completed',false,'digest-010','cs_test_fixture_010',
    current_setting('test.pay_prop_id')::uuid,
    current_setting('test.prep_after_cancel_id')::uuid
  )->>'status'),
  'ok',
  'stripe webhook activates pending promo');
SELECT is(
  (public.complete_promo_stripe_checkout(
    'evt_test_webhook_010','checkout.session.completed',false,'digest-010','cs_test_fixture_010',
    current_setting('test.pay_prop_id')::uuid,
    current_setting('test.prep_after_cancel_id')::uuid
  )->>'status'),
  'duplicate',
  'stripe webhook idempotent on event id');
SELECT is(
  (public.complete_promo_stripe_checkout(
    'evt_test_bad_session','checkout.session.completed',false,'digest-011','cs_test_wrong',
    current_setting('test.pay_prop_id')::uuid,
    current_setting('test.prep_after_cancel_id')::uuid
  )->>'status'),
  'rejected_mismatch',
  'session mismatch rejected without raising');
RESET ROLE;
SELECT throws_ok(
  format('SELECT public.prepare_property_promo(%L,%L,%L,%L)',current_setting('test.pay_prop_id'),'11111111-0000-4000-8000-000000000011',gen_random_uuid(),'mock'),
  'P0001','Owner required','non-owner blocked via owner id check');
SELECT * FROM finish();
ROLLBACK;