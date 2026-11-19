-- Staging password recovery: enqueue app-built token_hash callback URLs into notification_previews.

CREATE OR REPLACE FUNCTION public.store_staging_recovery_notification_preview(
  p_user_id uuid,
  p_subject text,
  p_body text,
  p_recipient_email text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  note_id bigint;
  lease uuid;
BEGIN
  IF p_user_id IS NULL OR p_subject IS NULL OR btrim(p_subject) = '' OR p_body IS NULL OR btrim(p_body) = '' THEN
    RAISE EXCEPTION 'Preview content required';
  END IF;
  IF p_recipient_email IS NULL OR btrim(p_recipient_email) = '' THEN
    RAISE EXCEPTION 'Recovery recipient email required';
  END IF;
  IF btrim(p_subject) <> 'LicitatieRO — resetează parola / reset your password' THEN
    RAISE EXCEPTION 'Recovery preview subject required' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM app.profiles WHERE id = p_user_id) THEN
    RETURN false;
  END IF;
  INSERT INTO app.notification_outbox(user_id, event, entity_id)
  VALUES (p_user_id, 'auth.password_recovery', NULL)
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
END;
$$;

REVOKE ALL ON FUNCTION public.store_staging_recovery_notification_preview(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_staging_recovery_notification_preview(uuid, text, text, text) TO service_role;
