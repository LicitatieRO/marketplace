-- Staging email preview store: rendered bodies when Resend is unavailable.
CREATE TABLE app.notification_previews(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  notification_id bigint NOT NULL REFERENCES app.notification_outbox(id) ON DELETE CASCADE,
  subject text NOT NULL CHECK(char_length(subject) BETWEEN 1 AND 500),
  body text NOT NULL CHECK(char_length(body) BETWEEN 1 AND 20000),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(notification_id)
);
ALTER TABLE app.notification_previews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app.notification_previews FROM PUBLIC,anon,authenticated;
CREATE FUNCTION app.mask_email(p_email text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE
  WHEN p_email IS NULL OR btrim(p_email)='' THEN '***'
  WHEN strpos(p_email,'@')<=0 OR strpos(p_email,'@')=length(p_email) THEN '***'
  ELSE substring(p_email from 1 for 1)||'***@'||substring(p_email from strpos(p_email,'@')+1)
 END
$$;
REVOKE ALL ON FUNCTION app.mask_email(text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.store_notification_preview(p_id bigint,p_lease_token uuid,p_subject text,p_body text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE matched bigint;
BEGIN
 IF p_subject IS NULL OR btrim(p_subject)='' OR p_body IS NULL OR btrim(p_body)='' THEN RAISE EXCEPTION 'Preview content required'; END IF;
 DELETE FROM app.notification_previews WHERE created_at<clock_timestamp()-interval '7 days';
 IF NOT EXISTS(
  SELECT 1 FROM app.notification_outbox WHERE id=p_id AND lease_token=p_lease_token AND lease_until>clock_timestamp() AND delivered_at IS NULL
 ) THEN RETURN false; END IF;
 INSERT INTO app.notification_previews(notification_id,subject,body) VALUES(p_id,btrim(p_subject),p_body)
 ON CONFLICT(notification_id) DO UPDATE SET subject=EXCLUDED.subject,body=EXCLUDED.body,created_at=clock_timestamp();
 SELECT p_id INTO matched;
 RETURN true;
END $$;
CREATE FUNCTION public.list_notification_previews(p_limit integer) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'id',r.id,'notification_id',r.notification_id,'subject',r.subject,'body',r.body,'created_at',r.created_at,'recipient_email',r.masked_email
 ) ORDER BY r.created_at DESC),'[]'::jsonb)
 FROM (
  SELECT p.id,p.notification_id,p.subject,p.body,p.created_at,app.mask_email(u.email) AS masked_email
  FROM app.notification_previews p
  JOIN app.notification_outbox n ON n.id=p.notification_id
  JOIN auth.users u ON u.id=n.user_id
  WHERE p.created_at>clock_timestamp()-interval '7 days'
  ORDER BY p.created_at DESC
  LIMIT least(greatest(coalesce(p_limit,0),0),100)
 ) r
$$;
REVOKE ALL ON FUNCTION public.store_notification_preview(bigint,uuid,text,text),public.list_notification_previews(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.store_notification_preview(bigint,uuid,text,text),public.list_notification_previews(integer) TO service_role;