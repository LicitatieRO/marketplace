-- Widen property geo CHECKs to all of Romania (was Bucharest-only in 202611140013).
-- Numeric bounds must match src/lib/geo-bounds.ts (ROMANIA_BBOX).

ALTER TABLE app.properties
  DROP CONSTRAINT IF EXISTS properties_lat_bounds,
  DROP CONSTRAINT IF EXISTS properties_lng_bounds;

ALTER TABLE app.properties
  ADD CONSTRAINT properties_lat_bounds CHECK (lat IS NULL OR lat BETWEEN 43.47 AND 48.42),
  ADD CONSTRAINT properties_lng_bounds CHECK (lng IS NULL OR lng BETWEEN 20.11 AND 30.20);