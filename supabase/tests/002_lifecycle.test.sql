BEGIN;
SET search_path=public,extensions;
SELECT no_plan();
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
 ('aaaaaaaa-0000-4000-8000-000000000001','owner@test.local',now()),
 ('aaaaaaaa-0000-4000-8000-000000000002','bidder@test.local',now()),
 ('aaaaaaaa-0000-4000-8000-000000000003','other@test.local',now()),
 ('aaaaaaaa-0000-4000-8000-000000000004','unverified@test.local',NULL);
SELECT set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',true);
CREATE TEMP TABLE fixture AS SELECT public.create_property('Test apartment','Description','Cotroceni','Private exact address','apartment',70,3,2,2010,10000000,50000,'{}') AS j;
SELECT is((SELECT count(*)::integer FROM app.listings WHERE property_id=(SELECT (j->>'id')::uuid FROM fixture)),2,'one property has sale and rent listing');
CREATE TEMP TABLE auction AS SELECT public.start_auction((SELECT id FROM app.listings WHERE property_id=(SELECT (j->>'id')::uuid FROM fixture) AND transaction_type='sale'),'ascending','public',now()-interval '1 second',now()+interval '1 hour',10000000,10000) j;
SELECT throws_ok(format('SELECT public.start_auction(%L,''sealed'',''public'',now(),now()+interval ''1 hour'',1,1)',(SELECT id FROM app.listings WHERE property_id=(SELECT (j->>'id')::uuid FROM fixture) AND transaction_type='rent')),'P0001','Property already has an active auction','linked listing auction conflict');
SELECT throws_ok(format('SELECT public.place_bid(%L,10000000,gen_random_uuid())',(SELECT j->>'id' FROM auction)),'P0001','Owner cannot bid','no self bid');
SELECT set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-4000-8000-000000000004","role":"authenticated"}',true);
SELECT throws_ok(format('SELECT public.place_bid(%L,10000000,gen_random_uuid())',(SELECT j->>'id' FROM auction)),'P0001','Verified email required','unverified blocked');
SELECT set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}',true);
CREATE TEMP TABLE bid AS SELECT public.place_bid((SELECT (j->>'id')::uuid FROM auction),10000000,'bbbbbbbb-0000-4000-8000-000000000001') j;
SELECT is(public.place_bid((SELECT (j->>'id')::uuid FROM auction),10000000,'bbbbbbbb-0000-4000-8000-000000000001')->>'id',(SELECT j->>'id' FROM bid),'exact idempotent replay');
SELECT throws_ok(format('SELECT public.place_bid(%L,10010000,''bbbbbbbb-0000-4000-8000-000000000001'')',(SELECT j->>'id' FROM auction)),'P0001','Idempotency key payload mismatch','replay payload must match');
SELECT throws_ok(format('SELECT public.place_bid(%L,10000000,gen_random_uuid())',(SELECT j->>'id' FROM auction)),'P0001','Bid below minimum','equal ascending bid rejected');
SELECT ok(NOT public.get_catalogue()::text LIKE '%Private exact address%','catalogue excludes address');
SELECT is((SELECT current_bid_minor FROM jsonb_to_recordset(public.get_catalogue()) AS x(id uuid,current_bid_minor bigint) WHERE id=(SELECT id FROM app.listings WHERE auction_id=(SELECT (j->>'id')::uuid FROM auction))),10000000::bigint,'ascending public amount');
SELECT set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-4000-8000-000000000003","role":"authenticated"}',true);
SELECT is(jsonb_array_length(public.get_workspace()->'bids'),0,'unrelated user cannot see bids');
SET LOCAL ROLE authenticated;
SELECT throws_ok('SELECT * FROM app.bids','42501',NULL,'no direct bid table access');
RESET ROLE;
UPDATE app.auctions SET ends_at=clock_timestamp()-interval '1 second' WHERE id=(SELECT (j->>'id')::uuid FROM auction);
SELECT throws_ok(format('SELECT public.place_bid(%L,10010000,gen_random_uuid())',(SELECT j->>'id' FROM auction)),'P0001','Auction is not accepting bids','deadline enforced without cron');
SELECT set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',true);
CREATE TEMP TABLE reservation AS SELECT public.request_reservation((SELECT (j->>'id')::uuid FROM bid),10000,'cccccccc-0000-4000-8000-000000000001') j;
SELECT throws_ok(format('SELECT public.start_auction(%L,''ascending'',''public'',now(),now()+interval ''1 hour'',1,1)',(SELECT id FROM app.listings WHERE property_id=(SELECT (j->>'id')::uuid FROM fixture) AND transaction_type='rent')),'P0001','Property is reserved','reservation blocks linked auction');
SELECT set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}',true);
SELECT is(public.advance_reservation((SELECT (j->>'id')::uuid FROM reservation),'fund',gen_random_uuid())->>'deposit_status','funded','buyer funds simulation');
SELECT is(public.advance_reservation((SELECT (j->>'id')::uuid FROM reservation),'sign',gen_random_uuid())->>'status','funded','one signature insufficient');
SELECT set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}',true);
SELECT is(public.advance_reservation((SELECT (j->>'id')::uuid FROM reservation),'sign',gen_random_uuid())->>'status','signed','both signatures commit');
SELECT is((SELECT count(*)::integer FROM app.listings WHERE property_id=(SELECT (j->>'id')::uuid FROM fixture) AND status='closed'),2,'sale signing closes both old owner listings');
SELECT ok((SELECT count(*)>0 FROM app.audit_events),'writes append audit');
SELECT * FROM finish();
ROLLBACK;
