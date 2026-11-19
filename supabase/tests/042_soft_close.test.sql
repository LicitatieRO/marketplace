BEGIN;
SET search_path=public,extensions;
SELECT no_plan();
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
 ('35353535-0000-4000-8000-000000000001','soft-owner@example.test',now()),
 ('35353535-0000-4000-8000-000000000002','soft-buyer@example.test',now());
SELECT set_config('request.jwt.claims','{"sub":"35353535-0000-4000-8000-000000000001","role":"authenticated"}',true);
CREATE TEMP TABLE soft_property AS SELECT public.create_property('Soft close test','Description','Cotroceni','Private soft-close address','apartment',70,3,2,2010,100000,50000,'{}') j;
CREATE TEMP TABLE soft_auction AS SELECT public.start_auction(
 (SELECT id FROM app.listings WHERE property_id=(SELECT (j->>'id')::uuid FROM soft_property) AND transaction_type='sale'),
 'ascending','public',clock_timestamp()-interval '1 minute',clock_timestamp()+interval '10 minutes',1000,100) j;
SELECT is((SELECT (j->>'soft_close_seconds')::integer FROM soft_auction),120,'new ascending auctions use a 120-second window');
SELECT is((SELECT (j->>'max_ends_at')::timestamptz-(j->>'initial_ends_at')::timestamptz FROM soft_auction),interval '30 minutes','extension cap is 30 minutes after initial close');
SELECT set_config('request.jwt.claims','{"sub":"35353535-0000-4000-8000-000000000002","role":"authenticated"}',true);
SELECT lives_ok(format('SELECT public.place_bid(%L,1000,gen_random_uuid())',(SELECT j->>'id' FROM soft_auction)),'outside-window bid accepted');
SELECT is((SELECT ends_at FROM app.auctions WHERE id=(SELECT (j->>'id')::uuid FROM soft_auction)),(SELECT (j->>'ends_at')::timestamptz FROM soft_auction),'outside-window bid does not extend');
UPDATE app.auctions SET ends_at=clock_timestamp()+interval '45 seconds' WHERE id=(SELECT (j->>'id')::uuid FROM soft_auction);
CREATE TEMP TABLE before_extension AS SELECT clock_timestamp() t;
CREATE TEMP TABLE extension_bid AS SELECT public.place_bid((SELECT (j->>'id')::uuid FROM soft_auction),1100,'35353535-1111-4111-8111-000000000001') j;
CREATE TEMP TABLE after_extension AS SELECT ends_at FROM app.auctions WHERE id=(SELECT (j->>'id')::uuid FROM soft_auction);
SELECT ok((SELECT ends_at >= (SELECT t FROM before_extension)+interval '120 seconds' AND ends_at < clock_timestamp()+interval '121 seconds' FROM after_extension),'inside-window bid extends to at least 120 seconds from locked server time');
SELECT is(public.place_bid((SELECT (j->>'id')::uuid FROM soft_auction),1100,'35353535-1111-4111-8111-000000000001'),(SELECT j FROM extension_bid),'retry returns original response');
SELECT is((SELECT ends_at FROM app.auctions WHERE id=(SELECT (j->>'id')::uuid FROM soft_auction)),(SELECT ends_at FROM after_extension),'retry does not extend again');
SELECT throws_ok(format('SELECT public.place_bid(%L,1200,''35353535-1111-4111-8111-000000000001'')',(SELECT j->>'id' FROM soft_auction)),'P0001','Idempotency key payload mismatch','conflicting replay does not create a second bid');
SELECT is((SELECT count(*)::integer FROM app.bids WHERE auction_id=(SELECT (j->>'id')::uuid FROM soft_auction)),2,'only the original two bids exist');

UPDATE app.auctions SET initial_ends_at=clock_timestamp()+interval '30 seconds',ends_at=clock_timestamp()+interval '30 seconds',max_ends_at=clock_timestamp()+interval '90 seconds' WHERE id=(SELECT (j->>'id')::uuid FROM soft_auction);
SELECT lives_ok(format('SELECT public.place_bid(%L,1200,gen_random_uuid())',(SELECT j->>'id' FROM soft_auction)),'bid close to hard cap accepted');
SELECT ok((SELECT ends_at=max_ends_at FROM app.auctions WHERE id=(SELECT (j->>'id')::uuid FROM soft_auction)),'extension stops exactly at cap');
CREATE TEMP TABLE capped_time AS SELECT ends_at FROM app.auctions WHERE id=(SELECT (j->>'id')::uuid FROM soft_auction);
SELECT lives_ok(format('SELECT public.place_bid(%L,1300,gen_random_uuid())',(SELECT j->>'id' FROM soft_auction)),'bid at reached cap accepted before close');
SELECT is((SELECT ends_at FROM app.auctions WHERE id=(SELECT (j->>'id')::uuid FROM soft_auction)),(SELECT ends_at FROM capped_time),'later bid cannot increase a reached cap');
SELECT throws_ok(format('UPDATE app.auctions SET soft_close_seconds=601 WHERE id=%L',(SELECT j->>'id' FROM soft_auction)),'23514',NULL,'window has a configuration ceiling');
SELECT throws_ok(format('UPDATE app.auctions SET max_ends_at=initial_ends_at+interval ''31 minutes'' WHERE id=%L',(SELECT j->>'id' FROM soft_auction)),'23514',NULL,'hard cap cannot exceed 30 minutes');
UPDATE app.auctions SET ends_at=clock_timestamp()-interval '1 second' WHERE id=(SELECT (j->>'id')::uuid FROM soft_auction);
SELECT throws_ok(format('SELECT public.place_bid(%L,1400,gen_random_uuid())',(SELECT j->>'id' FROM soft_auction)),'P0001','Auction is not accepting bids','no extension rescues a late bid');
SELECT is(public.place_bid((SELECT (j->>'id')::uuid FROM soft_auction),1100,'35353535-1111-4111-8111-000000000001'),(SELECT j FROM extension_bid),'a valid replay after closing still returns original response');

-- Legacy/disabled setting remains a fixed deadline, even inside the window.
UPDATE app.auctions SET soft_close_seconds=0,ends_at=clock_timestamp()+interval '20 seconds' WHERE id=(SELECT (j->>'id')::uuid FROM soft_auction);
CREATE TEMP TABLE disabled_end AS SELECT ends_at FROM app.auctions WHERE id=(SELECT (j->>'id')::uuid FROM soft_auction);
SELECT lives_ok(format('SELECT public.place_bid(%L,1400,gen_random_uuid())',(SELECT j->>'id' FROM soft_auction)),'disabled soft-close still accepts valid bids');
SELECT is((SELECT ends_at FROM app.auctions WHERE id=(SELECT (j->>'id')::uuid FROM soft_auction)),(SELECT ends_at FROM disabled_end),'disabled auctions keep fixed deadline');

SELECT set_config('request.jwt.claims','{"sub":"35353535-0000-4000-8000-000000000001","role":"authenticated"}',true);
CREATE TEMP TABLE sealed_property AS SELECT public.create_property('Sealed close test','Description','Cotroceni','Private sealed address','apartment',70,3,2,2010,100000,50000,'{}') j;
CREATE TEMP TABLE sealed_auction AS SELECT public.start_auction(
 (SELECT id FROM app.listings WHERE property_id=(SELECT (j->>'id')::uuid FROM sealed_property) AND transaction_type='sale'),
 'sealed','invite',clock_timestamp()-interval '1 minute',clock_timestamp()+interval '20 seconds',1000,100) j;
SELECT is((SELECT (j->>'soft_close_seconds')::integer FROM sealed_auction),0,'sealed auction has no extension');
SELECT lives_ok(format('SELECT public.invite_bidder(%L,''soft-buyer@example.test'')',(SELECT j->>'id' FROM sealed_auction)),'owner invites eligible bidder');
SELECT set_config('request.jwt.claims','{"sub":"35353535-0000-4000-8000-000000000002","role":"authenticated"}',true);
SELECT lives_ok(format('SELECT public.place_bid(%L,1000,gen_random_uuid())',(SELECT j->>'id' FROM sealed_auction)),'sealed offer accepted near deadline');
SELECT is((SELECT ends_at FROM app.auctions WHERE id=(SELECT (j->>'id')::uuid FROM sealed_auction)),(SELECT (j->>'ends_at')::timestamptz FROM sealed_auction),'sealed offer never extends deadline');
SELECT ok((public.get_listing((SELECT (j->>'listing_id')::uuid FROM sealed_auction))->>'server_now')::timestamptz IS NOT NULL,'eligible listing provides database time');
SELECT is(public.get_listing((SELECT (j->>'listing_id')::uuid FROM sealed_auction))->>'current_bid_minor',NULL,'sealed amount remains private');
SELECT set_config('request.jwt.claims','{"role":"anon"}',true);
SELECT is(public.get_listing((SELECT (j->>'listing_id')::uuid FROM sealed_auction))->>'max_ends_at',NULL,'invite-only cap remains private');
SELECT is(public.get_listing((SELECT (j->>'listing_id')::uuid FROM sealed_auction))->>'initial_ends_at',NULL,'invite-only initial deadline remains private');
SELECT is(public.get_listing((SELECT (j->>'listing_id')::uuid FROM sealed_auction))->>'soft_close_seconds',NULL,'invite-only extension configuration remains private');

-- A pre-migration demo fixture has a fixed cap equal to its previous deadline.
-- Refreshing that controlled fixture must carry the new timing bounds together.
RESET ROLE;
SELECT set_config('app.allow_demo_seed','on',true);
SELECT app.seed_demo_fixture();
UPDATE app.auctions SET soft_close_seconds=0,
 initial_ends_at=clock_timestamp()+interval '1 hour',
 ends_at=clock_timestamp()+interval '1 hour',
 max_ends_at=clock_timestamp()+interval '1 hour'
WHERE id='40000000-0000-4000-8000-000000000001';
SELECT lives_ok('SELECT app.seed_demo_fixture()','authorized seed refresh carries a legacy fixture cap forward');
SELECT ok((SELECT initial_ends_at=ends_at AND max_ends_at=ends_at+interval '30 minutes' AND soft_close_seconds=120
 FROM app.auctions WHERE id='40000000-0000-4000-8000-000000000001'),'refreshed demo uses a coherent fresh deadline and cap');
SELECT * FROM finish();
ROLLBACK;
