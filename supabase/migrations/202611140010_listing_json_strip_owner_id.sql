-- GDPR data minimisation (PM 2026-11-14): omit owner_id from public/anon
-- listing_json, and from other authenticated users. Keep the key only for
-- the authenticated owner viewing their own listing, and for service_role.
-- PREP ONLY — do not apply to hosted staging (see GitHub env SUPABASE_PROJECT_REF), production, or any
-- other project from this folder.
--
-- Depends on 006 (payments / promo_expires_at). This CREATE OR REPLACE copies
-- that migration's listing_json shape, including promo_expires_at via
-- app.active_promo_expires(p.id).
--
-- get_catalogue / get_listing are unchanged thin SECURITY DEFINER wrappers.
-- app.listing_json stays executable by postgres only.

CREATE OR REPLACE FUNCTION app.listing_json(p_listing_id uuid) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
 SELECT jsonb_build_object(
 'id',l.id,'property_id',p.id,'title',p.title,'description',p.description,'neighborhood',p.neighborhood,'property_type',p.property_type,
 'transaction_type',l.transaction_type,'price_minor',l.price_minor,'currency',l.currency,'area_sqm',p.area_sqm,'rooms',p.rooms,'floor',p.floor,'built_year',p.built_year,'image_urls',p.image_urls,'tenancy_status',p.tenancy_status,'status',l.status,'tour_url',p.tour_url,
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