-- Demo seed replay: scoped FK cleanup and client execute lockdown.

CREATE OR REPLACE FUNCTION app.seed_demo_fixture()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  demo_owner uuid := '11111111-1111-4111-8111-111111111111';
  demo_buyer uuid := '22222222-2222-4222-8222-222222222222';
  demo_dual uuid := '44444444-4444-4444-8444-444444444444';
  demo_properties uuid[] := ARRAY[
    '10000000-0000-4000-8000-000000000001'::uuid,
    '10000000-0000-4000-8000-000000000002'::uuid,
    '10000000-0000-4000-8000-000000000003'::uuid,
    '10000000-0000-4000-8000-000000000004'::uuid,
    '10000000-0000-4000-8000-000000000005'::uuid,
    '10000000-0000-4000-8000-000000000006'::uuid
  ];
  demo_auction uuid := '40000000-0000-4000-8000-000000000001';
BEGIN
  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'instance_id'
  ) THEN
    INSERT INTO auth.users(
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    )
    VALUES
      (
        '00000000-0000-0000-0000-000000000000', demo_owner, 'authenticated', 'authenticated',
        'owner@licitatiero.local',
        extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')),
        now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Alex · LicitatieRO"}',
        now(), now(), '', '', '', ''
      ),
      (
        '00000000-0000-0000-0000-000000000000', demo_buyer, 'authenticated', 'authenticated',
        'buyer@licitatiero.local',
        extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')),
        now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Dana · Cumpărător (POC / Simulare)"}',
        now(), now(), '', '', '', ''
      ),
      (
        '00000000-0000-0000-0000-000000000000', demo_dual, 'authenticated', 'authenticated',
        'dual@licitatiero.local',
        extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')),
        now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Mihai · Rol dublu (POC / Simulare)"}',
        now(), now(), '', '', '', ''
      )
    ON CONFLICT (id) DO NOTHING;

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
  ELSE
    INSERT INTO auth.users(id, email, email_confirmed_at, raw_user_meta_data)
    VALUES
      (demo_owner, 'owner@licitatiero.local', now(), '{"display_name":"Alex · LicitatieRO"}'),
      (demo_buyer, 'buyer@licitatiero.local', now(), '{"display_name":"Dana · Cumpărător (POC / Simulare)"}'),
      (demo_dual, 'dual@licitatiero.local', now(), '{"display_name":"Mihai · Rol dublu (POC / Simulare)"}')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  DELETE FROM app.ledger_entries
  WHERE promo_id IN (
    SELECT id FROM app.property_promos WHERE property_id = ANY(demo_properties)
  );
  DELETE FROM app.property_promos WHERE property_id = ANY(demo_properties);
  DELETE FROM app.favorites
  WHERE listing_id IN (
    SELECT id FROM app.listings WHERE property_id = ANY(demo_properties)
  );
  DELETE FROM app.messages
  WHERE conversation_id IN (
    SELECT c.id
    FROM app.conversations c
    JOIN app.listings l ON l.id = c.listing_id
    WHERE l.property_id = ANY(demo_properties)
  );
  DELETE FROM app.conversations
  WHERE listing_id IN (
    SELECT id FROM app.listings WHERE property_id = ANY(demo_properties)
  );
  DELETE FROM app.viewings
  WHERE listing_id IN (
    SELECT id FROM app.listings WHERE property_id = ANY(demo_properties)
  );
  DELETE FROM app.reservations WHERE property_id = ANY(demo_properties);
  DELETE FROM app.bids WHERE auction_id = demo_auction;
  DELETE FROM app.auction_members WHERE auction_id = demo_auction;
  UPDATE app.listings SET auction_id = NULL WHERE auction_id = demo_auction;
  DELETE FROM app.auctions WHERE id = demo_auction;
  DELETE FROM app.listings WHERE property_id = ANY(demo_properties);
  DELETE FROM app.properties WHERE id = ANY(demo_properties);

  INSERT INTO app.properties(
    id, owner_id, title, description, neighborhood, exact_address, property_type,
    area_sqm, rooms, floor, built_year, image_urls, lat, lng
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
      44.46463, 26.09944
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
      44.48625, 26.11873
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
      44.42727, 26.10797
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
      44.40870, 26.10560
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
      44.42554, 26.04836
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
      44.43013, 26.07081
    )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO app.listings(id, property_id, owner_id, transaction_type, price_minor)
  SELECT
    ('20000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
    ('10000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
    demo_owner,
    'sale',
    (ARRAY[25900000, 33500000, 22400000, 20300000, 10800000, 28700000])[i]
  FROM generate_series(1, 6) AS i
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO app.listings(id, property_id, owner_id, transaction_type, price_minor)
  SELECT
    ('30000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
    ('10000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
    demo_owner,
    'rent',
    (ARRAY[75000, 115000, 65000, 75000, 45000, 105000])[i]
  FROM generate_series(1, 6) AS i
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO app.auctions(
    id, property_id, listing_id, owner_id, mode, access, starts_at, ends_at, status,
    starting_price_minor, min_increment_minor
  )
  VALUES (
    demo_auction, demo_properties[1], '20000000-0000-4000-8000-000000000001'::uuid, demo_owner,
    'ascending', 'public', clock_timestamp() - interval '1 hour', clock_timestamp() + interval '3 days',
    'active', 19900000, 100000
  )
  ON CONFLICT (id) DO NOTHING;

  UPDATE app.listings
  SET auction_id = demo_auction
  WHERE id = '20000000-0000-4000-8000-000000000001'::uuid;
END;
$$;

REVOKE ALL ON FUNCTION app.seed_demo_fixture() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app.seed_demo_fixture() TO postgres, service_role;