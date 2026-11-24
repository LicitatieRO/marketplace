BEGIN;
SET search_path = public, extensions;
SELECT plan(19);

SELECT has_table('app', 'external_auction_listings', 'external auction table exists');

SELECT ok(
  NOT has_table_privilege('anon', 'app.external_auction_listings', 'SELECT'),
  'anon has no direct table select'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'app.external_auction_listings', 'SELECT'),
  'authenticated has no direct table select'
);

SELECT ok(
  has_function_privilege('anon', 'public.get_external_auction_listings()', 'EXECUTE'),
  'anon may call get_external_auction_listings'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.get_external_auction_listings()', 'EXECUTE'),
  'authenticated may call get_external_auction_listings'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.upsert_external_auction_listing(text,text,text,text,text,text,text,text,integer,bigint,text,bigint,timestamptz,text,text,boolean)',
    'EXECUTE'
  ),
  'anon cannot upsert external auctions'
);
SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.upsert_external_auction_listing(text,text,text,text,text,text,text,text,integer,bigint,text,bigint,timestamptz,text,text,boolean)',
    'EXECUTE'
  ),
  'authenticated cannot upsert external auctions'
);
SELECT ok(
  has_function_privilege(
    'service_role',
    'public.upsert_external_auction_listing(text,text,text,text,text,text,text,text,integer,bigint,text,bigint,timestamptz,text,text,boolean)',
    'EXECUTE'
  ),
  'service_role can upsert external auctions'
);

SET LOCAL ROLE anon;
SELECT throws_ok(
  'SELECT * FROM app.external_auction_listings',
  '42501',
  NULL,
  'anon direct select blocked'
);
SELECT throws_ok(
  $$ INSERT INTO app.external_auction_listings(source, source_id, repes_case_id, repes_auction_id, category, property_type, locality_label, judet, price_minor, auction_at, issuing_authority, source_url)
     VALUES ('repes','x','h','a','other','other','Sector 2','București',100,'2099-01-01','X','https://prod.executori.ro/repes/') $$,
  '42501',
  NULL,
  'anon direct insert blocked'
);
SELECT throws_ok(
  $$ UPDATE app.external_auction_listings SET locality_label = 'x' WHERE false $$,
  '42501',
  NULL,
  'anon direct update blocked'
);
SELECT throws_ok(
  $$ SELECT public.upsert_external_auction_listing(
    'repes','repes:SYNTH:1','SYNTH','1','real_estate','apartment','Sector 2','București',72,10000,'RON',1000,
    clock_timestamp(),'Executor POC','https://prod.executori.ro/repes/',false
  ) $$,
  '42501',
  NULL,
  'anon upsert blocked'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT throws_ok(
  'SELECT * FROM app.external_auction_listings',
  '42501',
  NULL,
  'authenticated direct select blocked'
);
SELECT throws_ok(
  $$ INSERT INTO app.external_auction_listings(source, source_id, repes_case_id, repes_auction_id, category, property_type, locality_label, judet, price_minor, auction_at, issuing_authority, source_url)
     VALUES ('repes','y','h','a','other','other','Sector 2','București',100,'2099-01-01','X','https://prod.executori.ro/repes/') $$,
  '42501',
  NULL,
  'authenticated direct insert blocked'
);
SELECT throws_ok(
  $$ UPDATE app.external_auction_listings SET locality_label = 'x' WHERE false $$,
  '42501',
  NULL,
  'authenticated direct update blocked'
);
SELECT throws_ok(
  $$ SELECT public.upsert_external_auction_listing(
    'repes','repes:SYNTH:2','SYNTH','2','vehicle','vehicle','Sector 2','București',null,10000,'RON',1000,
    clock_timestamp(),'Executor POC','https://prod.executori.ro/repes/',false
  ) $$,
  '42501',
  NULL,
  'authenticated upsert blocked'
);
RESET ROLE;

SELECT lives_ok(
  $$ SELECT public.get_external_auction_listings() $$,
  'get_external_auction_listings executes'
);
SELECT ok(
  (SELECT jsonb_array_length(public.get_external_auction_listings())) >= 0,
  'returns json array'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(public.get_external_auction_listings()) elem
    WHERE elem ? 'repes_case_id' OR elem ? 'fileNo'
  ),
  'public RPC omits internal case ids'
);

SELECT * FROM finish();
ROLLBACK;
