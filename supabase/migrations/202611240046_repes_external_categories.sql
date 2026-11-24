-- Add normalized REPES category (all asset classes) and widen asset subtype on external listings.

ALTER TABLE app.external_auction_listings
  ADD COLUMN IF NOT EXISTS category text;

UPDATE app.external_auction_listings
SET category = 'real_estate'
WHERE category IS NULL;

ALTER TABLE app.external_auction_listings
  ALTER COLUMN category SET NOT NULL;

ALTER TABLE app.external_auction_listings
  ADD CONSTRAINT external_auction_listings_category_check
  CHECK (category IN ('real_estate', 'vehicle', 'equipment', 'other'));

ALTER TABLE app.external_auction_listings
  DROP CONSTRAINT IF EXISTS external_auction_listings_property_type_check;

ALTER TABLE app.external_auction_listings
  ADD CONSTRAINT external_auction_listings_property_type_check
  CHECK (
    property_type IN (
      'apartment',
      'house',
      'studio',
      'land',
      'commercial',
      'vehicle',
      'equipment',
      'other'
    )
  );

CREATE INDEX external_auction_listings_category_auction_idx
  ON app.external_auction_listings (category, auction_at DESC);

DROP FUNCTION IF EXISTS public.upsert_external_auction_listing(
  text, text, text, text, text, text, text, integer, bigint, text, bigint, timestamptz, text, text, boolean
);

CREATE FUNCTION public.upsert_external_auction_listing(
  p_source text,
  p_source_id text,
  p_repes_case_id text,
  p_repes_auction_id text,
  p_category text,
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
  IF p_category IS NULL OR p_category NOT IN ('real_estate', 'vehicle', 'equipment', 'other') THEN
    RAISE EXCEPTION 'Invalid category';
  END IF;
  INSERT INTO app.external_auction_listings (
    source,
    source_id,
    repes_case_id,
    repes_auction_id,
    category,
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
    p_category,
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
    category = EXCLUDED.category,
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
  RETURN jsonb_build_object('id', row.id, 'source_id', row.source_id, 'category', row.category);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_external_auction_listings() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'source', e.source,
        'source_id', e.source_id,
        'category', e.category,
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
  text, text, text, text, text, text, text, text, integer, bigint, text, bigint, timestamptz, text, text, boolean
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_external_auction_listing(
  text, text, text, text, text, text, text, text, integer, bigint, text, bigint, timestamptz, text, text, boolean
) TO service_role;
