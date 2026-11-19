-- Stop automatic preview expiry on store/list; unschedule automated purge job (founder: auto-delete OFF).

CREATE OR REPLACE FUNCTION app.preview_body_contains_action_link(p_body text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT coalesce(p_body, '') ~* 'https?://[^[:space:]]+/auth/v1/verify\?';
$$;

CREATE OR REPLACE FUNCTION public.store_notification_preview(
  p_id bigint,
  p_lease_token uuid,
  p_subject text,
  p_body text,
  p_recipient_email text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE matched bigint;
BEGIN
 IF p_subject IS NULL OR btrim(p_subject)='' OR p_body IS NULL OR btrim(p_body)='' THEN RAISE EXCEPTION 'Preview content required'; END IF;
 IF app.preview_body_contains_action_link(p_body)
    AND current_setting('app.allow_action_link_preview', true) IS DISTINCT FROM 'on' THEN
   RAISE EXCEPTION 'Action link previews require staging host' USING ERRCODE = 'P0001';
 END IF;
 IF NOT EXISTS(
  SELECT 1 FROM app.notification_outbox WHERE id=p_id AND lease_token=p_lease_token AND lease_until>clock_timestamp() AND delivered_at IS NULL
 ) THEN RETURN false; END IF;
 INSERT INTO app.notification_previews(notification_id,subject,body,recipient_email)
 VALUES(p_id,btrim(p_subject),p_body,NULLIF(btrim(coalesce(p_recipient_email,'')),''))
 ON CONFLICT(notification_id) DO UPDATE SET
   subject=EXCLUDED.subject,
   body=EXCLUDED.body,
   recipient_email=COALESCE(EXCLUDED.recipient_email,app.notification_previews.recipient_email),
   created_at=clock_timestamp();
 SELECT p_id INTO matched;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.store_notification_preview(bigint, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_notification_preview(bigint, uuid, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.list_notification_previews(p_limit integer) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'id',r.id,'notification_id',r.notification_id,'subject',r.subject,'body',r.body,'created_at',r.created_at,'recipient_email',r.masked_email
 ) ORDER BY r.created_at DESC),'[]'::jsonb)
 FROM (
  SELECT p.id,p.notification_id,p.subject,p.body,p.created_at,
    CASE
      WHEN p.recipient_email IS NOT NULL AND btrim(p.recipient_email) <> '' THEN app.mask_email(p.recipient_email)
      ELSE app.mask_email(u.email)
    END AS masked_email
  FROM app.notification_previews p
  JOIN app.notification_outbox n ON n.id=p.notification_id
  JOIN auth.users u ON u.id=n.user_id
  ORDER BY p.created_at DESC
  LIMIT least(greatest(coalesce(p_limit,0),0),100)
 ) r
$$;

CREATE OR REPLACE FUNCTION public.store_staging_signup_notification_preview(
  p_user_id uuid,
  p_subject text,
  p_body text,
  p_recipient_email text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  note_id bigint;
  lease uuid;
  stored boolean;
BEGIN
  PERFORM set_config('app.allow_action_link_preview', 'on', true);
  IF p_user_id IS NULL OR p_subject IS NULL OR btrim(p_subject)='' OR p_body IS NULL OR btrim(p_body)='' THEN
    RAISE EXCEPTION 'Preview content required';
  END IF;
  IF p_recipient_email IS NULL OR btrim(p_recipient_email)='' THEN
    RAISE EXCEPTION 'Signup recipient email required';
  END IF;
  IF btrim(p_subject) <> 'LicitatieRO — confirmă contul / confirm your account' THEN
    RAISE EXCEPTION 'Signup confirmation preview subject required' USING ERRCODE='P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM app.profiles WHERE id = p_user_id) THEN
    RETURN false;
  END IF;
  INSERT INTO app.notification_outbox(user_id, event, entity_id)
  VALUES (p_user_id, 'auth.signup_confirm', NULL)
  RETURNING id INTO note_id;
  UPDATE app.notification_outbox
  SET attempts = attempts + 1,
      lease_until = clock_timestamp() + interval '2 minutes',
      lease_token = gen_random_uuid()
  WHERE id = note_id
  RETURNING lease_token INTO lease;
  stored := public.store_notification_preview(note_id, lease, p_subject, p_body, p_recipient_email);
  IF NOT stored THEN
    RETURN false;
  END IF;
  RETURN public.finish_notification(note_id, lease, true);
END $$;
REVOKE ALL ON FUNCTION public.store_staging_signup_notification_preview(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_staging_signup_notification_preview(uuid, text, text, text) TO service_role;

CREATE TABLE IF NOT EXISTS app.notification_preview_link_reveals(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid NOT NULL,
  preview_id bigint NOT NULL REFERENCES app.notification_previews(id) ON DELETE CASCADE,
  notification_id bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE app.notification_preview_link_reveals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app.notification_preview_link_reveals FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.audit_notification_preview_link_reveal(
  p_actor_id uuid,
  p_preview_id bigint
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  row app.notification_previews%ROWTYPE;
BEGIN
  IF p_actor_id IS NULL OR p_preview_id IS NULL THEN
    RAISE EXCEPTION 'Preview reveal audit requires actor and preview id';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM app.profiles WHERE id = p_actor_id AND is_staff
  ) THEN
    RAISE EXCEPTION 'Staff required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO row FROM app.notification_previews WHERE id = p_preview_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Preview not found';
  END IF;
  INSERT INTO app.notification_preview_link_reveals(actor_id, preview_id, notification_id)
  VALUES (p_actor_id, row.id, row.notification_id);
END $$;
REVOKE ALL ON FUNCTION public.audit_notification_preview_link_reveal(uuid, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_notification_preview_link_reveal(uuid, bigint) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_catalog.pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.unschedule(j.jobid)
        FROM cron.job AS j
        WHERE j.jobname = 'marketplace-purge-notification-previews';
      END IF;
    EXCEPTION
      WHEN undefined_table THEN
        NULL;
      WHEN OTHERS THEN
        RAISE WARNING 'Could not unschedule marketplace-purge-notification-previews: %', SQLERRM;
    END;
  END IF;
END $$;