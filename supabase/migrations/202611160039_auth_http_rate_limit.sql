-- HTTP auth route rate limits (hashed keys only; service_role RPC).

CREATE TABLE app.auth_http_rate_limits (
  key_hash text NOT NULL CHECK (char_length(key_hash) = 64),
  hit_count integer NOT NULL DEFAULT 0 CHECK (hit_count >= 0),
  window_started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  window_seconds integer NOT NULL CHECK (window_seconds > 0 AND window_seconds <= 86400),
  PRIMARY KEY (key_hash)
);

ALTER TABLE app.auth_http_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE app.auth_http_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE app.auth_http_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION app.auth_http_rate_limits_purge_expired(p_now timestamptz)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  DELETE FROM app.auth_http_rate_limits
  WHERE window_started_at + make_interval(secs => window_seconds) < p_now - interval '1 hour';
$$;

REVOKE ALL ON FUNCTION app.auth_http_rate_limits_purge_expired(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app.auth_http_rate_limits_purge_expired(timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.auth_http_rate_limit_consume(
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer,
  p_increment boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_row app.auth_http_rate_limits;
  v_window_end timestamptz;
  v_retry integer;
BEGIN
  IF p_key_hash IS NULL OR btrim(p_key_hash) = ''
    OR char_length(btrim(p_key_hash)) <> 64
    OR p_limit IS NULL OR p_limit < 1 OR p_limit > 10000
    OR p_window_seconds IS NULL OR p_window_seconds < 1 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'Invalid auth rate-limit request' USING ERRCODE = 'P0001';
  END IF;

  PERFORM app.auth_http_rate_limits_purge_expired(v_now);

  INSERT INTO app.auth_http_rate_limits(key_hash, hit_count, window_started_at, window_seconds)
  VALUES (btrim(p_key_hash), 0, v_now, p_window_seconds)
  ON CONFLICT (key_hash) DO NOTHING;

  SELECT * INTO v_row
  FROM app.auth_http_rate_limits
  WHERE key_hash = btrim(p_key_hash)
  FOR UPDATE;

  v_window_end := v_row.window_started_at + make_interval(secs => v_row.window_seconds);

  IF v_now >= v_window_end THEN
    v_row.hit_count := 0;
    v_row.window_started_at := v_now;
    UPDATE app.auth_http_rate_limits
    SET hit_count = 0,
        window_started_at = v_now,
        window_seconds = p_window_seconds
    WHERE key_hash = btrim(p_key_hash);
    v_window_end := v_now + make_interval(secs => p_window_seconds);
  ELSIF v_row.window_seconds <> p_window_seconds THEN
    UPDATE app.auth_http_rate_limits
    SET window_seconds = p_window_seconds
    WHERE key_hash = btrim(p_key_hash);
  END IF;

  IF v_row.hit_count >= p_limit THEN
    v_retry := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_window_end - v_now)))::integer);
    RETURN jsonb_build_object('allowed', false, 'retry_after_seconds', v_retry);
  END IF;

  IF NOT COALESCE(p_increment, true) THEN
    RETURN jsonb_build_object('allowed', true);
  END IF;

  UPDATE app.auth_http_rate_limits
  SET hit_count = hit_count + 1
  WHERE key_hash = btrim(p_key_hash)
    AND hit_count < p_limit
  RETURNING hit_count INTO v_row.hit_count;

  IF NOT FOUND THEN
    v_retry := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_window_end - v_now)))::integer);
    RETURN jsonb_build_object('allowed', false, 'retry_after_seconds', v_retry);
  END IF;

  RETURN jsonb_build_object('allowed', true);
END;
$$;

REVOKE ALL ON FUNCTION public.auth_http_rate_limit_consume(text, integer, integer, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_http_rate_limit_consume(text, integer, integer, boolean) TO service_role;
