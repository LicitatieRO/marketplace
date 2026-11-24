-- REPES external auction listings (minimal fields, service-role ingest, public read via RPC only).

CREATE TABLE app.external_auction_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('repes')),
  source_id text NOT NULL UNIQUE,
  repes_case_id text NOT NULL,
  repes_auction_id text NOT NULL,
  property_type text NOT NULL CHECK (
    property_type IN ('apartment', 'house', 'studio', 'land', 'commercial')
  ),
  locality_label text NOT NULL CHECK (length(trim(locality_label)) BETWEEN 2 AND 120),
  judet text NOT NULL CHECK (length(trim(judet)) BETWEEN 2 AND 80),
  area_sqm integer CHECK (area_sqm IS NULL OR area_sqm BETWEEN 1 AND 100000),
  price_minor bigint NOT NULL CHECK (price_minor > 0),
  currency text NOT NULL DEFAULT 'RON' CHECK (length(currency) = 3),
  guarantee_minor bigint CHECK (guarantee_minor IS NULL OR guarantee_minor > 0),
  auction_at timestamptz NOT NULL,
  issuing_authority text NOT NULL CHECK (length(trim(issuing_authority)) BETWEEN 2 AND 200),
  source_url text NOT NULL CHECK (length(trim(source_url)) BETWEEN 12 AND 2048),
  retrieved_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  withdrawn boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX external_auction_listings_auction_at_idx
  ON app.external_auction_listings (auction_at DESC)
  WHERE withdrawn = false;

ALTER TABLE app.external_auction_listings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app.external_auction_listings FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION app.touch_external_auction_listing() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  NEW.retrieved_at := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE TRIGGER external_auction_listings_touch
  BEFORE UPDATE ON app.external_auction_listings
  FOR EACH ROW EXECUTE FUNCTION app.touch_external_auction_listing();

CREATE FUNCTION public.upsert_external_auction_listing(
  p_source text,
  p_source_id text,
  p_repes_case_id text,
  p_repes_auction_id text,
  p_property_type text,
  p_locality_label text,
  p_judet text,
  p_area_sqm integer,
  p_price_minor bigint,
  p_currency text,
  p_guarantee_minor bigint,
  p_auction_at timestamptz,
  p_issuing_authority text,
  p_source_url text,
  p_withdrawn boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE row app.external_auction_listings;
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  INSERT INTO app.external_auction_listings (
    source,
    source_id,
    repes_case_id,
    repes_auction_id,
    property_type,
    locality_label,
    judet,
    area_sqm,
    price_minor,
    currency,
    guarantee_minor,
    auction_at,
    issuing_authority,
    source_url,
    withdrawn
  ) VALUES (
    p_source,
    p_source_id,
    p_repes_case_id,
    p_repes_auction_id,
    p_property_type,
    trim(p_locality_label),
    trim(p_judet),
    p_area_sqm,
    p_price_minor,
    upper(trim(p_currency)),
    p_guarantee_minor,
    p_auction_at,
    trim(p_issuing_authority),
    trim(p_source_url),
    coalesce(p_withdrawn, false)
  )
  ON CONFLICT (source_id) DO UPDATE SET
    property_type = EXCLUDED.property_type,
    locality_label = EXCLUDED.locality_label,
    judet = EXCLUDED.judet,
    area_sqm = EXCLUDED.area_sqm,
    price_minor = EXCLUDED.price_minor,
    currency = EXCLUDED.currency,
    guarantee_minor = EXCLUDED.guarantee_minor,
    auction_at = EXCLUDED.auction_at,
    issuing_authority = EXCLUDED.issuing_authority,
    source_url = EXCLUDED.source_url,
    withdrawn = EXCLUDED.withdrawn,
    updated_at = clock_timestamp(),
    retrieved_at = clock_timestamp()
  RETURNING * INTO row;
  RETURN jsonb_build_object('id', row.id, 'source_id', row.source_id);
END;
$$;

CREATE FUNCTION public.get_external_auction_listings() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'source', e.source,
        'source_id', e.source_id,
        'property_type', e.property_type,
        'locality_label', e.locality_label,
        'judet', e.judet,
        'area_sqm', e.area_sqm,
        'price_minor', e.price_minor,
        'currency', e.currency,
        'guarantee_minor', e.guarantee_minor,
        'auction_at', e.auction_at,
        'issuing_authority', e.issuing_authority,
        'source_url', e.source_url,
        'retrieved_at', e.retrieved_at,
        'withdrawn', e.withdrawn
      )
      ORDER BY e.auction_at DESC, e.id
    ),
    '[]'::jsonb
  )
  FROM app.external_auction_listings e
  WHERE e.auction_at >= clock_timestamp() - interval '30 days'
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_external_auction_listing(
  text, text, text, text, text, text, text, integer, bigint, text, bigint, timestamptz, text, text, boolean
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_external_auction_listing(
  text, text, text, text, text, text, text, integer, bigint, text, bigint, timestamptz, text, text, boolean
) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_external_auction_listings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_external_auction_listings() TO anon, authenticated, service_role;
