-- Public read: return only upcoming auctions (auction_at >= now). Stale rows are purged separately.

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
        'withdrawn', e.withdrawn,
        'ended_at_source', false
      )
      ORDER BY e.auction_at ASC, e.id
    ),
    '[]'::jsonb
  )
  FROM app.external_auction_listings e
  WHERE e.auction_at >= clock_timestamp()
$$;