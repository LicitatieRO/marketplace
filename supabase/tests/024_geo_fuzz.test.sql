BEGIN;
SET search_path = public, extensions;
SELECT plan(9);

CREATE OR REPLACE FUNCTION _test_legacy_fuzz_lat(p_property_id uuid, p_lat double precision) RETURNS double precision
LANGUAGE sql IMMUTABLE AS $$
  SELECT round((p_lat + (
    (300.0 + (abs((('x' || substr(md5(p_property_id::text), 1, 8))::bit(32))::bigint) % 201)
    / 111320.0) * cos(radians((abs((('x' || substr(md5(p_property_id::text), 9, 8))::bit(32))::bigint) % 360)::double precision))
  ))::numeric, 3)::double precision;
$$;

CREATE OR REPLACE FUNCTION _test_geo_distance_m(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
) RETURNS double precision LANGUAGE sql IMMUTABLE AS $$
  SELECT 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

SELECT ok(
  app.rounded_public_lat((SELECT p FROM app.properties p WHERE id = '10000000-0000-4000-8000-000000000001'))
    IS DISTINCT FROM _test_legacy_fuzz_lat('10000000-0000-4000-8000-000000000001'::uuid, 44.46463),
  'public pin is not reproducible from legacy md5 formula'
);

SELECT ok(
  _test_geo_distance_m(
    (SELECT lat FROM app.properties WHERE id = '10000000-0000-4000-8000-000000000001'),
    (SELECT lng FROM app.properties WHERE id = '10000000-0000-4000-8000-000000000001'),
    (SELECT public_lat FROM app.properties WHERE id = '10000000-0000-4000-8000-000000000001'),
    (SELECT public_lng FROM app.properties WHERE id = '10000000-0000-4000-8000-000000000001')
  ) BETWEEN 300 AND 500,
  'exact-to-public distance within 300-500 m'
);

INSERT INTO app.properties(
  id, owner_id, title, description, neighborhood, exact_address, property_type,
  area_sqm, rooms, floor, built_year, lat, lng, judet
) VALUES
(
  '02402402-0000-4000-8000-0000000000a1',
  '11111111-1111-4111-8111-111111111111',
  'Dup lat A', 'Fixture', 'Centru', 'Private 1', 'apartment',
  40, 2, 1, 2000, 45.10001, 25.20001, 'Brașov'
),
(
  '02402402-0000-4000-8000-0000000000a2',
  '11111111-1111-4111-8111-111111111111',
  'Dup lat B', 'Fixture', 'Centru', 'Private 2', 'apartment',
  40, 2, 1, 2000, 45.10001, 25.20001, 'Brașov'
);

SELECT ok(
  (SELECT public_lat FROM app.properties WHERE id = '02402402-0000-4000-8000-0000000000a1')
    IS DISTINCT FROM (SELECT public_lat FROM app.properties WHERE id = '02402402-0000-4000-8000-0000000000a2'),
  'two properties at same exact point get different public_lat'
);

SELECT ok(
  coalesce(length(split_part(app.rounded_public_lat((SELECT p FROM app.properties p WHERE id = '10000000-0000-4000-8000-000000000001'))::text, '.', 2)), 0) <= 3,
  'rounded public lat has at most 3 decimal places'
);

SELECT ok(
  (SELECT public_lat FROM app.properties WHERE id = '10000000-0000-4000-8000-000000000001')
    IS DISTINCT FROM (SELECT lat FROM app.properties WHERE id = '10000000-0000-4000-8000-000000000001')
    OR (SELECT public_lng FROM app.properties WHERE id = '10000000-0000-4000-8000-000000000001')
      IS DISTINCT FROM (SELECT lng FROM app.properties WHERE id = '10000000-0000-4000-8000-000000000001'),
  'public coords differ from exact on seed property'
);

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

UPDATE app.properties
SET built_year = built_year
WHERE id = '10000000-0000-4000-8000-000000000001';

SELECT is(
  (SELECT public_lat::text FROM app.properties WHERE id = '10000000-0000-4000-8000-000000000001'),
  current_setting('test.public_lat'),
  'public_lat stable when only non-geo columns change'
);

UPDATE app.properties
SET lat = lat
WHERE id = '10000000-0000-4000-8000-000000000001';

SELECT is(
  (SELECT public_lat::text FROM app.properties WHERE id = '10000000-0000-4000-8000-000000000001'),
  current_setting('test.public_lat'),
  'public_lat stable when exact lat assigned same value (seed idempotent)'
);

UPDATE app.properties
SET lat = (SELECT lat FROM app.properties WHERE id = '10000000-0000-4000-8000-000000000001') + 0.01
WHERE id = '10000000-0000-4000-8000-000000000001';

SELECT ok(
  (SELECT public_lat::text FROM app.properties WHERE id = '10000000-0000-4000-8000-000000000001')
    IS DISTINCT FROM current_setting('test.public_lat'),
  'public_lat resampled when exact lat changes'
);

UPDATE app.properties
SET lng = (SELECT lng FROM app.properties WHERE id = '10000000-0000-4000-8000-000000000001') + 0.01
WHERE id = '10000000-0000-4000-8000-000000000001';

SELECT ok(
  (SELECT public_lng::text FROM app.properties WHERE id = '10000000-0000-4000-8000-000000000001')
    IS DISTINCT FROM current_setting('test.public_lng'),
  'public_lng resampled when exact lng changes'
);

DELETE FROM app.properties
WHERE id IN (
  '02402402-0000-4000-8000-0000000000a1'::uuid,
  '02402402-0000-4000-8000-0000000000a2'::uuid
);

SELECT * FROM finish();
ROLLBACK;