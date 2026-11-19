-- NULL prices preserve existing transaction lanes. An owner cannot edit a bidding
-- or reserved property, or reopen a closed lane belonging to a completed contract.
CREATE FUNCTION public.update_property(p_property_id uuid,p_title text,p_description text,p_neighborhood text,p_exact_address text,p_property_type text,p_area_sqm integer,p_rooms integer,p_floor integer,p_built_year integer,p_sale_price_minor bigint DEFAULT NULL,p_rent_price_minor bigint DEFAULT NULL,p_image_urls text[] DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=app.require_user(); p app.properties; BEGIN
 SELECT * INTO p FROM app.properties WHERE id=p_property_id FOR UPDATE;
 IF NOT FOUND OR p.owner_id<>u THEN RAISE EXCEPTION 'Owner required'; END IF;
 PERFORM app.expire_property(p.id);
 IF EXISTS(SELECT 1 FROM app.auctions WHERE property_id=p.id AND status IN ('scheduled','active')) THEN RAISE EXCEPTION 'Property already has an active auction'; END IF;
 IF EXISTS(SELECT 1 FROM app.reservations WHERE property_id=p.id AND status IN ('requested','funded')) THEN RAISE EXCEPTION 'Property is reserved'; END IF;
 IF EXISTS(SELECT 1 FROM app.listings WHERE property_id=p.id AND transaction_type='sale' AND status='closed') THEN RAISE EXCEPTION 'Completed sale is final'; END IF;
 IF (p_sale_price_minor IS NOT NULL AND p_sale_price_minor<=0) OR (p_rent_price_minor IS NOT NULL AND p_rent_price_minor<=0) THEN RAISE EXCEPTION 'Prices must be positive'; END IF;
 IF cardinality(p_image_urls)>12 OR EXISTS(SELECT 1 FROM unnest(p_image_urls) x WHERE x IS NULL OR (x !~ '^https://(images[.]unsplash[.]com|images[.]pexels[.]com)/[^[:space:]]+$' AND x !~ ('^https://[a-z0-9-]+[.]supabase[.]co/storage/v1/object/public/listing-media/'||u::text||'/[a-zA-Z0-9._/-]+$') AND x !~ ('^http://(127[.]0[.]0[.]1|localhost):54321/storage/v1/object/public/listing-media/'||u::text||'/[a-zA-Z0-9._/-]+$'))) THEN RAISE EXCEPTION 'Unsupported image URL'; END IF;
 UPDATE app.properties SET title=trim(p_title),description=p_description,neighborhood=trim(p_neighborhood),exact_address=trim(p_exact_address),property_type=p_property_type,area_sqm=p_area_sqm,rooms=p_rooms,floor=p_floor,built_year=p_built_year,image_urls=coalesce(p_image_urls,'{}') WHERE id=p.id RETURNING * INTO p;
 IF p_sale_price_minor IS NOT NULL THEN INSERT INTO app.listings(property_id,owner_id,transaction_type,price_minor) VALUES(p.id,u,'sale',p_sale_price_minor) ON CONFLICT(property_id,transaction_type) DO UPDATE SET price_minor=excluded.price_minor; END IF;
 IF p_rent_price_minor IS NOT NULL THEN INSERT INTO app.listings(property_id,owner_id,transaction_type,price_minor) VALUES(p.id,u,'rent',p_rent_price_minor) ON CONFLICT(property_id,transaction_type) DO UPDATE SET price_minor=excluded.price_minor; END IF;
 PERFORM app.audit('property.updated',p.id); RETURN to_jsonb(p);
END $$;
REVOKE EXECUTE ON FUNCTION public.update_property(uuid,text,text,text,text,text,integer,integer,integer,integer,bigint,bigint,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_property(uuid,text,text,text,text,text,integer,integer,integer,integer,bigint,bigint,text[]) TO authenticated;
