-- Ended-auction retention (7 days) and purge RPC; enrich public read with ended flag.

CREATE OR REPLACE FUNCTION public.purge_stale_external_auction_listings() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE removed integer;
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  DELETE FROM app.external_auction_listings
  WHERE auction_at < clock_timestamp() - interval '7 days';
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
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
        'withdrawn', e.withdrawn,
        'ended_at_source', e.auction_at < clock_timestamp()
      )
      ORDER BY e.auction_at DESC, e.id
    ),
    '[]'::jsonb
  )
  FROM app.external_auction_listings e
  WHERE e.auction_at >= clock_timestamp() - interval '7 days'
$$;

REVOKE EXECUTE ON FUNCTION public.purge_stale_external_auction_listings() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_stale_external_auction_listings() TO service_role;