-- Account delete: cascade notification recipients; treat invite-only members in eligibility.

DO $$
DECLARE
  v_confdeltype "char";
  v_confrelid oid;
BEGIN
  SELECT c.confdeltype, c.confrelid
  INTO v_confdeltype, v_confrelid
  FROM pg_constraint AS c
  JOIN pg_class AS src_cls ON src_cls.oid = c.conrelid
  JOIN pg_namespace AS src_ns ON src_ns.oid = src_cls.relnamespace
  WHERE src_ns.nspname = 'app'
    AND src_cls.relname = 'notification_outbox'
    AND c.conname = 'notification_outbox_user_id_fkey'
    AND c.contype = 'f';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'notification_outbox_user_id_fkey missing';
  END IF;

  IF v_confdeltype = 'c' AND v_confrelid = 'app.profiles'::regclass THEN
    RETURN;
  END IF;

  ALTER TABLE app.notification_outbox
    DROP CONSTRAINT notification_outbox_user_id_fkey;

  ALTER TABLE app.notification_outbox
    ADD CONSTRAINT notification_outbox_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES app.profiles(id)
    ON DELETE CASCADE
    NOT VALID;

  ALTER TABLE app.notification_outbox
    VALIDATE CONSTRAINT notification_outbox_user_id_fkey;
END $$;

CREATE OR REPLACE FUNCTION app.account_delete_release_invites(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted integer;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id required' USING ERRCODE = 'P0001';
  END IF;

  WITH removed AS (
    DELETE FROM app.auction_members AS m
    WHERE m.user_id = p_user_id
      AND NOT EXISTS (
        SELECT 1
        FROM app.bids AS b
        WHERE b.auction_id = m.auction_id
          AND b.bidder_id = p_user_id
      )
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_deleted FROM removed;

  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION app.account_delete_release_invites(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app.account_delete_release_invites(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.account_delete_release_invites(p_user_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app.account_delete_release_invites(p_user_id);
$$;

REVOKE ALL ON FUNCTION public.account_delete_release_invites(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_delete_release_invites(uuid) TO service_role;

CREATE OR REPLACE FUNCTION app.account_delete_eligibility(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ref record;
  v_has_row boolean;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id required' USING ERRCODE = 'P0001';
  END IF;

  PERFORM 1 FROM auth.users AS u WHERE u.id = p_user_id;
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
    IF v_ref.schema_name = 'app'
      AND v_ref.table_name = 'auction_members'
      AND v_ref.column_name = 'user_id'
    THEN
      SELECT EXISTS (
        SELECT 1
        FROM app.auction_members AS m
        WHERE m.user_id = p_user_id
          AND EXISTS (
            SELECT 1
            FROM app.bids AS b
            WHERE b.auction_id = m.auction_id
              AND b.bidder_id = p_user_id
          )
      ) INTO v_has_row;
    ELSE
      EXECUTE format(
        'SELECT EXISTS (SELECT 1 FROM %I.%I WHERE %I = $1)',
        v_ref.schema_name,
        v_ref.table_name,
        v_ref.column_name
      )
      INTO v_has_row
      USING p_user_id;
    END IF;
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
