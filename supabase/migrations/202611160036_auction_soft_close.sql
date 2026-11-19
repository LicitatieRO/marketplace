-- Existing auctions keep their advertised fixed deadline. Only new ascending auctions opt in.
ALTER TABLE app.auctions ADD COLUMN soft_close_seconds integer NOT NULL DEFAULT 0;
ALTER TABLE app.auctions ADD COLUMN initial_ends_at timestamptz;
ALTER TABLE app.auctions ADD COLUMN max_ends_at timestamptz;
UPDATE app.auctions SET initial_ends_at=ends_at,max_ends_at=ends_at;
ALTER TABLE app.auctions ALTER COLUMN initial_ends_at SET NOT NULL;
ALTER TABLE app.auctions ALTER COLUMN max_ends_at SET NOT NULL;
ALTER TABLE app.auctions ALTER COLUMN soft_close_seconds SET DEFAULT 120;
ALTER TABLE app.auctions ADD CONSTRAINT auction_soft_close_window CHECK(soft_close_seconds BETWEEN 0 AND 600 AND (mode='ascending' OR soft_close_seconds=0));
ALTER TABLE app.auctions ADD CONSTRAINT auction_soft_close_cap CHECK(max_ends_at>=ends_at AND max_ends_at>=initial_ends_at AND max_ends_at<=initial_ends_at+interval '30 minutes');

CREATE FUNCTION app.initialize_auction_soft_close() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 NEW.initial_ends_at := NEW.ends_at;
 IF NEW.mode='sealed' THEN NEW.soft_close_seconds := 0; END IF;
 NEW.max_ends_at := NEW.ends_at + CASE WHEN NEW.soft_close_seconds>0 THEN interval '30 minutes' ELSE interval '0 seconds' END;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app.initialize_auction_soft_close() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER initialize_auction_soft_close BEFORE INSERT ON app.auctions
FOR EACH ROW EXECUTE FUNCTION app.initialize_auction_soft_close();

-- Preserve the existing property-first lock, authorization, replay and post-lock clock.
CREATE OR REPLACE FUNCTION public.place_bid(p_auction_id uuid,p_amount_minor bigint,p_idempotency_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u uuid:=app.require_user(); a app.auctions; b app.bids; pid uuid; r jsonb; payload jsonb:=jsonb_build_object('auction',p_auction_id,'amount',p_amount_minor); minimum bigint; t timestamptz; next_end timestamptz; BEGIN
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
 next_end := a.ends_at;
 IF a.mode='ascending' AND a.soft_close_seconds>0
    AND a.ends_at-t <= make_interval(secs=>a.soft_close_seconds) THEN
   next_end := least(a.max_ends_at,t+make_interval(secs=>a.soft_close_seconds));
 END IF;
 UPDATE app.auctions SET status='active',ends_at=next_end WHERE id=a.id;
 IF next_end>a.ends_at THEN
   PERFORM app.audit('auction.extended',a.id,jsonb_build_object('ends_at',next_end));
 END IF; r:=to_jsonb(b); PERFORM app.remember(u,p_idempotency_key,'bid',payload,r); PERFORM app.audit('bid.placed',b.id,jsonb_build_object('auction_id',a.id)); INSERT INTO app.notification_outbox(user_id,event,entity_id) VALUES(a.owner_id,'bid.placed',a.id); RETURN r;
END $$;

-- Extend the latest privacy-preserving listing payload additively.
CREATE OR REPLACE FUNCTION app.listing_json(p_listing_id uuid) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=''
AS $$
 SELECT jsonb_build_object(
 'id',l.id,'property_id',p.id,'title',p.title,'description',p.description,'neighborhood',p.neighborhood,
 'judet',p.judet,'property_type',p.property_type,
 'transaction_type',l.transaction_type,'price_minor',l.price_minor,'currency',l.currency,'area_sqm',p.area_sqm,'rooms',p.rooms,'floor',p.floor,'built_year',p.built_year,'image_urls',p.image_urls,'tenancy_status',p.tenancy_status,'status',l.status,'tour_url',p.tour_url,
 'lat',app.rounded_public_lat(p),
 'lng',app.rounded_public_lng(p),
 'promo_expires_at',app.active_promo_expires(p.id),
 'auction_id',a.id,'auction_mode',a.mode,'auction_access',a.access,
 'ends_at',CASE WHEN eligible.yes THEN a.ends_at END,'starts_at',CASE WHEN eligible.yes THEN a.starts_at END,
 'server_now',clock_timestamp(),
 'initial_ends_at',CASE WHEN eligible.yes THEN a.initial_ends_at END,
 'max_ends_at',CASE WHEN eligible.yes THEN a.max_ends_at END,
 'soft_close_seconds',CASE WHEN eligible.yes THEN a.soft_close_seconds END,
 'current_bid_minor',CASE WHEN eligible.yes AND a.mode='ascending' THEN (SELECT max(amount_minor) FROM app.bids WHERE auction_id=a.id) END,
 'bid_count',CASE WHEN eligible.yes THEN (SELECT count(*) FROM app.bids WHERE auction_id=a.id) ELSE 0 END,
 'min_increment_minor',CASE WHEN eligible.yes THEN a.min_increment_minor END,'starting_price_minor',CASE WHEN eligible.yes THEN a.starting_price_minor END)
 || CASE
  WHEN (SELECT auth.uid()) = l.owner_id OR (SELECT auth.role()) = 'service_role'
  THEN jsonb_build_object('owner_id', l.owner_id)
  ELSE '{}'::jsonb
 END
 FROM app.listings l JOIN app.properties p ON p.id=l.property_id LEFT JOIN app.auctions a ON a.id=l.auction_id
 CROSS JOIN LATERAL(SELECT a.access='public' OR a.owner_id=auth.uid() OR EXISTS(SELECT 1 FROM app.auction_members m WHERE m.auction_id=a.id AND m.user_id=auth.uid()) AS yes) eligible
 WHERE l.id=p_listing_id
$$;

-- Carry new bounds when the existing explicitly guarded demo-only seed refreshes its fixture.
CREATE OR REPLACE FUNCTION app.seed_demo_fixture()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  demo_owner uuid;
  demo_buyer uuid;
  demo_dual uuid;
  demo_properties uuid[] := ARRAY[
    '10000000-0000-4000-8000-000000000001'::uuid,
    '10000000-0000-4000-8000-000000000002'::uuid,
    '10000000-0000-4000-8000-000000000003'::uuid,
    '10000000-0000-4000-8000-000000000004'::uuid,
    '10000000-0000-4000-8000-000000000005'::uuid,
    '10000000-0000-4000-8000-000000000006'::uuid
  ];
  demo_auction uuid := '40000000-0000-4000-8000-000000000001';
  sale_listing uuid := '20000000-0000-4000-8000-000000000001'::uuid;
BEGIN
  IF current_setting('app.allow_demo_seed', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'demo seed requires app.allow_demo_seed=on';
  END IF;

  demo_owner := app.ensure_demo_auth_user(
    'owner@licitatiero.local',
    '11111111-1111-4111-8111-111111111111',
    'Alex · LicitatieRO'
  );
  demo_buyer := app.ensure_demo_auth_user(
    'buyer@licitatiero.local',
    '22222222-2222-4222-8222-222222222222',
    'Dana · Cumpărător (POC / Simulare)'
  );
  demo_dual := app.ensure_demo_auth_user(
    'dual@licitatiero.local',
    '44444444-4444-4444-8444-444444444444',
    'Mihai · Rol dublu (POC / Simulare)'
  );

  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'instance_id'
  ) THEN
    INSERT INTO auth.identities(id, provider_id, user_id, identity_data, provider, created_at, updated_at)
    SELECT
      gen_random_uuid(),
      u.id::text,
      u.id,
      jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
      'email',
      now(),
      now()
    FROM auth.users u
    WHERE u.id IN (demo_owner, demo_buyer, demo_dual)
    ON CONFLICT (provider_id, provider) DO NOTHING;
  END IF;

  INSERT INTO app.properties(
    id, owner_id, title, description, neighborhood, exact_address, property_type,
    area_sqm, rooms, floor, built_year, image_urls, lat, lng, judet
  )
  VALUES
    (
      demo_properties[1], demo_owner,
      'Apartament 2 camere, 58 mp, Floreasca, 2022, parcare subterană — licitație (POC / Simulare)',
      'Apartament cu 2 camere, 58 mp utili, într-un imobil finalizat în 2022 pe partea de parc a cartierului Floreasca (Sector 1, pin de simulare lângă Parcul Floreasca — nu este o adresă reală). Listare de simulare POC pentru LicitatieRO.',
      'Floreasca', 'Adresă demonstrativă privată 1', 'apartment', 58, 2, 5, 2022,
      ARRAY[
        'https://images.unsplash.com/photo-1600573472591-ee6b68d14c68?auto=format&fit=crop&w=1600&q=85',
        'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=85'
      ],
      44.46463, 26.09944, 'București'
    ),
    (
      demo_properties[2], demo_owner,
      'Apartament nou 3 camere, 82 mp, Pipera–Voluntari, 2024, parcare — licitație (POC / Simulare)',
      'Apartament nou pe culoarul Pipera, în Voluntari (Ilfov) — pin de simulare, nu este o adresă reală. Listare de simulare POC.',
      'Voluntari (Ilfov)', 'Adresă demonstrativă privată 2', 'apartment', 82, 3, 3, 2024,
      ARRAY[
        'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1600&q=85',
        'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=85'
      ],
      44.48625, 26.11873, 'Ilfov'
    ),
    (
      demo_properties[3], demo_owner,
      'Apartament 2 camere, 64 mp, Unirii–Centrul Civic, renovat 2023 — licitație (POC / Simulare)',
      'Apartament în Centrul Civic, Sector 3; pin de simulare. Listare de simulare POC.',
      'Unirii', 'Adresă demonstrativă privată 3', 'apartment', 64, 2, 6, 1986,
      ARRAY[
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1600&q=85',
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=85'
      ],
      44.42727, 26.10797, 'București'
    ),
    (
      demo_properties[4], demo_owner,
      'Apartament 3 camere, 72 mp, Tineretului, lângă parc, renovat 2021 — licitație (POC / Simulare)',
      'Apartament lângă Parcul Tineretului, Sector 4. Listare de simulare POC.',
      'Tineretului', 'Adresă demonstrativă privată 4', 'apartment', 72, 3, 3, 1980,
      ARRAY[
        'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1600&q=85',
        'https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=1200&q=85'
      ],
      44.40870, 26.10560, 'București'
    ),
    (
      demo_properties[5], demo_owner,
      'Apartament 2 camere, 52 mp, Drumul Taberei, lângă metrou Favorit (M5) — licitație (POC / Simulare)',
      'Apartament în Drumul Taberei, Sector 6, lângă Favorit (M5). Listare de simulare POC.',
      'Drumul Taberei', 'Adresă demonstrativă privată 5', 'apartment', 52, 2, 2, 1982,
      ARRAY[
        'https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1600&q=85',
        'https://images.unsplash.com/photo-1600566752734-2a0cd26c42ac?auto=format&fit=crop&w=1200&q=85'
      ],
      44.42554, 26.04836, 'București'
    ),
    (
      demo_properties[6], demo_owner,
      'Apartament 3 camere, 85 mp, Cotroceni, imobil 1938 renovat 2019 — licitație (POC / Simulare)',
      'Apartament în Cotroceni, Sector 5; pin de simulare decalat față de Palatul Cotroceni. Listare de simulare POC.',
      'Cotroceni', 'Adresă demonstrativă privată 6', 'apartment', 85, 3, 2, 1938,
      ARRAY[
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=85',
        'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=85'
      ],
      44.43013, 26.07081, 'București'
    )
  ON CONFLICT (id) DO UPDATE SET
    owner_id = EXCLUDED.owner_id,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    neighborhood = EXCLUDED.neighborhood,
    exact_address = EXCLUDED.exact_address,
    property_type = EXCLUDED.property_type,
    area_sqm = EXCLUDED.area_sqm,
    rooms = EXCLUDED.rooms,
    floor = EXCLUDED.floor,
    built_year = EXCLUDED.built_year,
    image_urls = EXCLUDED.image_urls,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    judet = EXCLUDED.judet;

  INSERT INTO app.listings(id, property_id, owner_id, transaction_type, price_minor)
  SELECT
    ('20000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
    ('10000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
    demo_owner,
    'sale',
    (ARRAY[25900000, 33500000, 22400000, 20300000, 10800000, 28700000])[i]
  FROM generate_series(1, 6) AS i
  ON CONFLICT (id) DO UPDATE SET
    property_id = EXCLUDED.property_id,
    owner_id = EXCLUDED.owner_id,
    transaction_type = EXCLUDED.transaction_type,
    price_minor = EXCLUDED.price_minor;

  INSERT INTO app.listings(id, property_id, owner_id, transaction_type, price_minor)
  SELECT
    ('30000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
    ('10000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
    demo_owner,
    'rent',
    (ARRAY[75000, 115000, 65000, 75000, 45000, 105000])[i]
  FROM generate_series(1, 6) AS i
  ON CONFLICT (id) DO UPDATE SET
    property_id = EXCLUDED.property_id,
    owner_id = EXCLUDED.owner_id,
    transaction_type = EXCLUDED.transaction_type,
    price_minor = EXCLUDED.price_minor;

  INSERT INTO app.auctions(
    id, property_id, listing_id, owner_id, mode, access, starts_at, ends_at, status,
    starting_price_minor, min_increment_minor
  )
  VALUES (
    demo_auction, demo_properties[1], sale_listing, demo_owner,
    'ascending', 'public', clock_timestamp() - interval '1 hour', clock_timestamp() + interval '3 days',
    'active', 19900000, 100000
  )
  ON CONFLICT (id) DO UPDATE SET
    property_id = EXCLUDED.property_id,
    listing_id = EXCLUDED.listing_id,
    owner_id = EXCLUDED.owner_id,
    mode = EXCLUDED.mode,
    access = EXCLUDED.access,
    starts_at = EXCLUDED.starts_at,
    ends_at = EXCLUDED.ends_at,
    initial_ends_at = EXCLUDED.initial_ends_at,
    max_ends_at = EXCLUDED.max_ends_at,
    soft_close_seconds = EXCLUDED.soft_close_seconds,
    status = EXCLUDED.status,
    starting_price_minor = EXCLUDED.starting_price_minor,
    min_increment_minor = EXCLUDED.min_increment_minor;

  UPDATE app.listings
  SET auction_id = demo_auction
  WHERE id = sale_listing;
END;
$$;
