-- App-level MFA verify attempt counters (per user+factor and per client IP).

CREATE TABLE app.mfa_verify_factor_limits (
  user_id uuid NOT NULL,
  factor_id uuid NOT NULL,
  failure_count integer NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
  window_started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (user_id, factor_id)
);

CREATE TABLE app.mfa_verify_ip_limits (
  client_ip inet NOT NULL,
  failure_count integer NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
  window_started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (client_ip)
);

ALTER TABLE app.mfa_verify_factor_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.mfa_verify_ip_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE app.mfa_verify_factor_limits, app.mfa_verify_ip_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE app.mfa_verify_factor_limits, app.mfa_verify_ip_limits TO service_role;

CREATE OR REPLACE FUNCTION app.mfa_verify_window_active(
  p_started_at timestamptz,
  p_now timestamptz,
  p_window interval
) RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT p_started_at > p_now - p_window;
$$;

CREATE OR REPLACE FUNCTION app.mfa_verify_factor_locked(
  p_count integer,
  p_started_at timestamptz,
  p_now timestamptz
) RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT p_count >= 5
    AND app.mfa_verify_window_active(p_started_at, p_now, interval '10 minutes');
$$;

CREATE OR REPLACE FUNCTION app.mfa_verify_ip_locked(
  p_count integer,
  p_started_at timestamptz,
  p_now timestamptz
) RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT p_count >= 20
    AND app.mfa_verify_window_active(p_started_at, p_now, interval '10 minutes');
$$;

CREATE OR REPLACE FUNCTION app.mfa_verify_log_lockout(
  p_user_id uuid,
  p_factor_id uuid,
  p_event text
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO app.audit_events(actor_id, event, entity_id, payload)
  VALUES (p_user_id, p_event, p_factor_id, '{}'::jsonb);
$$;

REVOKE ALL ON FUNCTION app.mfa_verify_log_lockout(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app.mfa_verify_log_lockout(uuid, uuid, text) TO service_role;

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
      RAISE EXCEPTION 'Invalid MFA rate-limit request' USING ERRCODE = 'P0001';
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
    PERFORM app.mfa_verify_log_lockout(p_user_id, p_factor_id, 'mfa.verify_locked');
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
      PERFORM app.mfa_verify_log_lockout(p_user_id, p_factor_id, 'mfa.verify_ip_locked');
    END IF;
  END IF;

  RETURN jsonb_build_object('allowed', true);
END;
$$;

REVOKE ALL ON FUNCTION public.mfa_verify_rate_limit(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mfa_verify_rate_limit(uuid, uuid, text, text) TO service_role;