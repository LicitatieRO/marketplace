BEGIN;
SET search_path=public,extensions;
SELECT no_plan();
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
 ('37373737-0000-4000-8000-000000000001','compare-owner@example.test',now()),
 ('37373737-0000-4000-8000-000000000002','compare-alpha@example.test',now()),
 ('37373737-0000-4000-8000-000000000003','compare-beta@example.test',now()),
 ('37373737-0000-4000-8000-000000000004','compare-stranger@example.test',now()),
 ('37373737-0000-4000-8000-000000000005','compare-staff@example.test',now());
UPDATE app.profiles SET display_name='Alpha' WHERE id='37373737-0000-4000-8000-000000000002';
UPDATE app.profiles SET display_name='Beta' WHERE id='37373737-0000-4000-8000-000000000003';
UPDATE app.profiles SET is_staff=true WHERE id='37373737-0000-4000-8000-000000000005';
SELECT set_config('request.jwt.claims','{"sub":"37373737-0000-4000-8000-000000000001","role":"authenticated"}',true);
CREATE TEMP TABLE cmp_property AS SELECT public.create_property('Sealed comparison','Description','Cotroceni','Private comparison address','apartment',70,3,2,2010,100000,50000,'{}') j;
CREATE TEMP TABLE cmp_auction AS SELECT public.start_auction((SELECT id FROM app.listings WHERE property_id=(SELECT (j->>'id')::uuid FROM cmp_property) AND transaction_type='sale'),'sealed','public',now()-interval '1 minute',now()+interval '1 hour',1000,100) j;
SELECT is(public.get_sealed_offers((SELECT (j->>'id')::uuid FROM cmp_auction)),'[]'::jsonb,'authorized empty state has no placeholder offers');
SELECT set_config('request.jwt.claims','{"sub":"37373737-0000-4000-8000-000000000002","role":"authenticated"}',true);
CREATE TEMP TABLE lower_offer AS SELECT public.place_bid((SELECT (j->>'id')::uuid FROM cmp_auction),11000,gen_random_uuid()) j;
SELECT throws_ok(format('SELECT public.get_sealed_offers(%L)',(SELECT j->>'id' FROM cmp_auction)),'42501','Owner or staff MFA required','bidder cannot compare any private offers');
SELECT set_config('request.jwt.claims','{"sub":"37373737-0000-4000-8000-000000000003","role":"authenticated"}',true);
SELECT public.place_bid((SELECT (j->>'id')::uuid FROM cmp_auction),22000,gen_random_uuid());
SELECT throws_ok(format('SELECT public.get_sealed_offers(%L)',(SELECT j->>'id' FROM cmp_auction)),'42501','Owner or staff MFA required','second bidder cannot see competing amount or name');
SELECT set_config('request.jwt.claims','{"sub":"37373737-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
SELECT throws_ok(format('SELECT public.get_sealed_offers(%L)',(SELECT j->>'id' FROM cmp_auction)),'42501','Owner or staff MFA required','AAL2 alone grants no staff privilege');
SELECT set_config('request.jwt.claims','{"sub":"37373737-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}',true);
SELECT throws_ok(format('SELECT public.get_sealed_offers(%L)',(SELECT j->>'id' FROM cmp_auction)),'42501','Owner or staff MFA required','staff needs MFA');
SELECT set_config('request.jwt.claims','{"sub":"37373737-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}',true);
SELECT is(jsonb_array_length(public.get_sealed_offers((SELECT (j->>'id')::uuid FROM cmp_auction))),2,'staff with MFA can compare');
SELECT set_config('request.jwt.claims','{"sub":"37373737-0000-4000-8000-000000000001","role":"authenticated"}',true);
CREATE TEMP TABLE comparison AS SELECT public.get_sealed_offers((SELECT (j->>'id')::uuid FROM cmp_auction)) j;
SELECT is(jsonb_array_length((SELECT j FROM comparison)),2,'owner sees both offers while auction is open');
SELECT is((SELECT array_agg((row->>'amount_minor')::bigint ORDER BY (row->>'amount_minor')::bigint) FROM comparison,jsonb_array_elements(j) row),ARRAY[11000,22000]::bigint[],'owner receives exact amounts');
SELECT is((SELECT array_agg(row->>'bidder_display_name' ORDER BY row->>'bidder_display_name') FROM comparison,jsonb_array_elements(j) row),ARRAY['Alpha','Beta'],'owner receives bidder display names');
SELECT ok(NOT (SELECT j::text FROM comparison) LIKE '%@example.test%' AND NOT (SELECT j::text FROM comparison) LIKE '%Private comparison address%','read contract omits contact email and address');
SELECT is(public.get_listing((SELECT (j->>'listing_id')::uuid FROM cmp_auction))->>'current_bid_minor',NULL,'public listing still hides confidential amounts');
SELECT is((SELECT count(*)::integer FROM app.reservations WHERE property_id=(SELECT (j->>'id')::uuid FROM cmp_property)),0,'comparison does not award or reserve automatically');
SELECT throws_ok(format('SELECT public.request_reservation(%L,100,gen_random_uuid())',(SELECT j->>'id' FROM lower_offer)),'P0001','Auction must expire first','selection remains unavailable before closing');
UPDATE app.auctions SET ends_at=clock_timestamp()-interval '1 millisecond' WHERE id=(SELECT (j->>'id')::uuid FROM cmp_auction);
SELECT lives_ok(format('SELECT public.request_reservation(%L,100,gen_random_uuid())',(SELECT j->>'id' FROM lower_offer)),'owner may choose lower sealed offer after closing');
SELECT is((SELECT buyer_id::text FROM app.reservations WHERE property_id=(SELECT (j->>'id')::uuid FROM cmp_property)),'37373737-0000-4000-8000-000000000002','owner selection is not automatic highest award');
SELECT set_config('test.cmp_auction',(SELECT j->>'id' FROM cmp_auction),true);
SET LOCAL ROLE anon;
SELECT throws_ok('SELECT public.get_sealed_offers(current_setting(''test.cmp_auction'')::uuid)','42501',NULL,'anonymous role cannot execute comparison RPC');
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"37373737-0000-4000-8000-000000000001","role":"authenticated"}',true);
SELECT throws_ok('SELECT public.get_sealed_offers(''00000000-0000-4000-8000-000000000000'')','42501','Owner or staff MFA required','unknown/private IDs share a safe denial');
SELECT * FROM finish();
ROLLBACK;
