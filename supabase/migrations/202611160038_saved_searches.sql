CREATE FUNCTION app.saved_search_filters_valid(f jsonb) RETURNS boolean LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE k text; v text;
BEGIN
 IF f IS NULL OR jsonb_typeof(f)<>'object' THEN RETURN false; END IF;
 FOR k IN SELECT jsonb_object_keys(f) LOOP
   IF k NOT IN('transaction_type','judet','neighborhood','min_price_minor','max_price_minor','min_rooms') THEN RETURN false; END IF;
   v:=f->>k;
   IF k IN('transaction_type','judet','neighborhood') THEN
     IF jsonb_typeof(f->k)<>'string' OR v IS NULL THEN RETURN false; END IF;
     IF k='transaction_type' AND v NOT IN('sale','rent') THEN RETURN false; END IF;
     IF k='judet' AND NOT EXISTS(SELECT 1 FROM app.romania_judete WHERE name=v) THEN RETURN false; END IF;
     IF k='neighborhood' AND length(trim(v)) NOT BETWEEN 2 AND 100 THEN RETURN false; END IF;
   ELSE
     IF jsonb_typeof(f->k)<>'number' OR v IS NULL OR length(v)>13 OR v!~'^[0-9]+$' THEN RETURN false; END IF;
     IF v::numeric>1000000000000 OR (k='min_rooms' AND v::numeric>100) THEN RETURN false; END IF;
   END IF;
 END LOOP;
 RETURN NOT(f?'min_price_minor' AND f?'max_price_minor') OR (f->>'min_price_minor')::numeric<=(f->>'max_price_minor')::numeric;
END $$;
CREATE TABLE app.saved_searches(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES app.profiles(id) ON DELETE CASCADE,
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 80),filters jsonb NOT NULL CHECK(app.saved_search_filters_valid(filters)),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),last_notified_at timestamptz,UNIQUE(user_id,filters)
);
CREATE TABLE app.saved_search_alert_limits(
 user_id uuid PRIMARY KEY REFERENCES app.profiles(id) ON DELETE CASCADE,
 window_started_at timestamptz NOT NULL,queued_count integer NOT NULL CHECK(queued_count BETWEEN 1 AND 5)
);
ALTER TABLE app.saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.saved_search_alert_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app.saved_searches,app.saved_search_alert_limits FROM PUBLIC,anon,authenticated;
GRANT SELECT ON app.saved_searches TO authenticated;
CREATE POLICY saved_search_owner_read ON app.saved_searches FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));

CREATE FUNCTION app.limit_saved_searches() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 PERFORM pg_advisory_xact_lock(731041);
 IF (SELECT count(*) FROM app.saved_searches)>=1000 THEN RAISE EXCEPTION 'Saved search capacity reached'; END IF;
 IF (SELECT count(*) FROM app.saved_searches WHERE user_id=NEW.user_id)>=5 THEN RAISE EXCEPTION 'Saved search limit reached'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER saved_search_capacity BEFORE INSERT ON app.saved_searches FOR EACH ROW EXECUTE FUNCTION app.limit_saved_searches();

CREATE FUNCTION public.save_saved_search(p_name text,p_filters jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=app.require_user(); s app.saved_searches;
BEGIN
 IF p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'Invalid saved search name'; END IF;
 IF NOT app.saved_search_filters_valid(p_filters) THEN RAISE EXCEPTION 'Invalid saved search filters'; END IF;
 PERFORM pg_advisory_xact_lock(731041);
 SELECT * INTO s FROM app.saved_searches WHERE user_id=u AND filters=p_filters;
 IF FOUND THEN UPDATE app.saved_searches SET name=trim(p_name) WHERE id=s.id RETURNING * INTO s;
 ELSE INSERT INTO app.saved_searches(user_id,name,filters) VALUES(u,trim(p_name),p_filters) RETURNING * INTO s; END IF;
 RETURN to_jsonb(s)-'user_id';
END $$;
CREATE FUNCTION public.get_saved_searches() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(s)-'user_id' ORDER BY s.created_at,s.id),'[]'::jsonb) FROM app.saved_searches s WHERE s.user_id=auth.uid()
$$;
CREATE FUNCTION public.delete_saved_search(p_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=app.require_user(); removed uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(731041);
 -- Delete the search first: a concurrent fanout must finish before we purge its pending rows.
 DELETE FROM app.saved_searches WHERE id=p_id AND user_id=u RETURNING id INTO removed;
 IF removed IS NULL THEN RETURN false; END IF;
 DELETE FROM app.notification_outbox WHERE user_id=u AND entity_id=p_id AND event='search.updated' AND delivered_at IS NULL;
 RETURN true;
END $$;

CREATE FUNCTION app.saved_search_matches(f jsonb,l app.listings,p app.properties) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT
 l.status='published' AND (NOT(f?'transaction_type') OR l.transaction_type=f->>'transaction_type')
 AND (NOT(f?'judet') OR p.judet=f->>'judet')
 AND (NOT(f?'neighborhood') OR lower(trim(p.neighborhood))=lower(trim(f->>'neighborhood')))
 AND (NOT(f?'min_price_minor') OR l.price_minor>=(f->>'min_price_minor')::bigint)
 AND (NOT(f?'max_price_minor') OR l.price_minor<=(f->>'max_price_minor')::bigint)
 AND (NOT(f?'min_rooms') OR p.rooms>=(f->>'min_rooms')::integer)
$$;
CREATE FUNCTION app.queue_saved_search_alerts() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s app.saved_searches; p app.properties; t timestamptz; allowed uuid;
BEGIN
 IF NEW.price_minor IS NOT DISTINCT FROM OLD.price_minor AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
 -- Same global lock as CRUD/capacity bounds fanout to <=1000 rows and serializes rate budgets.
 -- This module never acquires property locks after this lock; provider sends happen elsewhere.
 PERFORM pg_advisory_xact_lock(731041);
 t:=clock_timestamp(); SELECT * INTO p FROM app.properties WHERE id=NEW.property_id;
 FOR s IN SELECT ss.* FROM app.saved_searches ss JOIN auth.users u ON u.id=ss.user_id
   WHERE u.email_confirmed_at IS NOT NULL AND (ss.last_notified_at IS NULL OR ss.last_notified_at<=t-interval '1 hour')
   AND (app.saved_search_matches(ss.filters,OLD,p) OR app.saved_search_matches(ss.filters,NEW,p)) ORDER BY ss.id FOR UPDATE OF ss
 LOOP
   allowed:=NULL;
   INSERT INTO app.saved_search_alert_limits AS budget(user_id,window_started_at,queued_count) VALUES(s.user_id,t,1)
   ON CONFLICT(user_id) DO UPDATE SET
     window_started_at=CASE WHEN budget.window_started_at<=t-interval '1 hour' THEN t ELSE budget.window_started_at END,
     queued_count=CASE WHEN budget.window_started_at<=t-interval '1 hour' THEN 1 ELSE budget.queued_count+1 END
   WHERE budget.window_started_at<=t-interval '1 hour' OR budget.queued_count<5 RETURNING user_id INTO allowed;
   IF allowed IS NOT NULL THEN
     INSERT INTO app.notification_outbox(user_id,event,entity_id) VALUES(s.user_id,'search.updated',s.id);
     UPDATE app.saved_searches SET last_notified_at=t WHERE id=s.id;
   END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER saved_search_listing_change AFTER UPDATE OF price_minor,status ON app.listings
FOR EACH ROW EXECUTE FUNCTION app.queue_saved_search_alerts();

REVOKE ALL ON FUNCTION app.saved_search_filters_valid(jsonb),app.limit_saved_searches(),app.saved_search_matches(jsonb,app.listings,app.properties),app.queue_saved_search_alerts() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.save_saved_search(text,jsonb),public.get_saved_searches(),public.delete_saved_search(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_saved_search(text,jsonb),public.get_saved_searches(),public.delete_saved_search(uuid) TO authenticated;

-- Preserve the bounded leased worker; only search alerts gain verification/subscription rechecks.
CREATE OR REPLACE FUNCTION public.claim_notifications(p_limit integer) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 WITH due AS MATERIALIZED (
  SELECT n.id FROM app.notification_outbox n JOIN auth.users u ON u.id=n.user_id
  WHERE n.delivered_at IS NULL AND n.attempts<5 AND n.next_attempt_at<=clock_timestamp()
   AND (n.lease_until IS NULL OR n.lease_until<=clock_timestamp()) AND u.email IS NOT NULL AND u.email<>''
   AND (n.event<>'search.updated' OR (u.email_confirmed_at IS NOT NULL AND EXISTS(SELECT 1 FROM app.saved_searches s WHERE s.id=n.entity_id AND s.user_id=n.user_id)))
  ORDER BY n.next_attempt_at,n.id
  LIMIT least(greatest(coalesce(p_limit,0),0),50)
  FOR UPDATE OF n SKIP LOCKED
 ), claimed AS (
  UPDATE app.notification_outbox n SET attempts=n.attempts+1,lease_until=clock_timestamp()+interval '2 minutes',lease_token=gen_random_uuid()
  FROM due WHERE n.id=due.id RETURNING n.id,n.user_id,n.event,n.entity_id,n.lease_token
 ) SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.id,'email',u.email,'event',c.event,'entity_id',c.entity_id,'lease_token',c.lease_token) ORDER BY c.id),'[]'::jsonb)
 FROM claimed c JOIN auth.users u ON u.id=c.user_id
$$;
