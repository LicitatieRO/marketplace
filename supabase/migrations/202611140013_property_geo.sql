-- Approximate neighbourhood pins for Bucharest demo properties (not exact addresses).
-- Extends listing_json from 202611140010 with optional lat/lng.

ALTER TABLE app.properties
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;

ALTER TABLE app.properties
  DROP CONSTRAINT IF EXISTS properties_lat_bounds,
  DROP CONSTRAINT IF EXISTS properties_lng_bounds,
  DROP CONSTRAINT IF EXISTS properties_lat_lng_pair;

ALTER TABLE app.properties
  ADD CONSTRAINT properties_lat_bounds CHECK (lat IS NULL OR lat BETWEEN 44.350 AND 44.545),
  ADD CONSTRAINT properties_lng_bounds CHECK (lng IS NULL OR lng BETWEEN 25.960 AND 26.230),
  ADD CONSTRAINT properties_lat_lng_pair CHECK ((lat IS NULL) = (lng IS NULL));

CREATE OR REPLACE FUNCTION app.listing_json(p_listing_id uuid) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
 SELECT jsonb_build_object(
 'id',l.id,'property_id',p.id,'title',p.title,'description',p.description,'neighborhood',p.neighborhood,'property_type',p.property_type,
 'transaction_type',l.transaction_type,'price_minor',l.price_minor,'currency',l.currency,'area_sqm',p.area_sqm,'rooms',p.rooms,'floor',p.floor,'built_year',p.built_year,'image_urls',p.image_urls,'tenancy_status',p.tenancy_status,'status',l.status,'tour_url',p.tour_url,
 'lat',p.lat,'lng',p.lng,
 'promo_expires_at',app.active_promo_expires(p.id),
 'auction_id',a.id,'auction_mode',a.mode,'auction_access',a.access,
 'ends_at',CASE WHEN eligible.yes THEN a.ends_at END,'starts_at',CASE WHEN eligible.yes THEN a.starts_at END,
 'current_bid_minor',CASE WHEN eligible.yes AND a.mode='ascending' THEN (SELECT max(amount_minor) FROM app.bids WHERE auction_id=a.id) END,
 'bid_count',CASE WHEN eligible.yes THEN (SELECT count(*) FROM app.bids WHERE auction_id=a.id) ELSE 0 END,
 'min_increment_minor',CASE WHEN eligible.yes THEN a.min_increment_minor END,'starting_price_minor',CASE WHEN eligible.yes THEN a.starting_price_minor END)
 || CASE
  WHEN (SELECT auth.uid()) = l.owner_id OR (SELECT auth.role()) = 'service_role'
  THEN jsonb_build_object('owner_id', l.owner_id)
  ELSE '{}'::jsonb
 END
 FROM app.listings l JOIN app.properties p ON p.id=l.property_id LEFT JOIN app.auctions a ON a.id=l.auction_id
 CROSS JOIN LATERAL(SELECT a.access='public' OR a.owner_id=auth.uid() OR EXISTS(SELECT 1 FROM app.auction_members m WHERE m.auction_id=a.id AND m.user_id=auth.uid()) AS yes) eligible
 WHERE l.id=p_listing_id
$$;