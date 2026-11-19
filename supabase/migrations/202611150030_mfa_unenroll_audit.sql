CREATE OR REPLACE FUNCTION public.audit_mfa_factor_unenrolled(p_factor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_factor_id IS NULL THEN
    RAISE EXCEPTION 'Factor id required' USING ERRCODE = 'P0001';
  END IF;
  PERFORM app.audit('mfa.factor_unenrolled', p_factor_id);
END;
$$;

REVOKE ALL ON FUNCTION public.audit_mfa_factor_unenrolled(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.audit_mfa_factor_unenrolled(uuid) TO authenticated;
