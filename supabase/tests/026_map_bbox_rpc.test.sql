BEGIN;
SET search_path = public, extensions;
SELECT plan(8);

SELECT ok(
  has_function_privilege('anon', 'public.get_map_listings_in_bbox(double precision,double precision,double precision,double precision,integer)', 'EXECUTE'),
  'anon may execute bbox RPC'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.get_map_listings_in_bbox(double precision,double precision,double precision,double precision,integer)', 'EXECUTE'),
  'authenticated may execute bbox RPC'
);
SELECT ok(
  NOT has_function_privilege('anon', 'app.sample_public_coords_from_exact(double precision,double precision)', 'EXECUTE'),
  'anon cannot call internal public-coord sampler directly'
);

SELECT throws_ok(
  $$SELECT public.get_map_listings_in_bbox('NaN'::double precision, 44.3, 26.3, 44.5, 50)$$,
  'P0001',
  NULL,
  'NaN west rejected'
);

SELECT throws_ok(
  $$SELECT public.get_map_listings_in_bbox(26.3, 44.3, 25.9, 44.5, 50)$$,
  'P0001',
  NULL,
  'invalid bbox rejected'
);

SELECT has_index('app', 'properties', 'properties_public_lat_lng_idx', 'public lat/lng index exists for bbox query');

-- Hard cap: insert more than 200 published sale rows; bbox must cover approx pins (up to ~500 m offset).
INSERT INTO app.properties(
  id, owner_id, title, description, neighborhood, exact_address, property_type,
  area_sqm, rooms, floor, built_year, lat, lng, judet
)
SELECT
  ('02602602-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
  '11111111-1111-4111-8111-111111111111',
  'Cap fixture', 'Fixture', 'Cap', 'Private cap', 'apartment',
  40, 2, 1, 2000,
  44.352,
  26.155,
  'București'
FROM generate_series(1, 205) AS g;

-- Pin public coords inside the cap-test bbox (RPC filters on public_*, not exact).
WITH numbered AS (
  SELECT id, row_number() OVER (ORDER BY id) AS rn
  FROM app.properties
  WHERE id >= '02602602-0000-4000-8000-000000000001'::uuid
    AND id <= '02602602-0000-4000-8000-000000000205'::uuid
)
UPDATE app.properties p
SET
  public_lat = 44.352 + (n.rn % 20) * 0.00005,
  public_lng = 26.155 + floor(n.rn / 20.0) * 0.00005
FROM numbered n
WHERE p.id = n.id;

INSERT INTO app.listings(id, property_id, owner_id, transaction_type, price_minor, status)
SELECT
  ('02602603-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
  ('02602602-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
  '11111111-1111-4111-8111-111111111111',
  'sale',
  10000000 + g,
  'published'
FROM generate_series(1, 205) AS g;

SELECT is(
  jsonb_array_length(public.get_map_listings_in_bbox(26.148, 44.347, 26.162, 44.357, 200)),
  200,
  'bbox RPC hard-caps rows at 200 when more than 200 match'
);

SELECT is(
  jsonb_array_length(public.get_map_listings_in_bbox(26.148, 44.347, 26.162, 44.357, 500)),
  200,
  'bbox RPC still caps at 200 regardless of requested limit'
);

SELECT * FROM finish();
ROLLBACK;