-- Map listings: judet validation, server-side random public_lat/public_lng (300–500 m), bbox RPC,
-- and public lat/lng (<= 3 decimal places). Judet-only Romania guard (no polygon POC).

CREATE TABLE IF NOT EXISTS app.romania_judete (
  name text PRIMARY KEY
);

INSERT INTO app.romania_judete(name) VALUES
  ('Alba'), ('Arad'), ('Argeș'), ('Bacău'), ('Bihor'), ('Bistrița-Năsăud'), ('Botoșani'),
  ('Brăila'), ('Brașov'), ('București'), ('Buzău'), ('Caraș-Severin'), ('Călărași'),
  ('Cluj'), ('Constanța'), ('Covasna'), ('Dâmbovița'), ('Dolj'), ('Galați'), ('Giurgiu'),
  ('Gorj'), ('Harghita'), ('Hunedoara'), ('Ialomița'), ('Iași'), ('Ilfov'), ('Maramureș'),
  ('Mehedinți'), ('Mureș'), ('Neamț'), ('Olt'), ('Prahova'), ('Satu Mare'), ('Sălaj'),
  ('Sibiu'), ('Suceava'), ('Teleorman'), ('Timiș'), ('Tulcea'), ('Vaslui'), ('Vâlcea'), ('Vrancea')
ON CONFLICT DO NOTHING;

ALTER TABLE app.properties
  ADD COLUMN IF NOT EXISTS judet text;

UPDATE app.properties SET judet = 'București' WHERE judet IS NULL;

ALTER TABLE app.properties
  ALTER COLUMN judet SET DEFAULT 'București';

ALTER TABLE app.properties
  ALTER COLUMN judet SET NOT NULL;

ALTER TABLE app.properties
  ADD CONSTRAINT properties_judet_fk
  FOREIGN KEY (judet) REFERENCES app.romania_judete(name);

UPDATE app.properties SET judet = 'Bistrița-Năsăud' WHERE judet = 'Bistrița-Năsud';
UPDATE app.romania_judete SET name = 'Bistrița-Năsăud' WHERE name = 'Bistrița-Năsud';

CREATE OR REPLACE FUNCTION app.normalize_judet_key(p text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT regexp_replace(
    lower(translate(coalesce(btrim(p), ''),
      'ăâîșşțţĂÂÎȘŞȚŢ', 'aaissttAAISSTT')),
    '[^a-z0-9]+', '', 'g'
  );
$$;

CREATE OR REPLACE FUNCTION app.resolve_judet(p_judet text) RETURNS text
LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE
  key text := app.normalize_judet_key(p_judet);
  resolved text;
BEGIN
  SELECT j.name INTO resolved
  FROM app.romania_judete j
  WHERE app.normalize_judet_key(j.name) = key;
  IF resolved IS NULL THEN
    RAISE EXCEPTION 'Invalid judet';
  END IF;
  RETURN resolved;
END $$;

CREATE OR REPLACE FUNCTION app.validate_property_judet() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  NEW.judet := app.resolve_judet(NEW.judet);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS properties_validate_judet ON app.properties;
CREATE TRIGGER properties_validate_judet
  BEFORE INSERT OR UPDATE OF judet ON app.properties
  FOR EACH ROW EXECUTE FUNCTION app.validate_property_judet();

ALTER TABLE app.properties
  ADD COLUMN IF NOT EXISTS public_lat double precision,
  ADD COLUMN IF NOT EXISTS public_lng double precision;

ALTER TABLE app.properties DROP CONSTRAINT IF EXISTS properties_public_lat_lng_pair;
ALTER TABLE app.properties
  ADD CONSTRAINT properties_public_lat_lng_pair
  CHECK ((public_lat IS NULL) = (public_lng IS NULL));

CREATE OR REPLACE FUNCTION app.sample_public_coords_from_exact(
  p_lat double precision,
  p_lng double precision,
  OUT public_lat double precision,
  OUT public_lng double precision
)
LANGUAGE plpgsql VOLATILE SET search_path='' AS $$
DECLARE
  dist_m double precision;
  bearing double precision;
  dlat double precision;
  dlng double precision;
BEGIN
  IF p_lat IS NULL OR p_lng IS NULL THEN
    public_lat := NULL;
    public_lng := NULL;
    RETURN;
  END IF;
  dist_m := 300.0 + floor(random() * 201.0);
  bearing := radians(random() * 360.0);
  dlat := (dist_m / 111320.0) * cos(bearing);
  dlng := (dist_m / (111320.0 * greatest(0.2, cos(radians(p_lat))))) * sin(bearing);
  public_lat := p_lat + dlat;
  public_lng := p_lng + dlng;
END $$;

CREATE OR REPLACE FUNCTION app.properties_maintain_public_coords() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE
  sampled record;
BEGIN
  IF NEW.lat IS NULL OR NEW.lng IS NULL THEN
    NEW.public_lat := NULL;
    NEW.public_lng := NULL;
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT'
     OR NEW.lat IS DISTINCT FROM OLD.lat
     OR NEW.lng IS DISTINCT FROM OLD.lng THEN
    SELECT * INTO sampled FROM app.sample_public_coords_from_exact(NEW.lat, NEW.lng);
    NEW.public_lat := sampled.public_lat;
    NEW.public_lng := sampled.public_lng;
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.public_lat := OLD.public_lat;
    NEW.public_lng := OLD.public_lng;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS properties_maintain_public_coords ON app.properties;
DROP TRIGGER IF EXISTS properties_maintain_approx_coords ON app.properties;
CREATE TRIGGER properties_maintain_public_coords
  BEFORE INSERT OR UPDATE OF lat, lng ON app.properties
  FOR EACH ROW EXECUTE FUNCTION app.properties_maintain_public_coords();

DO $$
DECLARE
  r record;
  sampled record;
BEGIN
  FOR r IN
    SELECT id, lat, lng
    FROM app.properties
    WHERE lat IS NOT NULL AND lng IS NOT NULL
      AND (public_lat IS NULL OR public_lng IS NULL)
  LOOP
    SELECT * INTO sampled FROM app.sample_public_coords_from_exact(r.lat, r.lng);
    UPDATE app.properties
    SET public_lat = sampled.public_lat, public_lng = sampled.public_lng
    WHERE id = r.id;
  END LOOP;
END $$;

DROP INDEX IF EXISTS app.properties_lat_lng_idx;
DROP INDEX IF EXISTS app.properties_approx_lat_lng_idx;
CREATE INDEX IF NOT EXISTS properties_public_lat_lng_idx
  ON app.properties (public_lat, public_lng)
  WHERE public_lat IS NOT NULL AND public_lng IS NOT NULL;

CREATE OR REPLACE FUNCTION app.rounded_public_lat(p app.properties) RETURNS double precision
LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT CASE WHEN p.public_lat IS NULL THEN NULL ELSE round(p.public_lat::numeric, 3)::double precision END;
$$;

CREATE OR REPLACE FUNCTION app.rounded_public_lng(p app.properties) RETURNS double precision
LANGUAGE sql STABLE SET search_path='' AS $$
  SELECT CASE WHEN p.public_lng IS NULL THEN NULL ELSE round(p.public_lng::numeric, 3)::double precision END;
$$;

CREATE OR REPLACE FUNCTION app.finite_float8(v double precision) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT v IS NOT NULL
    AND lower(v::text) NOT IN ('nan', 'infinity', '-infinity');
$$;

CREATE OR REPLACE FUNCTION app.listing_json(p_listing_id uuid) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
 SELECT jsonb_build_object(
 'id',l.id,'property_id',p.id,'title',p.title,'description',p.description,'neighborhood',p.neighborhood,
 'judet',p.judet,'property_type',p.property_type,
 'transaction_type',l.transaction_type,'price_minor',l.price_minor,'currency',l.currency,'area_sqm',p.area_sqm,'rooms',p.rooms,'floor',p.floor,'built_year',p.built_year,'image_urls',p.image_urls,'tenancy_status',p.tenancy_status,'status',l.status,'tour_url',p.tour_url,
 'lat',app.rounded_public_lat(p),
 'lng',app.rounded_public_lng(p),
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

CREATE OR REPLACE FUNCTION app.map_auction_status(a app.auctions, t timestamptz) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT CASE
    WHEN a.id IS NULL THEN 'ended'
    WHEN a.status NOT IN ('scheduled','active') OR t >= a.ends_at THEN 'ended'
    WHEN t < a.starts_at THEN 'scheduled'
    ELSE 'live'
  END;
$$;

CREATE OR REPLACE FUNCTION app.map_listing_row(l app.listings, p app.properties, a app.auctions) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  t timestamptz := clock_timestamp();
  uid uuid := auth.uid();
  st text := app.map_auction_status(a, t);
  cur bigint;
  viewer uuid;
  viewer_leading boolean;
  viewer_outbid boolean;
  payload jsonb;
BEGIN
  IF l.status <> 'published' OR p.public_lat IS NULL OR p.public_lng IS NULL THEN RETURN NULL; END IF;
  IF a IS NOT NULL AND a.access = 'invite'
     AND uid IS DISTINCT FROM a.owner_id
     AND NOT EXISTS(SELECT 1 FROM app.auction_members m WHERE m.auction_id = a.id AND m.user_id = uid) THEN
    RETURN NULL;
  END IF;
  cur := CASE WHEN a.mode = 'ascending' THEN coalesce((SELECT max(b.amount_minor) FROM app.bids b WHERE b.auction_id = a.id), a.starting_price_minor, l.price_minor) ELSE l.price_minor END;
  viewer := uid;
  IF viewer IS NOT NULL AND a.id IS NOT NULL THEN
    viewer_leading := (SELECT b.bidder_id FROM app.bids b WHERE b.auction_id = a.id ORDER BY b.amount_minor DESC, b.created_at DESC, b.id LIMIT 1) = viewer;
    viewer_outbid := EXISTS(SELECT 1 FROM app.bids b WHERE b.auction_id = a.id AND b.bidder_id = viewer)
      AND NOT viewer_leading AND st = 'live';
  ELSE
    viewer_leading := false;
    viewer_outbid := false;
  END IF;
  payload := jsonb_build_object(
    'id', l.id,
    'auctionId', a.id,
    'slug', l.id::text,
    'title', p.title,
    'sector', p.judet,
    'neighbourhood', p.neighborhood,
    'approxLat', app.rounded_public_lat(p),
    'approxLng', app.rounded_public_lng(p),
    'photoUrl', coalesce(p.image_urls[1], null),
    'currentBidCents', cur,
    'minIncrementCents', coalesce(a.min_increment_minor, 0),
    'startsAt', a.starts_at,
    'endsAt', a.ends_at,
    'status', st,
    'transactionType', l.transaction_type,
    'leadingBid', viewer_leading,
    'outbid', viewer_outbid
  );
  IF viewer IS NOT NULL AND l.owner_id = viewer THEN
    payload := payload || jsonb_build_object('isOwn', true);
  END IF;
  RETURN payload;
END $$;

CREATE OR REPLACE FUNCTION public.get_map_listings_in_bbox(
  p_west double precision,
  p_south double precision,
  p_east double precision,
  p_north double precision,
  p_limit integer DEFAULT 200
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  lim integer := least(greatest(coalesce(p_limit, 200), 1), 200);
  out jsonb;
BEGIN
  IF p_west IS NULL OR p_south IS NULL OR p_east IS NULL OR p_north IS NULL
     OR NOT (app.finite_float8(p_west) AND app.finite_float8(p_south) AND app.finite_float8(p_east) AND app.finite_float8(p_north))
     OR p_west >= p_east OR p_south >= p_north THEN
    RAISE EXCEPTION 'Invalid bbox';
  END IF;
  SELECT coalesce(jsonb_agg(row ORDER BY (row->>'id')), '[]'::jsonb) INTO out
  FROM (
    SELECT app.map_listing_row(l, p, a) AS row
    FROM app.listings l
    JOIN app.properties p ON p.id = l.property_id
    LEFT JOIN app.auctions a ON a.id = l.auction_id
    WHERE l.status = 'published'
      AND p.public_lat BETWEEN p_south AND p_north
      AND p.public_lng BETWEEN p_west AND p_east
      AND l.transaction_type = 'sale'
    LIMIT lim
  ) sub
  WHERE row IS NOT NULL;
  RETURN out;
END $$;

ALTER TABLE app.romania_judete ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE app.romania_judete FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS app.fuzzed_lng(uuid, double precision, double precision);
DROP FUNCTION IF EXISTS app.fuzzed_lat(uuid, double precision);
DROP FUNCTION IF EXISTS app.geo_fuzz_bearing_deg(uuid);
DROP FUNCTION IF EXISTS app.geo_fuzz_meters(uuid);

DROP FUNCTION IF EXISTS app.public_lat(app.properties);
DROP FUNCTION IF EXISTS app.public_lng(app.properties);
DROP FUNCTION IF EXISTS app.sample_approx_from_raw(double precision, double precision);

REVOKE EXECUTE ON FUNCTION
  app.sample_public_coords_from_exact(double precision, double precision),
  app.properties_maintain_public_coords(),
  app.rounded_public_lat(app.properties),
  app.rounded_public_lng(app.properties),
  app.resolve_judet(text),
  app.normalize_judet_key(text),
  app.map_listing_row(app.listings, app.properties, app.auctions)
FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_map_listings_in_bbox(double precision,double precision,double precision,double precision,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_map_listings_in_bbox(double precision,double precision,double precision,double precision,integer) TO anon, authenticated;

-- Extend create_property / update_property with judet (server + DB validation).
DROP FUNCTION IF EXISTS public.create_property(
  text, text, text, text, text, integer, integer, integer, integer, bigint, bigint, text[]
);
DROP FUNCTION IF EXISTS public.update_property(
  uuid, text, text, text, text, text, integer, integer, integer, integer, bigint, bigint, text[]
);

CREATE OR REPLACE FUNCTION public.create_property(
  p_title text, p_description text, p_neighborhood text, p_exact_address text, p_property_type text,
  p_area_sqm integer, p_rooms integer, p_floor integer, p_built_year integer,
  p_sale_price_minor bigint DEFAULT NULL, p_rent_price_minor bigint DEFAULT NULL, p_image_urls text[] DEFAULT '{}',
  p_judet text DEFAULT 'București', p_lat double precision DEFAULT NULL, p_lng double precision DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=app.require_user(); p app.properties; j text;
BEGIN
 IF coalesce(p_sale_price_minor,0)<=0 AND coalesce(p_rent_price_minor,0)<=0 THEN RAISE EXCEPTION 'At least one positive price required'; END IF;
 IF (p_sale_price_minor IS NOT NULL AND p_sale_price_minor<=0) OR (p_rent_price_minor IS NOT NULL AND p_rent_price_minor<=0) THEN RAISE EXCEPTION 'Prices must be positive'; END IF;
 j := app.resolve_judet(p_judet);
 IF cardinality(p_image_urls)>12 OR EXISTS(SELECT 1 FROM unnest(p_image_urls) x WHERE x IS NULL OR (x !~ '^https://(images[.]unsplash[.]com|images[.]pexels[.]com)/[^[:space:]]+$' AND x !~ ('^https://[a-z0-9-]+[.]supabase[.]co/storage/v1/object/public/listing-media/'||u::text||'/[a-zA-Z0-9._/-]+$') AND x !~ ('^http://(127[.]0[.]0[.]1|localhost):54321/storage/v1/object/public/listing-media/'||u::text||'/[a-zA-Z0-9._/-]+$'))) THEN RAISE EXCEPTION 'Unsupported image URL'; END IF;
 INSERT INTO app.properties(owner_id,title,description,neighborhood,exact_address,property_type,area_sqm,rooms,floor,built_year,image_urls,judet,lat,lng)
 VALUES(u,trim(p_title),p_description,trim(p_neighborhood),trim(p_exact_address),p_property_type,p_area_sqm,p_rooms,p_floor,p_built_year,coalesce(p_image_urls,'{}'),j,p_lat,p_lng) RETURNING * INTO p;
 IF p_sale_price_minor IS NOT NULL THEN INSERT INTO app.listings(property_id,owner_id,transaction_type,price_minor) VALUES(p.id,u,'sale',p_sale_price_minor); END IF;
 IF p_rent_price_minor IS NOT NULL THEN INSERT INTO app.listings(property_id,owner_id,transaction_type,price_minor) VALUES(p.id,u,'rent',p_rent_price_minor); END IF;
 PERFORM app.audit('property.created',p.id); RETURN to_jsonb(p);
END $$;

CREATE OR REPLACE FUNCTION public.update_property(
  p_property_id uuid,p_title text,p_description text,p_neighborhood text,p_exact_address text,p_property_type text,
  p_area_sqm integer,p_rooms integer,p_floor integer,p_built_year integer,
  p_sale_price_minor bigint DEFAULT NULL,p_rent_price_minor bigint DEFAULT NULL,p_image_urls text[] DEFAULT '{}',
  p_judet text DEFAULT NULL, p_lat double precision DEFAULT NULL, p_lng double precision DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=app.require_user(); p app.properties; j text;
BEGIN
 SELECT * INTO p FROM app.properties WHERE id=p_property_id FOR UPDATE;
 IF NOT FOUND OR p.owner_id<>u THEN RAISE EXCEPTION 'Owner required'; END IF;
 PERFORM app.expire_property(p.id);
 IF EXISTS(SELECT 1 FROM app.auctions WHERE property_id=p.id AND status IN ('scheduled','active')) THEN RAISE EXCEPTION 'Property already has an active auction'; END IF;
 IF EXISTS(SELECT 1 FROM app.reservations WHERE property_id=p.id AND status IN ('requested','funded')) THEN RAISE EXCEPTION 'Property is reserved'; END IF;
 IF EXISTS(SELECT 1 FROM app.listings WHERE property_id=p.id AND transaction_type='sale' AND status='closed') THEN RAISE EXCEPTION 'Completed sale is final'; END IF;
 IF (p_sale_price_minor IS NOT NULL AND p_sale_price_minor<=0) OR (p_rent_price_minor IS NOT NULL AND p_rent_price_minor<=0) THEN RAISE EXCEPTION 'Prices must be positive'; END IF;
 IF cardinality(p_image_urls)>12 OR EXISTS(SELECT 1 FROM unnest(p_image_urls) x WHERE x IS NULL OR (x !~ '^https://(images[.]unsplash[.]com|images[.]pexels[.]com)/[^[:space:]]+$' AND x !~ ('^https://[a-z0-9-]+[.]supabase[.]co/storage/v1/object/public/listing-media/'||u::text||'/[a-zA-Z0-9._/-]+$') AND x !~ ('^http://(127[.]0[.]0[.]1|localhost):54321/storage/v1/object/public/listing-media/'||u::text||'/[a-zA-Z0-9._/-]+$'))) THEN RAISE EXCEPTION 'Unsupported image URL'; END IF;
 j := CASE WHEN p_judet IS NOT NULL AND btrim(p_judet) <> '' THEN app.resolve_judet(p_judet) ELSE p.judet END;
 UPDATE app.properties SET title=trim(p_title),description=p_description,neighborhood=trim(p_neighborhood),exact_address=trim(p_exact_address),property_type=p_property_type,area_sqm=p_area_sqm,rooms=p_rooms,floor=p_floor,built_year=p_built_year,image_urls=coalesce(p_image_urls,'{}'),judet=j,lat=coalesce(p_lat,lat),lng=coalesce(p_lng,lng) WHERE id=p.id RETURNING * INTO p;
 IF p_sale_price_minor IS NOT NULL THEN INSERT INTO app.listings(property_id,owner_id,transaction_type,price_minor) VALUES(p.id,u,'sale',p_sale_price_minor) ON CONFLICT(property_id,transaction_type) DO UPDATE SET price_minor=excluded.price_minor; END IF;
 IF p_rent_price_minor IS NOT NULL THEN INSERT INTO app.listings(property_id,owner_id,transaction_type,price_minor) VALUES(p.id,u,'rent',p_rent_price_minor) ON CONFLICT(property_id,transaction_type) DO UPDATE SET price_minor=excluded.price_minor; END IF;
 PERFORM app.audit('property.updated',p.id); RETURN to_jsonb(p);
END $$;

REVOKE EXECUTE ON FUNCTION public.create_property(text,text,text,text,text,integer,integer,integer,integer,bigint,bigint,text[],text,double precision,double precision) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_property(text,text,text,text,text,integer,integer,integer,integer,bigint,bigint,text[],text,double precision,double precision) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.update_property(uuid,text,text,text,text,text,integer,integer,integer,integer,bigint,bigint,text[],text,double precision,double precision) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_property(uuid,text,text,text,text,text,integer,integer,integer,integer,bigint,bigint,text[],text,double precision,double precision) TO authenticated;

-- Refresh demo seed property rows with judet (same guard as 202611140018).
CREATE OR REPLACE FUNCTION app.seed_demo_fixture()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  demo_owner uuid;
  demo_buyer uuid;
  demo_dual uuid;
  demo_properties uuid[] := ARRAY[
    '10000000-0000-4000-8000-000000000001'::uuid,
    '10000000-0000-4000-8000-000000000002'::uuid,
    '10000000-0000-4000-8000-000000000003'::uuid,
    '10000000-0000-4000-8000-000000000004'::uuid,
    '10000000-0000-4000-8000-000000000005'::uuid,
    '10000000-0000-4000-8000-000000000006'::uuid
  ];
  demo_auction uuid := '40000000-0000-4000-8000-000000000001';
  sale_listing uuid := '20000000-0000-4000-8000-000000000001'::uuid;
BEGIN
  IF current_setting('app.allow_demo_seed', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'demo seed requires app.allow_demo_seed=on';
  END IF;

  demo_owner := app.ensure_demo_auth_user(
    'owner@licitatiero.local',
    '11111111-1111-4111-8111-111111111111',
    'Alex · LicitatieRO'
  );
  demo_buyer := app.ensure_demo_auth_user(
    'buyer@licitatiero.local',
    '22222222-2222-4222-8222-222222222222',
    'Dana · Cumpărător (POC / Simulare)'
  );
  demo_dual := app.ensure_demo_auth_user(
    'dual@licitatiero.local',
    '44444444-4444-4444-8444-444444444444',
    'Mihai · Rol dublu (POC / Simulare)'
  );

  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'instance_id'
  ) THEN
    INSERT INTO auth.identities(id, provider_id, user_id, identity_data, provider, created_at, updated_at)
    SELECT
      gen_random_uuid(),
      u.id::text,
      u.id,
      jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
      'email',
      now(),
      now()
    FROM auth.users u
    WHERE u.id IN (demo_owner, demo_buyer, demo_dual)
    ON CONFLICT (provider_id, provider) DO NOTHING;
  END IF;

  INSERT INTO app.properties(
    id, owner_id, title, description, neighborhood, exact_address, property_type,
    area_sqm, rooms, floor, built_year, image_urls, lat, lng, judet
  )
  VALUES
    (
      demo_properties[1], demo_owner,
      'Apartament 2 camere, 58 mp, Floreasca, 2022, parcare subterană — licitație (POC / Simulare)',
      'Apartament cu 2 camere, 58 mp utili, într-un imobil finalizat în 2022 pe partea de parc a cartierului Floreasca (Sector 1, pin de simulare lângă Parcul Floreasca — nu este o adresă reală). Listare de simulare POC pentru LicitatieRO.',
      'Floreasca', 'Adresă demonstrativă privată 1', 'apartment', 58, 2, 5, 2022,
      ARRAY[
        'https://images.unsplash.com/photo-1600573472591-ee6b68d14c68?auto=format&fit=crop&w=1600&q=85',
        'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=85'
      ],
      44.46463, 26.09944, 'București'
    ),
    (
      demo_properties[2], demo_owner,
      'Apartament nou 3 camere, 82 mp, Pipera–Voluntari, 2024, parcare — licitație (POC / Simulare)',
      'Apartament nou pe culoarul Pipera, în Voluntari (Ilfov) — pin de simulare, nu este o adresă reală. Listare de simulare POC.',
      'Voluntari (Ilfov)', 'Adresă demonstrativă privată 2', 'apartment', 82, 3, 3, 2024,
      ARRAY[
        'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1600&q=85',
        'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=85'
      ],
      44.48625, 26.11873, 'Ilfov'
    ),
    (
      demo_properties[3], demo_owner,
      'Apartament 2 camere, 64 mp, Unirii–Centrul Civic, renovat 2023 — licitație (POC / Simulare)',
      'Apartament în Centrul Civic, Sector 3; pin de simulare. Listare de simulare POC.',
      'Unirii', 'Adresă demonstrativă privată 3', 'apartment', 64, 2, 6, 1986,
      ARRAY[
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1600&q=85',
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=85'
      ],
      44.42727, 26.10797, 'București'
    ),
    (
      demo_properties[4], demo_owner,
      'Apartament 3 camere, 72 mp, Tineretului, lângă parc, renovat 2021 — licitație (POC / Simulare)',
      'Apartament lângă Parcul Tineretului, Sector 4. Listare de simulare POC.',
      'Tineretului', 'Adresă demonstrativă privată 4', 'apartment', 72, 3, 3, 1980,
      ARRAY[
        'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1600&q=85',
        'https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=1200&q=85'
      ],
      44.40870, 26.10560, 'București'
    ),
    (
      demo_properties[5], demo_owner,
      'Apartament 2 camere, 52 mp, Drumul Taberei, lângă metrou Favorit (M5) — licitație (POC / Simulare)',
      'Apartament în Drumul Taberei, Sector 6, lângă Favorit (M5). Listare de simulare POC.',
      'Drumul Taberei', 'Adresă demonstrativă privată 5', 'apartment', 52, 2, 2, 1982,
      ARRAY[
        'https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1600&q=85',
        'https://images.unsplash.com/photo-1600566752734-2a0cd26c42ac?auto=format&fit=crop&w=1200&q=85'
      ],
      44.42554, 26.04836, 'București'
    ),
    (
      demo_properties[6], demo_owner,
      'Apartament 3 camere, 85 mp, Cotroceni, imobil 1938 renovat 2019 — licitație (POC / Simulare)',
      'Apartament în Cotroceni, Sector 5; pin de simulare decalat față de Palatul Cotroceni. Listare de simulare POC.',
      'Cotroceni', 'Adresă demonstrativă privată 6', 'apartment', 85, 3, 2, 1938,
      ARRAY[
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=85',
        'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=85'
      ],
      44.43013, 26.07081, 'București'
    )
  ON CONFLICT (id) DO UPDATE SET
    owner_id = EXCLUDED.owner_id,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    neighborhood = EXCLUDED.neighborhood,
    exact_address = EXCLUDED.exact_address,
    property_type = EXCLUDED.property_type,
    area_sqm = EXCLUDED.area_sqm,
    rooms = EXCLUDED.rooms,
    floor = EXCLUDED.floor,
    built_year = EXCLUDED.built_year,
    image_urls = EXCLUDED.image_urls,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    judet = EXCLUDED.judet;

  INSERT INTO app.listings(id, property_id, owner_id, transaction_type, price_minor)
  SELECT
    ('20000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
    ('10000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
    demo_owner,
    'sale',
    (ARRAY[25900000, 33500000, 22400000, 20300000, 10800000, 28700000])[i]
  FROM generate_series(1, 6) AS i
  ON CONFLICT (id) DO UPDATE SET
    property_id = EXCLUDED.property_id,
    owner_id = EXCLUDED.owner_id,
    transaction_type = EXCLUDED.transaction_type,
    price_minor = EXCLUDED.price_minor;

  INSERT INTO app.listings(id, property_id, owner_id, transaction_type, price_minor)
  SELECT
    ('30000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
    ('10000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
    demo_owner,
    'rent',
    (ARRAY[75000, 115000, 65000, 75000, 45000, 105000])[i]
  FROM generate_series(1, 6) AS i
  ON CONFLICT (id) DO UPDATE SET
    property_id = EXCLUDED.property_id,
    owner_id = EXCLUDED.owner_id,
    transaction_type = EXCLUDED.transaction_type,
    price_minor = EXCLUDED.price_minor;

  INSERT INTO app.auctions(
    id, property_id, listing_id, owner_id, mode, access, starts_at, ends_at, status,
    starting_price_minor, min_increment_minor
  )
  VALUES (
    demo_auction, demo_properties[1], sale_listing, demo_owner,
    'ascending', 'public', clock_timestamp() - interval '1 hour', clock_timestamp() + interval '3 days',
    'active', 19900000, 100000
  )
  ON CONFLICT (id) DO UPDATE SET
    property_id = EXCLUDED.property_id,
    listing_id = EXCLUDED.listing_id,
    owner_id = EXCLUDED.owner_id,
    mode = EXCLUDED.mode,
    access = EXCLUDED.access,
    starts_at = EXCLUDED.starts_at,
    ends_at = EXCLUDED.ends_at,
    status = EXCLUDED.status,
    starting_price_minor = EXCLUDED.starting_price_minor,
    min_increment_minor = EXCLUDED.min_increment_minor;

  UPDATE app.listings
  SET auction_id = demo_auction
  WHERE id = sale_listing;
END;
$$;