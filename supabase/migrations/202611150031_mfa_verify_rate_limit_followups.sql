-- QA follow-ups: skip unparseable client IPs; record IP hash on ip_locked audit.

CREATE OR REPLACE FUNCTION app.mfa_verify_log_lockout(
  p_user_id uuid,
  p_factor_id uuid,
  p_event text,
  p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO app.audit_events(actor_id, event, entity_id, payload)
  VALUES (p_user_id, p_event, p_factor_id, COALESCE(p_payload, '{}'::jsonb));
$$;

REVOKE ALL ON FUNCTION app.mfa_verify_log_lockout(uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app.mfa_verify_log_lockout(uuid, uuid, text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.mfa_verify_rate_limit(
  p_user_id uuid,
  p_factor_id uuid,
  p_client_ip text,
  p_operation text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_ip inet;
  v_track_ip boolean := false;
  v_factor_row app.mfa_verify_factor_limits;
  v_ip_row app.mfa_verify_ip_limits;
  v_prev_factor integer;
  v_prev_ip integer;
  v_ip_hash text;
BEGIN
  IF p_user_id IS NULL OR p_factor_id IS NULL OR p_operation IS NULL
    OR p_operation NOT IN ('attempt', 'reset') THEN
    RAISE EXCEPTION 'Invalid MFA rate-limit request' USING ERRCODE = 'P0001';
  END IF;

  IF p_operation = 'reset' THEN
    DELETE FROM app.mfa_verify_factor_limits
    WHERE user_id = p_user_id AND factor_id = p_factor_id;
    RETURN jsonb_build_object('allowed', true);
  END IF;

  IF p_client_ip IS NOT NULL AND btrim(p_client_ip) <> '' THEN
    BEGIN
      v_ip := btrim(p_client_ip)::inet;
      v_track_ip := true;
    EXCEPTION WHEN OTHERS THEN
      v_track_ip := false;
    END;
  END IF;

  INSERT INTO app.mfa_verify_factor_limits(user_id, factor_id, failure_count, window_started_at)
  VALUES (p_user_id, p_factor_id, 0, v_now)
  ON CONFLICT (user_id, factor_id) DO NOTHING;

  SELECT * INTO v_factor_row
  FROM app.mfa_verify_factor_limits
  WHERE user_id = p_user_id AND factor_id = p_factor_id
  FOR UPDATE;

  IF NOT app.mfa_verify_window_active(v_factor_row.window_started_at, v_now, interval '10 minutes') THEN
    v_factor_row.failure_count := 0;
    v_factor_row.window_started_at := v_now;
    UPDATE app.mfa_verify_factor_limits
    SET failure_count = 0,
        window_started_at = v_now
    WHERE user_id = p_user_id AND factor_id = p_factor_id;
  END IF;

  IF v_factor_row.failure_count >= 5 THEN
    RETURN jsonb_build_object('allowed', false);
  END IF;

  IF v_track_ip THEN
    INSERT INTO app.mfa_verify_ip_limits(client_ip, failure_count, window_started_at)
    VALUES (v_ip, 0, v_now)
    ON CONFLICT (client_ip) DO NOTHING;

    SELECT * INTO v_ip_row
    FROM app.mfa_verify_ip_limits
    WHERE client_ip = v_ip
    FOR UPDATE;

    IF NOT app.mfa_verify_window_active(v_ip_row.window_started_at, v_now, interval '10 minutes') THEN
      v_ip_row.failure_count := 0;
      v_ip_row.window_started_at := v_now;
      UPDATE app.mfa_verify_ip_limits
      SET failure_count = 0,
          window_started_at = v_now
      WHERE client_ip = v_ip;
    END IF;

    IF v_ip_row.failure_count >= 20 THEN
      RETURN jsonb_build_object('allowed', false);
    END IF;
  END IF;

  v_prev_factor := v_factor_row.failure_count;
  UPDATE app.mfa_verify_factor_limits
  SET failure_count = failure_count + 1
  WHERE user_id = p_user_id
    AND factor_id = p_factor_id
    AND failure_count < 5
  RETURNING failure_count, window_started_at INTO v_factor_row.failure_count, v_factor_row.window_started_at;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false);
  END IF;

  IF v_prev_factor < 5 AND v_factor_row.failure_count >= 5 THEN
    PERFORM app.mfa_verify_log_lockout(p_user_id, p_factor_id, 'mfa.verify_locked', '{}'::jsonb);
  END IF;

  IF v_track_ip THEN
    v_prev_ip := v_ip_row.failure_count;
    UPDATE app.mfa_verify_ip_limits
    SET failure_count = failure_count + 1
    WHERE client_ip = v_ip
      AND failure_count < 20
    RETURNING failure_count, window_started_at INTO v_ip_row.failure_count, v_ip_row.window_started_at;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('allowed', false);
    END IF;

    IF v_prev_ip < 20 AND v_ip_row.failure_count >= 20 THEN
      v_ip_hash := encode(extensions.digest(host(v_ip)::text, 'sha256'), 'hex');
      PERFORM app.mfa_verify_log_lockout(
        p_user_id,
        p_factor_id,
        'mfa.verify_ip_locked',
        jsonb_build_object('client_ip_hash', v_ip_hash)
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('allowed', true);
END;
$$;

REVOKE ALL ON FUNCTION public.mfa_verify_rate_limit(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mfa_verify_rate_limit(uuid, uuid, text, text) TO service_role;

DROP FUNCTION IF EXISTS app.mfa_verify_log_lockout(uuid, uuid, text);