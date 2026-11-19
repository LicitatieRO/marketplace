-- Account self-delete eligibility (service_role RPC; SECURITY DEFINER).

CREATE OR REPLACE FUNCTION app.account_delete_non_cascade_user_fks()
RETURNS TABLE(schema_name text, table_name text, column_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    src_ns.nspname::text,
    src_cls.relname::text,
    src_att.attname::text
  FROM pg_constraint AS con
  JOIN pg_class AS src_cls ON src_cls.oid = con.conrelid
  JOIN pg_namespace AS src_ns ON src_ns.oid = src_cls.relnamespace
  JOIN pg_class AS ref_cls ON ref_cls.oid = con.confrelid
  JOIN pg_namespace AS ref_ns ON ref_ns.oid = ref_cls.relnamespace
  JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS src(attnum, ord) ON true
  JOIN LATERAL unnest(con.confkey) WITH ORDINALITY AS ref(attnum, ord)
    ON src.ord = ref.ord
  JOIN pg_attribute AS src_att
    ON src_att.attrelid = con.conrelid
   AND src_att.attnum = src.attnum
   AND src_att.attnum > 0
   AND NOT src_att.attisdropped
  WHERE con.contype = 'f'
    AND con.confdeltype NOT IN ('c', 'n', 'd')
    AND src_ns.nspname <> 'auth'
    AND (
      (ref_ns.nspname = 'auth' AND ref_cls.relname = 'users')
      OR (ref_ns.nspname = 'app' AND ref_cls.relname = 'profiles')
    )
  ORDER BY 1, 2, 3;
$$;

REVOKE ALL ON FUNCTION app.account_delete_non_cascade_user_fks() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app.account_delete_non_cascade_user_fks() TO service_role;

CREATE OR REPLACE FUNCTION app.account_delete_eligibility(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text;
  v_norm_email text;
  v_ref record;
  v_has_row boolean;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id required' USING ERRCODE = 'P0001';
  END IF;

  SELECT u.email INTO v_email
  FROM auth.users AS u
  WHERE u.id = p_user_id;

  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM app.profiles AS p
    WHERE p.id = p_user_id AND p.is_staff
  ) THEN
    RETURN 'staff';
  END IF;

  IF EXISTS (
    SELECT 1 FROM app.listings AS l
    WHERE l.owner_id = p_user_id AND l.status = 'published'
  ) THEN
    RETURN 'published_listings';
  END IF;

  IF EXISTS (
    SELECT 1 FROM app.auctions AS a
    WHERE a.owner_id = p_user_id AND a.status IN ('scheduled', 'active')
  ) THEN
    RETURN 'active_auctions';
  END IF;

  IF EXISTS (
    SELECT 1 FROM app.reservations AS r
    WHERE (r.owner_id = p_user_id OR r.buyer_id = p_user_id)
      AND r.status IN ('requested', 'funded')
  ) THEN
    RETURN 'open_reservations';
  END IF;

  IF EXISTS (
    SELECT 1 FROM app.property_promos AS pp
    WHERE pp.owner_id = p_user_id AND pp.status IN ('pending', 'active')
  ) THEN
    RETURN 'open_promotions';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM app.bids AS b
    JOIN app.auctions AS a ON a.id = b.auction_id
    WHERE b.bidder_id = p_user_id AND a.status IN ('scheduled', 'active')
  ) THEN
    RETURN 'open_bids';
  END IF;

  v_norm_email := lower(btrim(coalesce(v_email, '')));
  IF v_norm_email <> '' AND EXISTS (
    SELECT 1
    FROM app.dsa_notices AS n
    WHERE n.notifier_email IS NOT NULL
      AND lower(btrim(n.notifier_email)) = v_norm_email
  ) THEN
    RETURN 'dsa_notices';
  END IF;

  FOR v_ref IN
    SELECT f.schema_name, f.table_name, f.column_name
    FROM app.account_delete_non_cascade_user_fks() AS f
  LOOP
    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM %I.%I WHERE %I = $1)',
      v_ref.schema_name,
      v_ref.table_name,
      v_ref.column_name
    )
    INTO v_has_row
    USING p_user_id;
    IF v_has_row THEN
      RETURN 'has_history';
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION app.account_delete_eligibility(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app.account_delete_eligibility(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.account_delete_eligibility(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app.account_delete_eligibility(p_user_id);
$$;

REVOKE ALL ON FUNCTION public.account_delete_eligibility(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_delete_eligibility(uuid) TO service_role;
