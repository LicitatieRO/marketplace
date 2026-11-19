-- MFA unenroll audit: service_role only; explicit actor; drop forged authenticated RPC.

DROP FUNCTION IF EXISTS public.audit_mfa_factor_unenrolled(uuid);

CREATE OR REPLACE FUNCTION public.audit_mfa_factor_unenrolled(
  p_user_id uuid,
  p_factor_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id required' USING ERRCODE = 'P0001';
  END IF;
  IF p_factor_id IS NULL THEN
    RAISE EXCEPTION 'Factor id required' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM auth.mfa_factors AS f
    WHERE f.id = p_factor_id
      AND f.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Factor still enrolled' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM auth.mfa_factors AS f
    WHERE f.id = p_factor_id
      AND f.user_id IS DISTINCT FROM p_user_id
  ) THEN
    RAISE EXCEPTION 'Factor not owned by user' USING ERRCODE = '42501';
  END IF;

  INSERT INTO app.audit_events(actor_id, event, entity_id, payload)
  VALUES (p_user_id, 'mfa.factor_unenrolled', p_factor_id, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.audit_mfa_factor_unenrolled(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_mfa_factor_unenrolled(uuid, uuid) TO service_role;