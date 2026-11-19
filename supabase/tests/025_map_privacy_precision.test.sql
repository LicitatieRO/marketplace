BEGIN;
SET search_path = public, extensions;
SELECT plan(16);

SELECT set_config(
  'test.public_lat',
  (SELECT public_lat::text FROM app.properties WHERE id = '10000000-0000-4000-8000-000000000001'),
  true
);
SELECT set_config(
  'test.public_lng',
  (SELECT public_lng::text FROM app.properties WHERE id = '10000000-0000-4000-8000-000000000001'),
  true
);

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT ok(
  coalesce(length(split_part((public.get_listing('20000000-0000-4000-8000-000000000001'::uuid)->>'lat'), '.', 2)), 0) <= 3,
  'anon listing_json lat <= 3 decimal places'
);
SELECT ok(
  coalesce(length(split_part((public.get_listing('20000000-0000-4000-8000-000000000001'::uuid)->>'lng'), '.', 2)), 0) <= 3,
  'anon listing_json lng <= 3 decimal places'
);
SELECT is(
  (public.get_listing('20000000-0000-4000-8000-000000000001'::uuid)->>'lat')::numeric,
  round(current_setting('test.public_lat')::numeric, 3),
  'anon listing_json lat equals rounded public_lat column'
);
SELECT is(
  (public.get_listing('20000000-0000-4000-8000-000000000001'::uuid)->>'lng')::numeric,
  round(current_setting('test.public_lng')::numeric, 3),
  'anon listing_json lng equals rounded public_lng column'
);
SELECT lives_ok(
  $$SELECT public.get_map_listings_in_bbox(25.9, 44.3, 26.3, 44.5, 50)$$,
  'anon bbox RPC executes'
);
SELECT ok(
  NOT (SELECT elem FROM jsonb_array_elements(public.get_map_listings_in_bbox(25.9, 44.3, 26.3, 44.5, 50)) AS t(elem) LIMIT 1) ? 'owner_id',
  'bbox payload omits owner_id'
);
SELECT ok(
  NOT (SELECT elem FROM jsonb_array_elements(public.get_map_listings_in_bbox(25.9, 44.3, 26.3, 44.5, 50)) AS t(elem) LIMIT 1) ? 'exact_address',
  'bbox payload omits exact_address'
);
SELECT is(
  (SELECT (elem->>'approxLat')::numeric FROM jsonb_array_elements(public.get_map_listings_in_bbox(25.9, 44.3, 26.3, 44.5, 50)) AS t(elem) WHERE elem->>'id' = '20000000-0000-4000-8000-000000000001' LIMIT 1),
  round(current_setting('test.public_lat')::numeric, 3),
  'anon map card approxLat equals rounded public_lat'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(public.get_map_listings_in_bbox(26.09894, 44.46438, 26.09994, 44.46488, 50)) AS t(elem)
    WHERE elem->>'id' = '20000000-0000-4000-8000-000000000001'
  ),
  'anon tiny bbox around exact point returns no Floreasca row'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM jsonb_array_elements(public.get_map_listings_in_bbox(
      current_setting('test.public_lng')::double precision - 0.00025,
      current_setting('test.public_lat')::double precision - 0.00025,
      current_setting('test.public_lng')::double precision + 0.00025,
      current_setting('test.public_lat')::double precision + 0.00025,
      50
    )) AS t(elem)
    WHERE elem->>'id' = '20000000-0000-4000-8000-000000000001'
  ),
  'anon tiny bbox around public point returns Floreasca row'
);

RESET ROLE;

INSERT INTO auth.users(id, email, email_confirmed_at)
VALUES ('02502502-0000-4000-8000-000000000002', 'buyer-map@test.local', now())
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"02502502-0000-4000-8000-000000000002","role":"authenticated"}', true);
SELECT ok(
  coalesce(length(split_part((public.get_listing('20000000-0000-4000-8000-000000000001'::uuid)->>'lat'), '.', 2)), 0) <= 3,
  'buyer listing_json lat <= 3 decimal places'
);
SELECT ok(
  coalesce(length(split_part((public.get_listing('20000000-0000-4000-8000-000000000001'::uuid)->>'lng'), '.', 2)), 0) <= 3,
  'buyer listing_json lng <= 3 decimal places'
);
SELECT is(
  (public.get_listing('20000000-0000-4000-8000-000000000001'::uuid)->>'lat')::numeric,
  round(current_setting('test.public_lat')::numeric, 3),
  'buyer listing_json lat equals rounded public_lat column'
);
SELECT ok(
  (public.get_listing('20000000-0000-4000-8000-000000000001'::uuid)->>'lat')::double precision
    IS DISTINCT FROM 44.46463::double precision,
  'buyer listing_json lat differs from seed exact coordinate'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(public.get_map_listings_in_bbox(26.09894, 44.46438, 26.09994, 44.46488, 50)) AS t(elem)
    WHERE elem->>'id' = '20000000-0000-4000-8000-000000000001'
  ),
  'buyer tiny bbox around exact point returns no Floreasca row'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM jsonb_array_elements(public.get_map_listings_in_bbox(
      current_setting('test.public_lng')::double precision - 0.00025,
      current_setting('test.public_lat')::double precision - 0.00025,
      current_setting('test.public_lng')::double precision + 0.00025,
      current_setting('test.public_lat')::double precision + 0.00025,
      50
    )) AS t(elem)
    WHERE elem->>'id' = '20000000-0000-4000-8000-000000000001'
  ),
  'buyer tiny bbox around public point returns Floreasca row'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;