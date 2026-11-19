-- Sandbox payments: Stripe test / mock ledger and property-level promotions (€10 / 7 days).
CREATE TABLE app.stripe_events(
  event_id text PRIMARY KEY,
  type text NOT NULL,
  payload_digest text,
  livemode boolean NOT NULL,
  rejected boolean NOT NULL DEFAULT false,
  processed_at timestamptz
);
CREATE TABLE app.property_promos(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES app.properties(id),
  owner_id uuid NOT NULL REFERENCES app.profiles(id),
  starts_at timestamptz,
  ends_at timestamptz,
  expires_at timestamptz NOT NULL,
  amount_minor bigint NOT NULL DEFAULT 1000 CHECK(amount_minor=1000),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','expired','cancelled')),
  stripe_session_id text UNIQUE,
  mode text NOT NULL CHECK(mode IN ('stripe_test','mock')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX one_open_promo_per_property ON app.property_promos(property_id)
  WHERE status IN ('pending','active');
CREATE TABLE app.ledger_entries(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account text NOT NULL,
  amount_minor bigint NOT NULL CHECK(amount_minor>=0),
  currency text NOT NULL DEFAULT 'EUR' CHECK(currency='EUR'),
  direction text NOT NULL CHECK(direction IN ('credit','debit')),
  purpose text NOT NULL,
  stripe_event_id text REFERENCES app.stripe_events(event_id),
  reservation_id uuid REFERENCES app.reservations(id),
  promo_id uuid REFERENCES app.property_promos(id),
  mode text NOT NULL CHECK(mode IN ('stripe_test','mock')),
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(stripe_event_id,purpose)
);
ALTER TABLE app.stripe_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.property_promos ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.ledger_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app.stripe_events,app.property_promos,app.ledger_entries FROM PUBLIC,anon,authenticated;

CREATE FUNCTION app.sweep_property_promos(p_property_id uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE app.property_promos SET status='cancelled'
 WHERE status='pending' AND expires_at<=clock_timestamp() AND (p_property_id IS NULL OR property_id=p_property_id);
 UPDATE app.property_promos SET status='expired'
 WHERE status='active' AND expires_at<=clock_timestamp() AND (p_property_id IS NULL OR property_id=p_property_id);
END $$;
REVOKE EXECUTE ON FUNCTION app.sweep_property_promos(uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.expire_property_promos() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM app.sweep_property_promos(NULL); END $$;
REVOKE EXECUTE ON FUNCTION public.expire_property_promos() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.expire_property_promos() TO service_role;

CREATE FUNCTION app.active_promo_expires(p_property_id uuid) RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT expires_at FROM app.property_promos
  WHERE property_id=p_property_id AND status='active' AND expires_at>clock_timestamp()
  ORDER BY expires_at DESC LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION app.active_promo_expires(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION app.listing_json(p_listing_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object(
 'id',l.id,'property_id',p.id,'owner_id',l.owner_id,'title',p.title,'description',p.description,'neighborhood',p.neighborhood,'property_type',p.property_type,
 'transaction_type',l.transaction_type,'price_minor',l.price_minor,'currency',l.currency,'area_sqm',p.area_sqm,'rooms',p.rooms,'floor',p.floor,'built_year',p.built_year,'image_urls',p.image_urls,'tenancy_status',p.tenancy_status,'status',l.status,'tour_url',p.tour_url,
 'promo_expires_at',app.active_promo_expires(p.id),
 'auction_id',a.id,'auction_mode',a.mode,'auction_access',a.access,
 'ends_at',CASE WHEN eligible.yes THEN a.ends_at END,'starts_at',CASE WHEN eligible.yes THEN a.starts_at END,
 'current_bid_minor',CASE WHEN eligible.yes AND a.mode='ascending' THEN (SELECT max(amount_minor) FROM app.bids WHERE auction_id=a.id) END,
 'bid_count',CASE WHEN eligible.yes THEN (SELECT count(*) FROM app.bids WHERE auction_id=a.id) ELSE 0 END,
 'min_increment_minor',CASE WHEN eligible.yes THEN a.min_increment_minor END,'starting_price_minor',CASE WHEN eligible.yes THEN a.starting_price_minor END)
 FROM app.listings l JOIN app.properties p ON p.id=l.property_id LEFT JOIN app.auctions a ON a.id=l.auction_id
 CROSS JOIN LATERAL(SELECT a.access='public' OR a.owner_id=auth.uid() OR EXISTS(SELECT 1 FROM app.auction_members m WHERE m.auction_id=a.id AND m.user_id=auth.uid()) AS yes) eligible
 WHERE l.id=p_listing_id
$$;

CREATE FUNCTION public.prepare_property_promo(
  p_property_id uuid,
  p_owner_id uuid,
  p_idempotency_key uuid,
  p_mode text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p app.properties; r jsonb; payload jsonb; promo app.property_promos; existing app.property_promos;
BEGIN
 IF p_mode NOT IN ('stripe_test','mock') THEN RAISE EXCEPTION 'Invalid promotion mode'; END IF;
 SELECT * INTO p FROM app.properties WHERE id=p_property_id FOR UPDATE;
 IF NOT FOUND OR p.owner_id<>p_owner_id THEN RAISE EXCEPTION 'Owner required'; END IF;
 PERFORM app.sweep_property_promos(p_property_id);
 payload:=jsonb_build_object('property',p_property_id,'mode',p_mode);
 r:=app.replay(p_owner_id,p_idempotency_key,'promo_prepare',payload);
 IF r IS NOT NULL THEN RETURN r; END IF;
 SELECT * INTO existing FROM app.property_promos
 WHERE property_id=p.id AND status='pending' AND expires_at>clock_timestamp()
 ORDER BY created_at DESC LIMIT 1;
 IF FOUND THEN
  r:=jsonb_build_object('id',existing.id,'property_id',existing.property_id,'status',existing.status,'mode',existing.mode,'amount_minor',existing.amount_minor,'stripe_session_id',existing.stripe_session_id,'reused',true);
  PERFORM app.remember(p_owner_id,p_idempotency_key,'promo_prepare',payload,r);
  RETURN r;
 END IF;
 IF EXISTS(SELECT 1 FROM app.property_promos WHERE property_id=p.id AND status='active' AND expires_at>clock_timestamp()) THEN
  RAISE EXCEPTION 'Promotion already active for this property';
 END IF;
 INSERT INTO app.property_promos(property_id,owner_id,amount_minor,status,mode,expires_at)
 VALUES(p.id,p_owner_id,1000,'pending',p_mode,clock_timestamp()+interval '35 minutes') RETURNING * INTO promo;
 r:=jsonb_build_object('id',promo.id,'property_id',promo.property_id,'status',promo.status,'mode',promo.mode,'amount_minor',promo.amount_minor,'reused',false);
 PERFORM app.remember(p_owner_id,p_idempotency_key,'promo_prepare',payload,r);
 RETURN r;
END $$;

CREATE FUNCTION public.attach_promo_checkout_session(p_promo_id uuid,p_owner_id uuid,p_stripe_session_id text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE promo app.property_promos;
BEGIN
 SELECT * INTO promo FROM app.property_promos WHERE id=p_promo_id FOR UPDATE;
 IF NOT FOUND OR promo.owner_id<>p_owner_id OR promo.status<>'pending' OR promo.mode<>'stripe_test' THEN
  RAISE EXCEPTION 'Promotion state mismatch';
 END IF;
 UPDATE app.property_promos SET stripe_session_id=p_stripe_session_id WHERE id=p_promo_id RETURNING * INTO promo;
 RETURN to_jsonb(promo);
END $$;

CREATE FUNCTION public.complete_mock_property_promo(p_promo_id uuid,p_owner_id uuid,p_idempotency_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE promo app.property_promos; r jsonb; payload jsonb; ledger_id uuid; mock_event text;
BEGIN
 SELECT * INTO promo FROM app.property_promos WHERE id=p_promo_id FOR UPDATE;
 IF NOT FOUND OR promo.owner_id<>p_owner_id THEN RAISE EXCEPTION 'Owner required'; END IF;
 IF promo.mode<>'mock' THEN RAISE EXCEPTION 'Mock checkout only'; END IF;
 payload:=jsonb_build_object('promo',p_promo_id);
 r:=app.replay(p_owner_id,p_idempotency_key,'promo_mock',payload);
 IF r IS NOT NULL THEN RETURN r; END IF;
 IF promo.status<>'pending' THEN RAISE EXCEPTION 'Promotion is not pending'; END IF;
 mock_event:='mock_'||p_promo_id::text;
 IF EXISTS(SELECT 1 FROM app.stripe_events WHERE event_id=mock_event AND processed_at IS NOT NULL) THEN
  r:=(SELECT to_jsonb(pp) FROM app.property_promos pp WHERE id=p_promo_id);
  PERFORM app.remember(p_owner_id,p_idempotency_key,'promo_mock',payload,r);
  RETURN r;
 END IF;
 INSERT INTO app.stripe_events(event_id,type,payload_digest,livemode,rejected,processed_at)
 VALUES(mock_event,'mock.checkout.completed',md5(p_promo_id::text),false,false,clock_timestamp());
 UPDATE app.property_promos SET status='active',starts_at=clock_timestamp(),ends_at=clock_timestamp()+interval '7 days',expires_at=clock_timestamp()+interval '7 days',
  stripe_session_id='mock_session_'||p_promo_id::text
 WHERE id=p_promo_id RETURNING * INTO promo;
 INSERT INTO app.ledger_entries(account,amount_minor,currency,direction,purpose,stripe_event_id,promo_id,mode,idempotency_key)
 VALUES('platform:promo_simulated',0,'EUR','credit','property_promo',mock_event,promo.id,'mock',p_idempotency_key::text)
 RETURNING id INTO ledger_id;
 r:=to_jsonb(promo)||jsonb_build_object('ledger_id',ledger_id,'real_amount_minor',0,'label','POC / Simulare');
 PERFORM app.remember(p_owner_id,p_idempotency_key,'promo_mock',payload,r);
 PERFORM app.audit('promo.mock_completed',promo.id,jsonb_build_object('property_id',promo.property_id));
 RETURN r;
END $$;

CREATE FUNCTION public.complete_promo_stripe_checkout(
  p_stripe_event_id text,p_event_type text,p_livemode boolean,p_payload_digest text,
  p_session_id text,p_property_id uuid,p_promo_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE promo app.property_promos; ledger_id uuid; inserted_event_id text;
BEGIN
 INSERT INTO app.stripe_events(event_id,type,payload_digest,livemode,rejected,processed_at)
 VALUES(p_stripe_event_id,p_event_type,p_payload_digest,p_livemode,p_livemode,CASE WHEN p_livemode THEN clock_timestamp() ELSE NULL END)
 ON CONFLICT(event_id) DO NOTHING
 RETURNING event_id INTO inserted_event_id;
 IF inserted_event_id IS NULL THEN
  RETURN jsonb_build_object('status','duplicate','event_id',p_stripe_event_id);
 END IF;
 IF p_livemode IS DISTINCT FROM false THEN
  UPDATE app.stripe_events SET rejected=true,processed_at=clock_timestamp() WHERE event_id=p_stripe_event_id;
  RETURN jsonb_build_object('status','rejected_livemode','event_id',p_stripe_event_id);
 END IF;
 SELECT * INTO promo FROM app.property_promos WHERE id=p_promo_id FOR UPDATE;
 IF NOT FOUND OR promo.property_id<>p_property_id OR promo.status<>'pending' OR promo.mode<>'stripe_test'
  OR promo.stripe_session_id IS DISTINCT FROM p_session_id THEN
  UPDATE app.stripe_events SET rejected=true,processed_at=clock_timestamp() WHERE event_id=p_stripe_event_id;
  RETURN jsonb_build_object('status','rejected_mismatch','event_id',p_stripe_event_id);
 END IF;
 UPDATE app.property_promos SET status='active',starts_at=clock_timestamp(),ends_at=clock_timestamp()+interval '7 days',expires_at=clock_timestamp()+interval '7 days',stripe_session_id=p_session_id
 WHERE id=p_promo_id RETURNING * INTO promo;
 INSERT INTO app.ledger_entries(account,amount_minor,currency,direction,purpose,stripe_event_id,promo_id,mode,idempotency_key)
 VALUES('platform:promo',1000,'EUR','credit','property_promo',p_stripe_event_id,promo.id,'stripe_test','stripe:'||p_stripe_event_id||':property_promo')
 ON CONFLICT(stripe_event_id,purpose) DO NOTHING RETURNING id INTO ledger_id;
 UPDATE app.stripe_events SET rejected=false,processed_at=clock_timestamp() WHERE event_id=p_stripe_event_id;
 PERFORM app.audit('promo.stripe_completed',promo.id,jsonb_build_object('property_id',promo.property_id,'session_id',p_session_id));
 RETURN jsonb_build_object('status','ok','promo',to_jsonb(promo),'ledger_id',ledger_id);
END $$;

CREATE OR REPLACE FUNCTION public.get_workspace() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=auth.uid(); BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 RETURN jsonb_build_object(
 'profile',(SELECT to_jsonb(p) FROM app.profiles p WHERE id=u),
 'properties',coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM app.properties p WHERE owner_id=u),'[]'::jsonb),
 'listings',coalesce((SELECT jsonb_agg(app.listing_json(l.id)) FROM app.listings l WHERE owner_id=u),'[]'::jsonb),
 'property_promos',coalesce((SELECT jsonb_agg(to_jsonb(pp) ORDER BY pp.created_at DESC) FROM app.property_promos pp WHERE owner_id=u),'[]'::jsonb),
 'auctions',coalesce((SELECT jsonb_agg(to_jsonb(a)) FROM app.auctions a WHERE owner_id=u OR EXISTS(SELECT 1 FROM app.bids b WHERE b.auction_id=a.id AND b.bidder_id=u) OR EXISTS(SELECT 1 FROM app.auction_members m WHERE m.auction_id=a.id AND m.user_id=u)),'[]'::jsonb),
 'bids',coalesce((SELECT jsonb_agg(to_jsonb(b)) FROM app.bids b JOIN app.auctions a ON a.id=b.auction_id WHERE b.bidder_id=u OR a.owner_id=u),'[]'::jsonb),
 'reservations',coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM app.reservations r WHERE owner_id=u OR buyer_id=u),'[]'::jsonb),
 'conversations',coalesce((SELECT jsonb_agg(to_jsonb(c)) FROM app.conversations c WHERE owner_id=u OR buyer_id=u),'[]'::jsonb),
 'messages',coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.created_at) FROM app.messages m JOIN app.conversations c ON c.id=m.conversation_id WHERE c.owner_id=u OR c.buyer_id=u),'[]'::jsonb),
 'viewings',coalesce((SELECT jsonb_agg(to_jsonb(v)) FROM app.viewings v WHERE owner_id=u OR buyer_id=u),'[]'::jsonb),
 'favorites',coalesce((SELECT jsonb_agg(listing_id) FROM app.favorites WHERE user_id=u),'[]'::jsonb));
END $$;

REVOKE EXECUTE ON FUNCTION public.prepare_property_promo(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_property_promo(uuid,uuid,uuid,text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.attach_promo_checkout_session(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.attach_promo_checkout_session(uuid,uuid,text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.complete_mock_property_promo(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_mock_property_promo(uuid,uuid,uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.complete_promo_stripe_checkout(text,text,boolean,text,text,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_promo_stripe_checkout(text,text,boolean,text,text,uuid,uuid) TO service_role;

DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_available_extensions WHERE name='pg_cron') THEN
 BEGIN PERFORM cron.schedule('marketplace-expire-promos','*/5 * * * *','SELECT public.expire_property_promos()');
 EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Enable pg_cron and schedule expire_property_promos(): %',SQLERRM; END;
 END IF; END $$;

DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['stripe_events','property_promos','ledger_entries'] LOOP EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY',t); END LOOP; END $$;