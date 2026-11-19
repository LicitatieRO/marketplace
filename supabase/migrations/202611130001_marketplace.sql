-- Authoritative marketplace state. All client access goes through fixed-path RPCs.
CREATE SCHEMA IF NOT EXISTS app;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
REVOKE ALL ON SCHEMA app FROM PUBLIC,anon,authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA app REVOKE ALL ON TABLES FROM PUBLIC,anon,authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA app REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
CREATE TABLE app.profiles(id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,display_name text NOT NULL DEFAULT '',is_staff boolean NOT NULL DEFAULT false);
CREATE TABLE app.properties(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id uuid NOT NULL REFERENCES app.profiles(id),
 title text NOT NULL CHECK(length(title) BETWEEN 3 AND 160),description text NOT NULL CHECK(length(description)<=5000),
 neighborhood text NOT NULL CHECK(length(neighborhood) BETWEEN 2 AND 100),exact_address text NOT NULL CHECK(length(exact_address) BETWEEN 3 AND 300),
 property_type text NOT NULL CHECK(property_type IN ('apartment','house','studio','land','commercial')),
 area_sqm integer NOT NULL CHECK(area_sqm BETWEEN 1 AND 100000),rooms integer NOT NULL CHECK(rooms BETWEEN 0 AND 100),
 floor integer NOT NULL CHECK(floor BETWEEN -5 AND 200),built_year integer NOT NULL CHECK(built_year BETWEEN 1600 AND 2100),
 image_urls text[] NOT NULL DEFAULT '{}',tenancy_status text NOT NULL DEFAULT 'vacant' CHECK(tenancy_status IN ('vacant','occupied')),created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE app.listings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),property_id uuid NOT NULL REFERENCES app.properties(id),owner_id uuid NOT NULL REFERENCES app.profiles(id),transaction_type text NOT NULL CHECK(transaction_type IN ('sale','rent')),price_minor bigint NOT NULL CHECK(price_minor>0 AND price_minor<=1000000000000),currency text NOT NULL DEFAULT 'EUR' CHECK(currency='EUR'),status text NOT NULL DEFAULT 'published' CHECK(status IN ('published','closed')),auction_id uuid,UNIQUE(property_id,transaction_type));
CREATE TABLE app.auctions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),property_id uuid NOT NULL REFERENCES app.properties(id),listing_id uuid NOT NULL REFERENCES app.listings(id),owner_id uuid NOT NULL REFERENCES app.profiles(id),mode text NOT NULL CHECK(mode IN ('ascending','sealed')),access text NOT NULL CHECK(access IN ('public','invite')),starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,status text NOT NULL CHECK(status IN ('scheduled','active','closed')),starting_price_minor bigint CHECK(starting_price_minor>0),min_increment_minor bigint NOT NULL CHECK(min_increment_minor>0),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),CHECK(ends_at>starts_at));
CREATE UNIQUE INDEX one_active_auction_per_property ON app.auctions(property_id) WHERE status IN ('scheduled','active');
ALTER TABLE app.listings ADD CONSTRAINT listings_auction_fk FOREIGN KEY(auction_id) REFERENCES app.auctions(id);
CREATE TABLE app.auction_members(auction_id uuid NOT NULL REFERENCES app.auctions(id),user_id uuid NOT NULL REFERENCES app.profiles(id),invited_by uuid NOT NULL REFERENCES app.profiles(id),PRIMARY KEY(auction_id,user_id));
CREATE TABLE app.bids(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),auction_id uuid NOT NULL REFERENCES app.auctions(id),bidder_id uuid NOT NULL REFERENCES app.profiles(id),amount_minor bigint NOT NULL CHECK(amount_minor>0 AND amount_minor<=1000000000000),idempotency_key uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(bidder_id,idempotency_key));
CREATE INDEX bids_rank ON app.bids(auction_id,amount_minor DESC,created_at,id);
CREATE TABLE app.reservations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),property_id uuid NOT NULL REFERENCES app.properties(id),listing_id uuid NOT NULL REFERENCES app.listings(id),bid_id uuid NOT NULL REFERENCES app.bids(id),owner_id uuid NOT NULL REFERENCES app.profiles(id),buyer_id uuid NOT NULL REFERENCES app.profiles(id),deposit_minor bigint NOT NULL CHECK(deposit_minor>0 AND deposit_minor<=1000000000000),deposit_status text NOT NULL DEFAULT 'pending' CHECK(deposit_status IN ('pending','funded','refunded','released')),status text NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','funded','cancelled','expired','signed')),owner_signed_at timestamptz,buyer_signed_at timestamptz,expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '48 hours',created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE UNIQUE INDEX one_active_reservation_per_property ON app.reservations(property_id) WHERE status IN ('requested','funded');
CREATE TABLE app.conversations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),listing_id uuid NOT NULL REFERENCES app.listings(id),owner_id uuid NOT NULL REFERENCES app.profiles(id),buyer_id uuid NOT NULL REFERENCES app.profiles(id),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(listing_id,buyer_id),CHECK(owner_id<>buyer_id));
CREATE TABLE app.conversation_members(conversation_id uuid NOT NULL REFERENCES app.conversations(id),user_id uuid NOT NULL REFERENCES app.profiles(id),PRIMARY KEY(conversation_id,user_id));
CREATE TABLE app.messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),conversation_id uuid NOT NULL REFERENCES app.conversations(id),sender_id uuid NOT NULL REFERENCES app.profiles(id),body text NOT NULL CHECK(length(body) BETWEEN 1 AND 3000),created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE app.viewings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),listing_id uuid NOT NULL REFERENCES app.listings(id),owner_id uuid NOT NULL REFERENCES app.profiles(id),buyer_id uuid NOT NULL REFERENCES app.profiles(id),requested_at timestamptz NOT NULL,message text NOT NULL CHECK(length(message)<=2000),status text NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','confirmed','cancelled')),created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE app.favorites(user_id uuid NOT NULL REFERENCES app.profiles(id),listing_id uuid NOT NULL REFERENCES app.listings(id),PRIMARY KEY(user_id,listing_id));
CREATE TABLE app.audit_events(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,actor_id uuid,event text NOT NULL,entity_id uuid,payload jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE app.notification_outbox(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,user_id uuid NOT NULL REFERENCES app.profiles(id),event text NOT NULL,entity_id uuid,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),delivered_at timestamptz);
CREATE TABLE app.idempotency(actor_id uuid NOT NULL REFERENCES app.profiles(id),key uuid NOT NULL,operation text NOT NULL,payload jsonb NOT NULL,response jsonb NOT NULL,PRIMARY KEY(actor_id,key));
CREATE FUNCTION app.new_profile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN INSERT INTO app.profiles(id,display_name) VALUES(NEW.id,left(coalesce(NEW.raw_user_meta_data->>'display_name',''),100)) ON CONFLICT DO NOTHING; RETURN NEW; END $$;
CREATE TRIGGER marketplace_profile AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION app.new_profile();
INSERT INTO app.profiles(id,display_name) SELECT id,left(coalesce(raw_user_meta_data->>'display_name',''),100) FROM auth.users ON CONFLICT DO NOTHING;
CREATE FUNCTION app.require_user() RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=auth.uid(); BEGIN IF u IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=u AND email_confirmed_at IS NOT NULL) THEN RAISE EXCEPTION 'Verified email required'; END IF; PERFORM 1 FROM app.profiles WHERE id=u FOR NO KEY UPDATE; RETURN u; END $$;
CREATE FUNCTION app.require_staff() RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=app.require_user(); BEGIN IF NOT EXISTS(SELECT 1 FROM app.profiles WHERE id=u AND is_staff) OR auth.jwt()->>'aal' IS DISTINCT FROM 'aal2' THEN RAISE EXCEPTION 'Staff MFA required'; END IF; RETURN u; END $$;
CREATE FUNCTION app.audit(p_event text,p_entity uuid,p_payload jsonb DEFAULT '{}') RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ INSERT INTO app.audit_events(actor_id,event,entity_id,payload) VALUES(auth.uid(),p_event,p_entity,p_payload) $$;
CREATE FUNCTION app.replay(p_actor uuid,p_key uuid,p_operation text,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE r app.idempotency; BEGIN IF p_key IS NULL THEN RAISE EXCEPTION 'Idempotency key required'; END IF; SELECT * INTO r FROM app.idempotency WHERE actor_id=p_actor AND key=p_key; IF FOUND THEN IF r.operation<>p_operation OR r.payload<>p_payload THEN RAISE EXCEPTION 'Idempotency key payload mismatch'; END IF; RETURN r.response; END IF; RETURN NULL; END $$;
CREATE FUNCTION app.remember(p_actor uuid,p_key uuid,p_operation text,p_payload jsonb,p_response jsonb) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ INSERT INTO app.idempotency VALUES(p_actor,p_key,p_operation,p_payload,p_response) $$;
CREATE FUNCTION app.expire_property(p_property uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE r app.reservations; a app.auctions; BEGIN
 FOR a IN UPDATE app.auctions SET status='closed' WHERE property_id=p_property AND status IN ('scheduled','active') AND ends_at<=clock_timestamp() RETURNING * LOOP PERFORM app.audit('auction.closed',a.id); INSERT INTO app.notification_outbox(user_id,event,entity_id) VALUES(a.owner_id,'auction.closed',a.id); END LOOP;
 FOR r IN UPDATE app.reservations SET status='expired',deposit_status=CASE WHEN deposit_status='funded' THEN 'refunded' ELSE deposit_status END WHERE property_id=p_property AND status IN ('requested','funded') AND expires_at<=clock_timestamp() RETURNING * LOOP PERFORM app.audit('reservation.expired',r.id); INSERT INTO app.notification_outbox(user_id,event,entity_id) VALUES(r.buyer_id,'reservation.expired',r.id); END LOOP;
END $$;
-- Defense in depth: tables are private, row policies also constrain any later selective grants.
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['profiles','properties','listings','auctions','auction_members','bids','reservations','conversations','conversation_members','messages','viewings','favorites','audit_events','notification_outbox','idempotency'] LOOP EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY',t); END LOOP; END $$;
CREATE POLICY own_profile ON app.profiles FOR SELECT TO authenticated USING(id=auth.uid());
CREATE POLICY own_property ON app.properties FOR SELECT TO authenticated USING(owner_id=auth.uid());
CREATE POLICY own_bid ON app.bids FOR SELECT TO authenticated USING(bidder_id=auth.uid() OR EXISTS(SELECT 1 FROM app.auctions a WHERE a.id=auction_id AND a.owner_id=auth.uid()));
CREATE POLICY own_reservation ON app.reservations FOR SELECT TO authenticated USING(owner_id=auth.uid() OR buyer_id=auth.uid());
CREATE POLICY own_conversation ON app.conversations FOR SELECT TO authenticated USING(owner_id=auth.uid() OR buyer_id=auth.uid());
CREATE POLICY own_viewing ON app.viewings FOR SELECT TO authenticated USING(owner_id=auth.uid() OR buyer_id=auth.uid());
CREATE POLICY own_favorite ON app.favorites FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE FUNCTION public.create_property(p_title text,p_description text,p_neighborhood text,p_exact_address text,p_property_type text,p_area_sqm integer,p_rooms integer,p_floor integer,p_built_year integer,p_sale_price_minor bigint DEFAULT NULL,p_rent_price_minor bigint DEFAULT NULL,p_image_urls text[] DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=app.require_user(); p app.properties; BEGIN
 IF coalesce(p_sale_price_minor,0)<=0 AND coalesce(p_rent_price_minor,0)<=0 THEN RAISE EXCEPTION 'At least one positive price required'; END IF;
 IF (p_sale_price_minor IS NOT NULL AND p_sale_price_minor<=0) OR (p_rent_price_minor IS NOT NULL AND p_rent_price_minor<=0) THEN RAISE EXCEPTION 'Prices must be positive'; END IF;
 IF cardinality(p_image_urls)>12 OR EXISTS(SELECT 1 FROM unnest(p_image_urls) x WHERE x IS NULL OR (x !~ '^https://(images[.]unsplash[.]com|images[.]pexels[.]com)/[^[:space:]]+$' AND x !~ ('^https://[a-z0-9-]+[.]supabase[.]co/storage/v1/object/public/listing-media/'||u::text||'/[a-zA-Z0-9._/-]+$') AND x !~ ('^http://(127[.]0[.]0[.]1|localhost):54321/storage/v1/object/public/listing-media/'||u::text||'/[a-zA-Z0-9._/-]+$'))) THEN RAISE EXCEPTION 'Unsupported image URL'; END IF;
 INSERT INTO app.properties(owner_id,title,description,neighborhood,exact_address,property_type,area_sqm,rooms,floor,built_year,image_urls) VALUES(u,trim(p_title),p_description,trim(p_neighborhood),trim(p_exact_address),p_property_type,p_area_sqm,p_rooms,p_floor,p_built_year,coalesce(p_image_urls,'{}')) RETURNING * INTO p;
 IF p_sale_price_minor IS NOT NULL THEN INSERT INTO app.listings(property_id,owner_id,transaction_type,price_minor) VALUES(p.id,u,'sale',p_sale_price_minor); END IF;
 IF p_rent_price_minor IS NOT NULL THEN INSERT INTO app.listings(property_id,owner_id,transaction_type,price_minor) VALUES(p.id,u,'rent',p_rent_price_minor); END IF;
 PERFORM app.audit('property.created',p.id); RETURN to_jsonb(p);
END $$;
CREATE FUNCTION public.start_auction(p_listing_id uuid,p_mode text,p_access text,p_starts_at timestamptz,p_ends_at timestamptz,p_starting_price_minor bigint,p_min_increment_minor bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=app.require_user(); l app.listings; p app.properties; a app.auctions; t timestamptz; BEGIN
 SELECT * INTO l FROM app.listings WHERE id=p_listing_id; IF NOT FOUND OR l.owner_id<>u THEN RAISE EXCEPTION 'Owner required'; END IF;
 SELECT * INTO p FROM app.properties WHERE id=l.property_id FOR UPDATE; IF p.owner_id<>u THEN RAISE EXCEPTION 'Owner required'; END IF;
 SELECT * INTO l FROM app.listings WHERE id=p_listing_id;
 PERFORM app.expire_property(p.id); t:=clock_timestamp();
 IF EXISTS(SELECT 1 FROM app.reservations WHERE property_id=p.id AND status IN ('requested','funded')) THEN RAISE EXCEPTION 'Property is reserved'; END IF;
 IF EXISTS(SELECT 1 FROM app.auctions WHERE property_id=p.id AND status IN ('scheduled','active')) THEN RAISE EXCEPTION 'Property already has an active auction'; END IF;
 IF l.status<>'published' THEN RAISE EXCEPTION 'Listing is closed'; END IF;
 IF p_mode IS NULL OR p_mode NOT IN ('ascending','sealed') OR p_access IS NULL OR p_access NOT IN ('public','invite') OR p_ends_at IS NULL OR p_starts_at IS NULL OR p_ends_at<=t OR p_ends_at<=p_starts_at OR p_ends_at>t+interval '90 days' OR p_min_increment_minor IS NULL OR p_min_increment_minor<=0 OR p_min_increment_minor>1000000000000 OR (p_starting_price_minor IS NOT NULL AND (p_starting_price_minor<=0 OR p_starting_price_minor>1000000000000)) THEN RAISE EXCEPTION 'Invalid auction parameters'; END IF;
 INSERT INTO app.auctions(property_id,listing_id,owner_id,mode,access,starts_at,ends_at,status,starting_price_minor,min_increment_minor) VALUES(p.id,l.id,u,p_mode,p_access,p_starts_at,p_ends_at,CASE WHEN p_starts_at>t THEN 'scheduled' ELSE 'active' END,p_starting_price_minor,p_min_increment_minor) RETURNING * INTO a;
 UPDATE app.listings SET auction_id=a.id WHERE id=l.id; PERFORM app.audit('auction.started',a.id); RETURN to_jsonb(a);
END $$;
CREATE FUNCTION public.place_bid(p_auction_id uuid,p_amount_minor bigint,p_idempotency_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=app.require_user(); a app.auctions; b app.bids; pid uuid; r jsonb; payload jsonb:=jsonb_build_object('auction',p_auction_id,'amount',p_amount_minor); minimum bigint; t timestamptz; BEGIN
 SELECT property_id INTO pid FROM app.auctions WHERE id=p_auction_id; IF NOT FOUND THEN RAISE EXCEPTION 'Auction not found'; END IF;
 PERFORM 1 FROM app.properties WHERE id=pid FOR UPDATE; SELECT * INTO a FROM app.auctions WHERE id=p_auction_id FOR UPDATE;
 IF a.owner_id=u THEN RAISE EXCEPTION 'Owner cannot bid'; END IF;
 IF a.access='invite' AND NOT EXISTS(SELECT 1 FROM app.auction_members WHERE auction_id=a.id AND user_id=u) THEN RAISE EXCEPTION 'Invitation required'; END IF;
 r:=app.replay(u,p_idempotency_key,'bid',payload); IF r IS NOT NULL THEN RETURN r; END IF;
 PERFORM app.expire_property(pid); t:=clock_timestamp();
 IF a.status NOT IN ('scheduled','active') OR t<a.starts_at OR t>=a.ends_at THEN RAISE EXCEPTION 'Auction is not accepting bids'; END IF;
 IF EXISTS(SELECT 1 FROM app.reservations WHERE property_id=pid AND status IN ('requested','funded')) THEN RAISE EXCEPTION 'Property is reserved'; END IF;
 IF p_amount_minor IS NULL OR p_amount_minor<=0 OR p_amount_minor>1000000000000 THEN RAISE EXCEPTION 'Invalid bid amount'; END IF;
 IF a.mode='ascending' THEN SELECT greatest(coalesce(a.starting_price_minor,1),coalesce(max(amount_minor)+a.min_increment_minor,1)) INTO minimum FROM app.bids WHERE auction_id=a.id; IF p_amount_minor<minimum THEN RAISE EXCEPTION 'Bid below minimum'; END IF; END IF;
 IF (SELECT count(*) FROM app.bids WHERE bidder_id=u AND created_at>clock_timestamp()-interval '1 minute')>=30 THEN RAISE EXCEPTION 'Bid rate limit exceeded'; END IF;
 INSERT INTO app.bids(auction_id,bidder_id,amount_minor,idempotency_key) VALUES(a.id,u,p_amount_minor,p_idempotency_key) RETURNING * INTO b;
 UPDATE app.auctions SET status='active' WHERE id=a.id; r:=to_jsonb(b); PERFORM app.remember(u,p_idempotency_key,'bid',payload,r); PERFORM app.audit('bid.placed',b.id,jsonb_build_object('auction_id',a.id)); INSERT INTO app.notification_outbox(user_id,event,entity_id) VALUES(a.owner_id,'bid.placed',a.id); RETURN r;
END $$;
CREATE FUNCTION public.invite_bidder(p_auction_id uuid,p_email text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=app.require_user(); a app.auctions; target uuid; BEGIN
 SELECT * INTO a FROM app.auctions WHERE id=p_auction_id; IF NOT FOUND OR a.owner_id<>u THEN RAISE EXCEPTION 'Owner required'; END IF;
 SELECT id INTO target FROM auth.users WHERE lower(email)=lower(trim(p_email)) AND email_confirmed_at IS NOT NULL; IF target IS NULL OR target=u THEN RAISE EXCEPTION 'Verified bidder account required'; END IF;
 INSERT INTO app.auction_members VALUES(a.id,target,u) ON CONFLICT DO NOTHING; PERFORM app.audit('auction.invited',a.id); INSERT INTO app.notification_outbox(user_id,event,entity_id) VALUES(target,'auction.invited',a.id); RETURN jsonb_build_object('auction_id',a.id,'user_id',target);
END $$;
CREATE FUNCTION public.request_reservation(p_bid_id uuid,p_deposit_minor bigint,p_idempotency_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=app.require_user(); b app.bids; a app.auctions; r app.reservations; response jsonb; payload jsonb:=jsonb_build_object('bid',p_bid_id,'deposit',p_deposit_minor); BEGIN
 SELECT * INTO b FROM app.bids WHERE id=p_bid_id; IF NOT FOUND THEN RAISE EXCEPTION 'Bid not found'; END IF;
 SELECT * INTO a FROM app.auctions WHERE id=b.auction_id; PERFORM 1 FROM app.properties WHERE id=a.property_id FOR UPDATE; SELECT * INTO a FROM app.auctions WHERE id=b.auction_id FOR UPDATE;
 IF a.owner_id<>u THEN RAISE EXCEPTION 'Owner required'; END IF;
 response:=app.replay(u,p_idempotency_key,'reserve',payload); IF response IS NOT NULL THEN RETURN response; END IF;
 PERFORM app.expire_property(a.property_id);
 IF clock_timestamp()<a.ends_at THEN RAISE EXCEPTION 'Auction must expire first'; END IF;
 IF EXISTS(SELECT 1 FROM app.listings WHERE id=a.listing_id AND (status<>'published' OR auction_id IS DISTINCT FROM a.id)) THEN RAISE EXCEPTION 'Listing is closed'; END IF;
 IF EXISTS(SELECT 1 FROM app.auctions WHERE property_id=a.property_id AND status IN ('scheduled','active')) THEN RAISE EXCEPTION 'Property already has an active auction'; END IF;
 IF EXISTS(SELECT 1 FROM app.reservations WHERE property_id=a.property_id AND status IN ('requested','funded')) THEN RAISE EXCEPTION 'Property is reserved'; END IF;
 IF a.mode='ascending' AND b.id IS DISTINCT FROM (SELECT id FROM app.bids WHERE auction_id=a.id ORDER BY amount_minor DESC,created_at,id LIMIT 1) THEN RAISE EXCEPTION 'Highest bidder required'; END IF;
 IF p_deposit_minor IS NULL OR p_deposit_minor<=0 OR p_deposit_minor>b.amount_minor THEN RAISE EXCEPTION 'Invalid simulated deposit'; END IF;
 INSERT INTO app.reservations(property_id,listing_id,bid_id,owner_id,buyer_id,deposit_minor) VALUES(a.property_id,a.listing_id,b.id,u,b.bidder_id,p_deposit_minor) RETURNING * INTO r;
 response:=to_jsonb(r); PERFORM app.remember(u,p_idempotency_key,'reserve',payload,response); PERFORM app.audit('reservation.requested',r.id); INSERT INTO app.notification_outbox(user_id,event,entity_id) VALUES(r.buyer_id,'reservation.requested',r.id); RETURN response;
END $$;
CREATE FUNCTION public.advance_reservation(p_reservation_id uuid,p_action text,p_idempotency_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=app.require_user(); r app.reservations; l app.listings; response jsonb; payload jsonb:=jsonb_build_object('reservation',p_reservation_id,'action',p_action); BEGIN
 SELECT * INTO r FROM app.reservations WHERE id=p_reservation_id; IF NOT FOUND THEN RAISE EXCEPTION 'Reservation not found'; END IF;
 PERFORM 1 FROM app.properties WHERE id=r.property_id FOR UPDATE; SELECT * INTO r FROM app.reservations WHERE id=p_reservation_id FOR UPDATE;
 IF u NOT IN (r.owner_id,r.buyer_id) THEN RAISE EXCEPTION 'Reservation party required'; END IF;
 response:=app.replay(u,p_idempotency_key,'advance',payload); IF response IS NOT NULL THEN RETURN response; END IF;
 PERFORM app.expire_property(r.property_id); SELECT * INTO r FROM app.reservations WHERE id=p_reservation_id;
 IF r.status NOT IN ('requested','funded') THEN RAISE EXCEPTION 'Reservation is finalized'; END IF;
 IF p_action='fund' THEN
  IF u<>r.buyer_id OR r.status<>'requested' THEN RAISE EXCEPTION 'Applicant funding required'; END IF;
  UPDATE app.reservations SET status='funded',deposit_status='funded' WHERE id=r.id;
 ELSIF p_action='cancel' THEN UPDATE app.reservations SET status='cancelled',deposit_status=CASE WHEN deposit_status='funded' THEN 'refunded' ELSE 'pending' END WHERE id=r.id;
 ELSIF p_action='sign' THEN
  IF r.status<>'funded' THEN RAISE EXCEPTION 'Fund simulation before signing'; END IF;
  UPDATE app.reservations SET owner_signed_at=CASE WHEN u=owner_id THEN coalesce(owner_signed_at,clock_timestamp()) ELSE owner_signed_at END,buyer_signed_at=CASE WHEN u=buyer_id THEN coalesce(buyer_signed_at,clock_timestamp()) ELSE buyer_signed_at END WHERE id=r.id RETURNING * INTO r;
  IF r.owner_signed_at IS NOT NULL AND r.buyer_signed_at IS NOT NULL THEN
   UPDATE app.reservations SET status='signed',deposit_status='released' WHERE id=r.id;
   SELECT * INTO l FROM app.listings WHERE id=r.listing_id;
   IF l.transaction_type='sale' THEN UPDATE app.listings SET status='closed' WHERE property_id=r.property_id AND owner_id=r.owner_id;
   ELSE UPDATE app.listings SET status='closed' WHERE id=r.listing_id; UPDATE app.properties SET tenancy_status='occupied' WHERE id=r.property_id; END IF;
  END IF;
 ELSE RAISE EXCEPTION 'Invalid reservation action'; END IF;
 SELECT to_jsonb(x) INTO response FROM app.reservations x WHERE id=r.id;
 PERFORM app.remember(u,p_idempotency_key,'advance',payload,response); PERFORM app.audit('reservation.'||p_action,r.id); INSERT INTO app.notification_outbox(user_id,event,entity_id) VALUES(CASE WHEN u=r.owner_id THEN r.buyer_id ELSE r.owner_id END,'reservation.'||p_action,r.id); RETURN response;
END $$;
CREATE FUNCTION public.request_viewing(p_listing_id uuid,p_requested_at timestamptz,p_message text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=app.require_user(); l app.listings; v app.viewings; BEGIN
 SELECT * INTO l FROM app.listings WHERE id=p_listing_id; IF NOT FOUND OR l.status<>'published' OR l.owner_id=u THEN RAISE EXCEPTION 'Available listing required'; END IF;
 IF p_requested_at IS NULL OR p_requested_at<=clock_timestamp() OR p_requested_at>clock_timestamp()+interval '90 days' THEN RAISE EXCEPTION 'Future viewing required'; END IF;
 IF (SELECT count(*) FROM app.viewings WHERE buyer_id=u AND created_at>clock_timestamp()-interval '1 day')>=10 THEN RAISE EXCEPTION 'Viewing rate limit exceeded'; END IF;
 INSERT INTO app.viewings(listing_id,owner_id,buyer_id,requested_at,message) VALUES(l.id,l.owner_id,u,p_requested_at,coalesce(p_message,'')) RETURNING * INTO v; PERFORM app.audit('viewing.requested',v.id); INSERT INTO app.notification_outbox(user_id,event,entity_id) VALUES(l.owner_id,'viewing.requested',v.id); RETURN to_jsonb(v);
END $$;
CREATE FUNCTION public.update_viewing(p_viewing_id uuid,p_status text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=app.require_user(); v app.viewings; BEGIN
 SELECT * INTO v FROM app.viewings WHERE id=p_viewing_id FOR UPDATE;
 IF NOT FOUND OR u NOT IN (v.owner_id,v.buyer_id) THEN RAISE EXCEPTION 'Viewing party required'; END IF;
 IF p_status='confirmed' AND u=v.owner_id AND v.status='requested' THEN NULL;
 ELSIF p_status='cancelled' AND v.status IN ('requested','confirmed') THEN NULL;
 ELSE RAISE EXCEPTION 'Invalid viewing transition'; END IF;
 UPDATE app.viewings SET status=p_status WHERE id=v.id RETURNING * INTO v; PERFORM app.audit('viewing.'||p_status,v.id); RETURN to_jsonb(v);
END $$;
CREATE FUNCTION public.send_message(p_listing_id uuid,p_body text,p_conversation_id uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=app.require_user(); l app.listings; c app.conversations; m app.messages; BEGIN
 IF p_body IS NULL OR length(trim(p_body)) NOT BETWEEN 1 AND 3000 THEN RAISE EXCEPTION 'Message length must be 1 to 3000'; END IF;
 IF (SELECT count(*) FROM app.messages WHERE sender_id=u AND created_at>clock_timestamp()-interval '1 minute')>=20 THEN RAISE EXCEPTION 'Message rate limit exceeded'; END IF;
 IF p_conversation_id IS NOT NULL THEN SELECT * INTO c FROM app.conversations WHERE id=p_conversation_id; IF NOT FOUND OR c.listing_id<>p_listing_id OR u NOT IN (c.owner_id,c.buyer_id) THEN RAISE EXCEPTION 'Conversation party required'; END IF;
 ELSE
  SELECT * INTO l FROM app.listings WHERE id=p_listing_id; IF NOT FOUND OR l.owner_id=u THEN RAISE EXCEPTION 'Buyer inquiry required'; END IF;
  INSERT INTO app.conversations(listing_id,owner_id,buyer_id) VALUES(l.id,l.owner_id,u) ON CONFLICT(listing_id,buyer_id) DO UPDATE SET listing_id=excluded.listing_id RETURNING * INTO c;
  INSERT INTO app.conversation_members VALUES(c.id,c.owner_id),(c.id,c.buyer_id) ON CONFLICT DO NOTHING;
 END IF;
 INSERT INTO app.messages(conversation_id,sender_id,body) VALUES(c.id,u,trim(p_body)) RETURNING * INTO m; PERFORM app.audit('message.sent',m.id); INSERT INTO app.notification_outbox(user_id,event,entity_id) VALUES(CASE WHEN u=c.owner_id THEN c.buyer_id ELSE c.owner_id END,'message.received',c.id); RETURN to_jsonb(m);
END $$;
CREATE FUNCTION public.set_favorite(p_listing_id uuid,p_saved boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=app.require_user(); BEGIN
 IF NOT EXISTS(SELECT 1 FROM app.listings WHERE id=p_listing_id) THEN RAISE EXCEPTION 'Listing not found'; END IF;
 IF p_saved IS NULL THEN RAISE EXCEPTION 'Saved boolean required'; END IF;
 IF p_saved THEN INSERT INTO app.favorites VALUES(u,p_listing_id) ON CONFLICT DO NOTHING; ELSE DELETE FROM app.favorites WHERE user_id=u AND listing_id=p_listing_id; END IF;
 RETURN jsonb_build_object('listing_id',p_listing_id,'saved',p_saved);
END $$;
CREATE FUNCTION app.listing_json(p_listing_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object(
 'id',l.id,'property_id',p.id,'owner_id',l.owner_id,'title',p.title,'description',p.description,'neighborhood',p.neighborhood,'property_type',p.property_type,
 'transaction_type',l.transaction_type,'price_minor',l.price_minor,'currency',l.currency,'area_sqm',p.area_sqm,'rooms',p.rooms,'floor',p.floor,'built_year',p.built_year,'image_urls',p.image_urls,'tenancy_status',p.tenancy_status,'status',l.status,
 'auction_id',a.id,'auction_mode',a.mode,'auction_access',a.access,
 'ends_at',CASE WHEN eligible.yes THEN a.ends_at END,'starts_at',CASE WHEN eligible.yes THEN a.starts_at END,
 'current_bid_minor',CASE WHEN eligible.yes AND a.mode='ascending' THEN (SELECT max(amount_minor) FROM app.bids WHERE auction_id=a.id) END,
 'bid_count',CASE WHEN eligible.yes THEN (SELECT count(*) FROM app.bids WHERE auction_id=a.id) ELSE 0 END,
 'min_increment_minor',CASE WHEN eligible.yes THEN a.min_increment_minor END,'starting_price_minor',CASE WHEN eligible.yes THEN a.starting_price_minor END)
 FROM app.listings l JOIN app.properties p ON p.id=l.property_id LEFT JOIN app.auctions a ON a.id=l.auction_id
 CROSS JOIN LATERAL(SELECT a.access='public' OR a.owner_id=auth.uid() OR EXISTS(SELECT 1 FROM app.auction_members m WHERE m.auction_id=a.id AND m.user_id=auth.uid()) AS yes) eligible
 WHERE l.id=p_listing_id
$$;
CREATE FUNCTION public.get_catalogue() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT coalesce(jsonb_agg(app.listing_json(id) ORDER BY id),'[]'::jsonb) FROM app.listings WHERE status='published' $$;
CREATE FUNCTION public.get_listing(p_listing_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT app.listing_json(p_listing_id) $$;
CREATE FUNCTION public.get_workspace() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=auth.uid(); BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 RETURN jsonb_build_object(
 'profile',(SELECT to_jsonb(p) FROM app.profiles p WHERE id=u),
 'properties',coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM app.properties p WHERE owner_id=u),'[]'::jsonb),
 'listings',coalesce((SELECT jsonb_agg(app.listing_json(l.id)) FROM app.listings l WHERE owner_id=u),'[]'::jsonb),
 'auctions',coalesce((SELECT jsonb_agg(to_jsonb(a)) FROM app.auctions a WHERE owner_id=u OR EXISTS(SELECT 1 FROM app.bids b WHERE b.auction_id=a.id AND b.bidder_id=u) OR EXISTS(SELECT 1 FROM app.auction_members m WHERE m.auction_id=a.id AND m.user_id=u)),'[]'::jsonb),
 'bids',coalesce((SELECT jsonb_agg(to_jsonb(b)) FROM app.bids b JOIN app.auctions a ON a.id=b.auction_id WHERE b.bidder_id=u OR a.owner_id=u),'[]'::jsonb),
 'reservations',coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM app.reservations r WHERE owner_id=u OR buyer_id=u),'[]'::jsonb),
 'conversations',coalesce((SELECT jsonb_agg(to_jsonb(c)) FROM app.conversations c WHERE owner_id=u OR buyer_id=u),'[]'::jsonb),
 'messages',coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.created_at) FROM app.messages m JOIN app.conversations c ON c.id=m.conversation_id WHERE c.owner_id=u OR c.buyer_id=u),'[]'::jsonb),
 'viewings',coalesce((SELECT jsonb_agg(to_jsonb(v)) FROM app.viewings v WHERE owner_id=u OR buyer_id=u),'[]'::jsonb),
 'favorites',coalesce((SELECT jsonb_agg(listing_id) FROM app.favorites WHERE user_id=u),'[]'::jsonb));
END $$;
CREATE FUNCTION public.close_expired_auctions() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE pid uuid; BEGIN
 -- Same property-first order as every bidder/reservation writer; worker does not race requests.
 FOR pid IN SELECT p.id FROM app.properties p WHERE EXISTS(SELECT 1 FROM app.auctions a WHERE a.property_id=p.id AND a.status IN ('scheduled','active') AND a.ends_at<=clock_timestamp()) OR EXISTS(SELECT 1 FROM app.reservations r WHERE r.property_id=p.id AND r.status IN ('requested','funded') AND r.expires_at<=clock_timestamp()) ORDER BY p.id LOOP
  PERFORM 1 FROM app.properties WHERE id=pid FOR UPDATE; PERFORM app.expire_property(pid);
 END LOOP;
END $$;
-- Explicit allowlist. Helpers and worker never executable by client roles.
REVOKE ALL ON ALL TABLES IN SCHEMA app FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.get_catalogue(),public.get_listing(uuid),public.get_workspace(),public.close_expired_auctions() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_catalogue(),public.get_listing(uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_workspace() TO authenticated;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('create_property','start_auction','place_bid','invite_bidder','request_reservation','advance_reservation','request_viewing','update_viewing','send_message','set_favorite') LOOP EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC,anon,authenticated',r.signature); EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',r.signature); END LOOP; END $$;
-- pg_cron runs independently of web requests. Supabase enables pg_cron in local/cloud Postgres.
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_available_extensions WHERE name='pg_cron') THEN
 BEGIN CREATE EXTENSION IF NOT EXISTS pg_cron; PERFORM cron.schedule('marketplace-close-expired','* * * * *','SELECT public.close_expired_auctions()');
 EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Enable pg_cron and schedule close_expired_auctions(): %',SQLERRM; END;
 END IF; END $$;
