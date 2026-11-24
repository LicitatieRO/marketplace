BEGIN;
SELECT plan(8);

SELECT has_table('app', 'external_auction_listings', 'external auction table exists');
SELECT ok(
  NOT has_table_privilege('anon', 'app.external_auction_listings', 'SELECT'),
  'anon has no direct table select'
);
SELECT ok(
  has_function_privilege('anon', 'public.get_external_auction_listings()', 'EXECUTE'),
  'anon may call get_external_auction_listings'
);
SELECT throws_ok(
  $$ SELECT public.upsert_external_auction_listing(
    'repes','repes:SYNTH:1','SYNTH','1','apartment','Sector 2','București',72,10000,'RON',1000,
    clock_timestamp(),'Executor POC','https://prod.executori.ro/repes/',false
  ) $$,
  'P0001',
  'Forbidden',
  'non-service ingest is forbidden'
);
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

SELECT throws_ok(
  'SELECT * FROM app.external_auction_listings',
  '42501',
  NULL,
  'direct table read blocked'
);

SELECT * FROM finish();
ROLLBACK;
