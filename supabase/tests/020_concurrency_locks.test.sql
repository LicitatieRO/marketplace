-- Transactional invariants complement the real two-session race in test-concurrency.mjs.
-- The existing late-bid scenario there checks database time after waiting for a lock.
BEGIN;
SET search_path=public,extensions;
SELECT no_plan();
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
 ('e0550000-0000-4000-8000-000000000001','locks-owner@example.test',now()),
 ('e0550000-0000-4000-8000-000000000002','locks-buyer@example.test',now()),
 ('e0550000-0000-4000-8000-000000000003','locks-other@example.test',now());
SELECT set_config('request.jwt.claims','{"sub":"e0550000-0000-4000-8000-000000000001","role":"authenticated"}',true);
CREATE TEMP TABLE lock_property AS SELECT public.create_property('Lock invariant fixture','Synthetic test','Cotroceni','Private synthetic address','apartment',70,3,2,2012,10000000,50000,'{}') j;
SELECT is((SELECT count(*)::int FROM app.listings WHERE property_id=(SELECT (j->>'id')::uuid FROM lock_property)),2,'sale and rental share one physical property');
CREATE TEMP TABLE lock_auction AS SELECT public.start_auction((SELECT id FROM app.listings WHERE property_id=(SELECT (j->>'id')::uuid FROM lock_property) AND transaction_type='sale'),'sealed','public',clock_timestamp()-interval '1 second',clock_timestamp()+interval '1 hour',1000,100) j;
SELECT set_config('request.jwt.claims','{"sub":"e0550000-0000-4000-8000-000000000002","role":"authenticated"}',true);
CREATE TEMP TABLE lock_bid AS SELECT public.place_bid((SELECT (j->>'id')::uuid FROM lock_auction),1000,gen_random_uuid()) j;
SELECT set_config('request.jwt.claims','{"sub":"e0550000-0000-4000-8000-000000000003","role":"authenticated"}',true);
CREATE TEMP TABLE lock_other_bid AS SELECT public.place_bid((SELECT (j->>'id')::uuid FROM lock_auction),1000,gen_random_uuid()) j;
UPDATE app.auctions SET ends_at=clock_timestamp()-interval '1 second' WHERE id=(SELECT (j->>'id')::uuid FROM lock_auction);
SELECT set_config('request.jwt.claims','{"sub":"e0550000-0000-4000-8000-000000000001","role":"authenticated"}',true);
CREATE TEMP TABLE lock_reservation AS SELECT public.request_reservation((SELECT (j->>'id')::uuid FROM lock_bid),100,'e0551000-0000-4000-8000-000000000001') j;
SELECT is(public.request_reservation((SELECT (j->>'id')::uuid FROM lock_bid),100,'e0551000-0000-4000-8000-000000000001'),(SELECT j FROM lock_reservation),'same reservation payload replays the exact response');
SELECT throws_ok(format('SELECT public.request_reservation(%L,101,''e0551000-0000-4000-8000-000000000001'')',(SELECT j->>'id' FROM lock_bid)),'P0001','Idempotency key payload mismatch','same key cannot change deposit');
SELECT throws_ok(format('SELECT public.request_reservation(%L,100,''e0551000-0000-4000-8000-000000000001'')',(SELECT j->>'id' FROM lock_other_bid)),'P0001','Idempotency key payload mismatch','same key cannot select another bidder');
SELECT throws_ok(format('SELECT public.request_reservation(%L,100,gen_random_uuid())',(SELECT j->>'id' FROM lock_other_bid)),'P0001','Property is reserved','a new key cannot reserve the same property again');
SELECT throws_ok(format('SELECT public.start_auction(%L,''ascending'',''public'',clock_timestamp(),clock_timestamp()+interval ''1 hour'',1000,100)',(SELECT id FROM app.listings WHERE property_id=(SELECT (j->>'id')::uuid FROM lock_property) AND transaction_type='rent')),'P0001','Property is reserved','sale reservation blocks the linked rental auction with the same conflict');
SELECT is((SELECT count(*)::int FROM app.reservations WHERE property_id=(SELECT (j->>'id')::uuid FROM lock_property)),1,'replays and rejected conflicts leave one reservation');
SELECT is((SELECT deposit_minor FROM app.reservations WHERE id=(SELECT (j->>'id')::uuid FROM lock_reservation)),100::bigint,'conflicts cannot mutate the original deposit');
SELECT is((SELECT count(*)::int FROM app.audit_events WHERE event='reservation.requested' AND entity_id=(SELECT (j->>'id')::uuid FROM lock_reservation)),1,'reservation retries do not duplicate audit events');
SELECT is((SELECT count(*)::int FROM app.notification_outbox WHERE event='reservation.requested' AND entity_id=(SELECT (j->>'id')::uuid FROM lock_reservation)),1,'reservation retries do not duplicate notifications');
SELECT is((SELECT count(*)::int FROM app.auctions WHERE property_id=(SELECT (j->>'id')::uuid FROM lock_property) AND status IN ('active','scheduled')),0,'reserved property has no active linked auction');
SELECT * FROM finish();
ROLLBACK;
