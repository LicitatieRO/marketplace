BEGIN;
SELECT plan(4);

SELECT has_column('app', 'external_auction_listings', 'category', 'category column exists');

SELECT ok(
  (SELECT conname IS NOT NULL
   FROM pg_constraint
   WHERE conrelid = 'app.external_auction_listings'::regclass
     AND conname = 'external_auction_listings_category_check'),
  'category check constraint present'
);

SELECT ok(
  (SELECT elem->>'category' IS NOT NULL
   FROM jsonb_array_elements(public.get_external_auction_listings()) elem
   LIMIT 1)
  OR (SELECT jsonb_array_length(public.get_external_auction_listings()) = 0),
  'get_external_auction_listings exposes category when rows exist'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(public.get_external_auction_listings()) elem
    WHERE elem ? 'repes_case_id'
  ),
  'public RPC still omits internal case ids'
);

SELECT * FROM finish();
ROLLBACK;
