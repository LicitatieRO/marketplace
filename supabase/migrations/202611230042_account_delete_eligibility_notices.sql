-- Tighten notice-based eligibility check: drop unverified notifier_email matching.

CREATE OR REPLACE FUNCTION app.account_delete_eligibility(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text;
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
