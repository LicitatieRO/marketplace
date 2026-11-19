-- Staging sign-up: enqueue confirmation link into notification_previews via existing worker RPCs.
CREATE FUNCTION public.store_staging_signup_notification_preview(
  p_user_id uuid,
  p_subject text,
  p_body text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  note_id bigint;
  lease uuid;
  stored boolean;
BEGIN
  IF p_user_id IS NULL OR p_subject IS NULL OR btrim(p_subject)='' OR p_body IS NULL OR btrim(p_body)='' THEN
    RAISE EXCEPTION 'Preview content required';
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
  stored := public.store_notification_preview(note_id, lease, p_subject, p_body);
  IF NOT stored THEN
    RETURN false;
  END IF;
  RETURN public.finish_notification(note_id, lease, true);
END $$;
REVOKE ALL ON FUNCTION public.store_staging_signup_notification_preview(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_staging_signup_notification_preview(uuid, text, text) TO service_role;