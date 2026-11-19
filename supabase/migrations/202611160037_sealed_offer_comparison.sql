CREATE FUNCTION public.get_sealed_offers(p_auction_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid := auth.uid(); a app.auctions;
BEGIN
 -- app.require_user() takes a profile row lock for writers. This STABLE read RPC
 -- runs in a PostgREST read-only transaction, so verify the user without that lock.
 IF u IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=u AND email_confirmed_at IS NOT NULL) THEN
   RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner or staff MFA required';
 END IF;
 SELECT * INTO a FROM app.auctions WHERE id=p_auction_id;
 IF NOT FOUND OR a.mode<>'sealed' THEN
   RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner or staff MFA required';
 END IF;
 IF a.owner_id<>u AND NOT EXISTS(
   SELECT 1 FROM app.profiles p WHERE p.id=u AND p.is_staff AND auth.jwt()->>'aal'='aal2'
 ) THEN
   RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner or staff MFA required';
 END IF;
 RETURN coalesce((
   SELECT jsonb_agg(jsonb_build_object(
     'id',b.id,'bidder_display_name',left(p.display_name,100),
     'amount_minor',b.amount_minor,'created_at',b.created_at
   ) ORDER BY b.created_at,b.id)
   FROM app.bids b JOIN app.profiles p ON p.id=b.bidder_id WHERE b.auction_id=a.id
 ),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.get_sealed_offers(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_sealed_offers(uuid) TO authenticated;
