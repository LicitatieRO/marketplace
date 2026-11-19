-- Supabase Storage is optional in the minimal Postgres runner. No private documents
-- belong in this public image-only bucket; server media processing strips metadata.
CREATE FUNCTION public.media_write_allowed(p_name text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND split_part(p_name,'/',1)=auth.uid()::text
 AND EXISTS(SELECT 1 FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL)
$$;
REVOKE EXECUTE ON FUNCTION public.media_write_allowed(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.media_write_allowed(text) TO authenticated;
DO $$ BEGIN IF to_regclass('storage.buckets') IS NOT NULL THEN
 INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('listing-media','listing-media',true,10485760,ARRAY['image/jpeg','image/png','image/webp']) ON CONFLICT(id) DO UPDATE SET public=true,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;
 EXECUTE $policy$ CREATE POLICY listing_media_read ON storage.objects FOR SELECT TO anon,authenticated USING(bucket_id='listing-media') $policy$;
 EXECUTE $policy$ CREATE POLICY listing_media_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='listing-media' AND public.media_write_allowed(name)) $policy$;
 EXECUTE $policy$ CREATE POLICY listing_media_update ON storage.objects FOR UPDATE TO authenticated USING(bucket_id='listing-media' AND public.media_write_allowed(name)) WITH CHECK(bucket_id='listing-media' AND public.media_write_allowed(name)) $policy$;
 EXECUTE $policy$ CREATE POLICY listing_media_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='listing-media' AND public.media_write_allowed(name)) $policy$;
END IF; END $$;
