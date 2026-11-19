-- Action-link previews: only the staging signup RPC may store them (no session-flag bypass).

CREATE OR REPLACE FUNCTION app.preview_body_contains_action_link(p_body text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT coalesce(p_body, '') ~* 'https?://[^[:space:]]+/auth/v1/verify\?'
    OR coalesce(p_body, '') ~* 'https%3a%2f%2f[^[:space:]]+%2fauth%2fv1%2fverify';
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
 IF app.preview_body_contains_action_link(p_body) THEN
   RAISE EXCEPTION 'Action link previews require staging signup RPC' USING ERRCODE = 'P0001';
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

CREATE OR REPLACE FUNCTION public.store_staging_signup_notification_preview(
  p_user_id uuid,
  p_subject text,
  p_body text,
  p_recipient_email text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  note_id bigint;
  lease uuid;
BEGIN
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
  IF NOT EXISTS (
    SELECT 1 FROM app.notification_outbox
    WHERE id = note_id AND lease_token = lease AND lease_until > clock_timestamp() AND delivered_at IS NULL
  ) THEN
    RETURN false;
  END IF;
  INSERT INTO app.notification_previews(notification_id, subject, body, recipient_email)
  VALUES (
    note_id,
    btrim(p_subject),
    p_body,
    NULLIF(btrim(p_recipient_email), '')
  )
  ON CONFLICT (notification_id) DO UPDATE SET
    subject = EXCLUDED.subject,
    body = EXCLUDED.body,
    recipient_email = COALESCE(EXCLUDED.recipient_email, app.notification_previews.recipient_email),
    created_at = clock_timestamp();
  RETURN public.finish_notification(note_id, lease, true);
END $$;