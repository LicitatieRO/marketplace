-- A URL is stored, never raw iframe HTML. Only canonical HTTPS embeds from the
-- two supported providers are allowed, with small explicit query allowlists.
CREATE FUNCTION app.canonical_tour_url(p_tour_url text) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE value text:=btrim(p_tour_url);
BEGIN
 IF p_tour_url IS NULL THEN RETURN NULL; END IF;
 IF length(value)>800 THEN RAISE EXCEPTION 'Unsupported tour URL'; END IF;
 IF value ~ '^https://(www[.])?kuula[.]co/share/(collection/)?[A-Za-z0-9_-]{3,80}([?](logo|info|fs|vr|sd|thumbs)=[01](&(logo|info|fs|vr|sd|thumbs)=[01])*)?$' THEN
  RETURN regexp_replace(value,'^https://www[.]kuula[.]co/','https://kuula.co/');
 ELSIF value ~ '^https://my[.]matterport[.]com/show/[?]m=[A-Za-z0-9]{3,64}(&(play|qs|brand|help|search|title|vr|tour|hl)=[01])*$' THEN RETURN value;
 ELSE RAISE EXCEPTION 'Unsupported tour URL'; END IF;
END $$;
REVOKE EXECUTE ON FUNCTION app.canonical_tour_url(text) FROM PUBLIC,anon,authenticated;
ALTER TABLE app.properties ADD COLUMN tour_url text CHECK(tour_url IS NULL OR tour_url=app.canonical_tour_url(tour_url));
CREATE FUNCTION public.set_property_tour(p_property_id uuid,p_tour_url text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=app.require_user(); p app.properties;
BEGIN
 SELECT * INTO p FROM app.properties WHERE id=p_property_id FOR UPDATE;
 IF NOT FOUND OR p.owner_id<>u THEN RAISE EXCEPTION 'Owner required'; END IF;
 PERFORM app.expire_property(p.id);
 IF EXISTS(SELECT 1 FROM app.auctions WHERE property_id=p.id AND status IN ('scheduled','active')) THEN RAISE EXCEPTION 'Property already has an active auction'; END IF;
 IF EXISTS(SELECT 1 FROM app.reservations WHERE property_id=p.id AND status IN ('requested','funded')) THEN RAISE EXCEPTION 'Property is reserved'; END IF;
 UPDATE app.properties SET tour_url=app.canonical_tour_url(p_tour_url) WHERE id=p.id RETURNING * INTO p;
 PERFORM app.audit('property.tour_updated',p.id); RETURN to_jsonb(p);
END $$;
REVOKE EXECUTE ON FUNCTION public.set_property_tour(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_property_tour(uuid,text) TO authenticated;
-- Preserve every original field and private-auction eligibility calculation.
CREATE OR REPLACE FUNCTION app.listing_json(p_listing_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object(
 'id',l.id,'property_id',p.id,'owner_id',l.owner_id,'title',p.title,'description',p.description,'neighborhood',p.neighborhood,'property_type',p.property_type,
 'transaction_type',l.transaction_type,'price_minor',l.price_minor,'currency',l.currency,'area_sqm',p.area_sqm,'rooms',p.rooms,'floor',p.floor,'built_year',p.built_year,'image_urls',p.image_urls,'tenancy_status',p.tenancy_status,'status',l.status,'tour_url',p.tour_url,
 'auction_id',a.id,'auction_mode',a.mode,'auction_access',a.access,
 'ends_at',CASE WHEN eligible.yes THEN a.ends_at END,'starts_at',CASE WHEN eligible.yes THEN a.starts_at END,
 'current_bid_minor',CASE WHEN eligible.yes AND a.mode='ascending' THEN (SELECT max(amount_minor) FROM app.bids WHERE auction_id=a.id) END,
 'bid_count',CASE WHEN eligible.yes THEN (SELECT count(*) FROM app.bids WHERE auction_id=a.id) ELSE 0 END,
 'min_increment_minor',CASE WHEN eligible.yes THEN a.min_increment_minor END,'starting_price_minor',CASE WHEN eligible.yes THEN a.starting_price_minor END)
 FROM app.listings l JOIN app.properties p ON p.id=l.property_id LEFT JOIN app.auctions a ON a.id=l.auction_id
 CROSS JOIN LATERAL(SELECT a.access='public' OR a.owner_id=auth.uid() OR EXISTS(SELECT 1 FROM app.auction_members m WHERE m.auction_id=a.id AND m.user_id=auth.uid()) AS yes) eligible
 WHERE l.id=p_listing_id
$$;
