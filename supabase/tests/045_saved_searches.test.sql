BEGIN;
SET search_path=public,extensions;
SELECT no_plan();
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
 ('41414141-0000-4000-8000-000000000001','search-owner@example.test',now()),
 ('41414141-0000-4000-8000-000000000002','search-buyer@example.test',now()),
 ('41414141-0000-4000-8000-000000000003','search-other@example.test',now()),
 ('41414141-0000-4000-8000-000000000004','search-unverified@example.test',NULL);
SELECT set_config('request.jwt.claims','{"sub":"41414141-0000-4000-8000-000000000001","role":"authenticated"}',true);
CREATE TEMP TABLE search_property AS SELECT public.create_property('Search test property','Description','Cotroceni','Private saved-search address','apartment',70,3,2,2010,100000,NULL,'{}') j;
SELECT set_config('test.search_listing',(SELECT id::text FROM app.listings WHERE property_id=(SELECT (j->>'id')::uuid FROM search_property)),true);
SELECT set_config('request.jwt.claims','{"sub":"41414141-0000-4000-8000-000000000002","role":"authenticated"}',true);
CREATE TEMP TABLE my_search AS SELECT public.save_saved_search('My home','{"transaction_type":"sale","neighborhood":"Cotroceni","max_price_minor":200000,"min_rooms":2}') j;
SELECT set_config('test.search_id',(SELECT j->>'id' FROM my_search),true);
SELECT is(public.save_saved_search('Renamed','{"transaction_type":"sale","neighborhood":"Cotroceni","max_price_minor":200000,"min_rooms":2}')->>'id',(SELECT j->>'id' FROM my_search),'duplicate filters replay same saved search');
SELECT is(jsonb_array_length(public.get_saved_searches()),1,'owner lists one private search');
SELECT throws_ok('SELECT public.save_saved_search(''Bad'',''{"exact_address":"private"}'')','P0001','Invalid saved search filters','personal matching field rejected by DB');
SELECT throws_ok('SELECT public.save_saved_search(''Bad'',''{"min_price_minor":200,"max_price_minor":100}'')','P0001','Invalid saved search filters','reversed bounds rejected by DB');
SELECT throws_ok('SELECT public.save_saved_search(''Bad'',''{"min_rooms":101}'')','P0001','Invalid saved search filters','room ceiling rejected by DB');
SELECT throws_ok('SELECT public.save_saved_search(''Bad'',''{"max_price_minor":1000000000001}'')','P0001','Invalid saved search filters','price ceiling rejected by DB');
SELECT set_config('request.jwt.claims','{"sub":"41414141-0000-4000-8000-000000000004","role":"authenticated"}',true);
SELECT throws_ok('SELECT public.save_saved_search(''No'',''{}'')','P0001','Verified email required','unverified account cannot save');
SELECT set_config('request.jwt.claims','{"sub":"41414141-0000-4000-8000-000000000003","role":"authenticated"}',true);
SELECT is(jsonb_array_length(public.get_saved_searches()),0,'other user sees no private queries');
SELECT is(public.delete_saved_search(current_setting('test.search_id')::uuid),false,'foreign search cannot be deleted');
-- Exercise RLS independently of the production private-schema boundary; rolled back below.
GRANT USAGE ON SCHEMA app TO authenticated;
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::integer FROM app.saved_searches),0,'RLS hides other users searches');
SELECT set_config('request.jwt.claims','{"sub":"41414141-0000-4000-8000-000000000002","role":"authenticated"}',true);
SELECT is((SELECT count(*)::integer FROM app.saved_searches),1,'RLS permits only the owner row');
SELECT set_config('request.jwt.claims','{"sub":"41414141-0000-4000-8000-000000000003","role":"authenticated"}',true);
SELECT throws_ok('INSERT INTO app.saved_searches(user_id,name,filters) VALUES(auth.uid(),''Bypass'',''{}'')','42501',NULL,'direct writes are denied');
RESET ROLE;
REVOKE USAGE ON SCHEMA app FROM authenticated;
SELECT public.save_saved_search('Unrelated','{"neighborhood":"Floreasca"}');

-- Isolate alert scenarios while preserving business transactions under test.
CREATE FUNCTION pg_temp.reset_search_alert() RETURNS void LANGUAGE plpgsql AS $$ BEGIN
 UPDATE app.saved_searches SET last_notified_at=NULL WHERE id=current_setting('test.search_id')::uuid;
 DELETE FROM app.saved_search_alert_limits WHERE user_id='41414141-0000-4000-8000-000000000002';
 DELETE FROM app.notification_outbox WHERE event='search.updated' AND entity_id=current_setting('test.search_id')::uuid;
END $$;
UPDATE app.listings SET price_minor=110000 WHERE id=current_setting('test.search_listing')::uuid;
SELECT is((SELECT count(*)::integer FROM app.notification_outbox WHERE event='search.updated' AND entity_id=current_setting('test.search_id')::uuid),1,'eligible price change queues exactly one alert');
SELECT ok((SELECT last_notified_at IS NOT NULL FROM app.saved_searches WHERE id=current_setting('test.search_id')::uuid),'cooldown saved atomically with queued alert');
UPDATE app.listings SET price_minor=110000 WHERE id=current_setting('test.search_listing')::uuid;
SELECT is((SELECT count(*)::integer FROM app.notification_outbox WHERE event='search.updated' AND entity_id=current_setting('test.search_id')::uuid),1,'identical update does not duplicate alert');
UPDATE app.listings SET price_minor=120000 WHERE id=current_setting('test.search_listing')::uuid;
SELECT is((SELECT count(*)::integer FROM app.notification_outbox WHERE event='search.updated' AND entity_id=current_setting('test.search_id')::uuid),1,'rapid different update respects search cooldown');
SELECT is((SELECT count(*)::integer FROM app.notification_outbox WHERE event='search.updated' AND entity_id IN(SELECT id FROM app.saved_searches WHERE name='Unrelated')),0,'nonmatching search has no alert');

SELECT pg_temp.reset_search_alert();
SAVEPOINT before_alert_rollback;
UPDATE app.listings SET price_minor=130000 WHERE id=current_setting('test.search_listing')::uuid;
ROLLBACK TO SAVEPOINT before_alert_rollback;
SELECT is((SELECT count(*)::integer FROM app.notification_outbox WHERE event='search.updated' AND entity_id=current_setting('test.search_id')::uuid),0,'rolled-back price change has no outbox side effect');
SELECT is((SELECT last_notified_at FROM app.saved_searches WHERE id=current_setting('test.search_id')::uuid),NULL::timestamptz,'rollback also restores cooldown');

UPDATE auth.users SET email_confirmed_at=NULL WHERE id='41414141-0000-4000-8000-000000000002';
UPDATE app.listings SET price_minor=140000 WHERE id=current_setting('test.search_listing')::uuid;
SELECT is((SELECT count(*)::integer FROM app.notification_outbox WHERE event='search.updated'),0,'unverified recipient is excluded at enqueue');
UPDATE auth.users SET email_confirmed_at=now() WHERE id='41414141-0000-4000-8000-000000000002';
UPDATE app.listings SET price_minor=150000 WHERE id=current_setting('test.search_listing')::uuid;
UPDATE auth.users SET email_confirmed_at=NULL WHERE id='41414141-0000-4000-8000-000000000002';
SELECT is(jsonb_array_length(public.claim_notifications(50)),0,'email verification is rechecked before delivery claim');
UPDATE auth.users SET email_confirmed_at=now() WHERE id='41414141-0000-4000-8000-000000000002';
SELECT is(jsonb_array_length(public.claim_notifications(50)),1,'verified queued recipient becomes claimable');

SELECT pg_temp.reset_search_alert();
UPDATE app.listings SET price_minor=300000 WHERE id=current_setting('test.search_listing')::uuid;
SELECT is((SELECT count(*)::integer FROM app.notification_outbox WHERE event='search.updated'),1,'old matching price can alert when new price leaves filter');
SELECT pg_temp.reset_search_alert();
UPDATE app.listings SET price_minor=310000 WHERE id=current_setting('test.search_listing')::uuid;
SELECT is((SELECT count(*)::integer FROM app.notification_outbox WHERE event='search.updated'),0,'both nonmatching price snapshots are excluded');
UPDATE app.listings SET price_minor=160000 WHERE id=current_setting('test.search_listing')::uuid;
SELECT pg_temp.reset_search_alert();
UPDATE app.listings SET status='closed' WHERE id=current_setting('test.search_listing')::uuid;
SELECT is((SELECT count(*)::integer FROM app.notification_outbox WHERE event='search.updated'),1,'closing a matching published listing queues a status alert');
SELECT pg_temp.reset_search_alert();
INSERT INTO app.saved_search_alert_limits(user_id,window_started_at,queued_count) VALUES('41414141-0000-4000-8000-000000000002',clock_timestamp(),5);
UPDATE app.listings SET status='published' WHERE id=current_setting('test.search_listing')::uuid;
SELECT is((SELECT count(*)::integer FROM app.notification_outbox WHERE event='search.updated'),0,'account hourly cap cannot be bypassed by resetting search cooldown');

SELECT set_config('request.jwt.claims','{"sub":"41414141-0000-4000-8000-000000000002","role":"authenticated"}',true);
SELECT public.save_saved_search('Extra '||i,jsonb_build_object('neighborhood','Unused '||i)) FROM generate_series(1,4) i;
SELECT throws_ok('SELECT public.save_saved_search(''Sixth'',''{"min_rooms":99}'')','P0001','Saved search limit reached','per-account capacity fails explicitly');
SELECT is(public.save_saved_search('At limit replay','{"transaction_type":"sale","neighborhood":"Cotroceni","max_price_minor":200000,"min_rooms":2}')->>'id',current_setting('test.search_id'),'replay still works at account limit');

-- Bound fanout by an enforced global capacity, without silently truncating recipients.
CREATE TEMP TABLE cap_users AS SELECT gen_random_uuid() id FROM generate_series(1,200);
INSERT INTO auth.users(id,email,email_confirmed_at) SELECT id,'search-cap-'||id||'@example.test',now() FROM cap_users;
INSERT INTO app.saved_searches(user_id,name,filters)
 SELECT id,'Capacity fixture',jsonb_build_object('min_rooms',i) FROM cap_users CROSS JOIN generate_series(0,4) i
 ORDER BY id,i LIMIT(SELECT 1000-count(*) FROM app.saved_searches);
SELECT is((SELECT count(*)::integer FROM app.saved_searches),1000,'global capacity fixture reaches exact bound');
SELECT set_config('request.jwt.claims','{"sub":"41414141-0000-4000-8000-000000000001","role":"authenticated"}',true);
SELECT throws_ok('SELECT public.save_saved_search(''Overflow'',''{}'')','P0001','Saved search capacity reached','global capacity fails instead of dropping alerts');
SELECT set_config('request.jwt.claims','{"sub":"41414141-0000-4000-8000-000000000002","role":"authenticated"}',true);
INSERT INTO app.notification_outbox(user_id,event,entity_id) VALUES('41414141-0000-4000-8000-000000000002','search.updated',current_setting('test.search_id')::uuid);
SELECT is(public.delete_saved_search(current_setting('test.search_id')::uuid),true,'owner can delete own search');
SELECT is(public.delete_saved_search(current_setting('test.search_id')::uuid),false,'delete replay is harmless');
SELECT is((SELECT count(*)::integer FROM app.notification_outbox WHERE event='search.updated' AND entity_id=current_setting('test.search_id')::uuid),0,'delete removes pending alerts for that search');
SELECT * FROM finish();
ROLLBACK;
