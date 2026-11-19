-- Recovery generateLink cooldown + extend generic preview guard for token_hash callback links.

CREATE OR REPLACE FUNCTION app.preview_body_contains_action_link(p_body text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT coalesce(p_body, '') ~* 'https?://[^[:space:]]+/auth/v1/verify\?'
    OR coalesce(p_body, '') ~* 'https%3a%2f%2f[^[:space:]]+%2fauth%2fv1%2fverify'
    OR coalesce(p_body, '') ~* 'https?://[^[:space:]]+/auth/callback\?[^\s]*token_hash='
    OR coalesce(p_body, '') ~* 'https%3a%2f%2f[^[:space:]]+%2fauth%2fcallback[^\s]*token_hash=';
$$;

CREATE OR REPLACE FUNCTION public.recovery_generate_link_cooldown_active(p_email text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF p_email IS NULL OR btrim(p_email) = '' THEN
    RETURN false;
  END IF;
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(btrim(p_email));
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM app.notification_outbox n
    JOIN app.notification_previews p ON p.notification_id = n.id
    WHERE n.user_id = v_user_id
      AND n.event = 'auth.password_recovery'
      AND p.created_at > clock_timestamp() - interval '60 seconds'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.recovery_generate_link_cooldown_active(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recovery_generate_link_cooldown_active(text) TO service_role;
