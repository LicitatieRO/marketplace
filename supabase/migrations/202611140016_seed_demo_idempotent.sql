-- Idempotent demo seed: resolve demo auth users by email; upsert catalogue rows without
-- deleting properties (preserves property_promos, favorites, and other FK children).

CREATE OR REPLACE FUNCTION app.ensure_demo_auth_user(
  p_email text,
  p_preferred_id uuid,
  p_display_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  resolved uuid;
BEGIN
  SELECT id INTO resolved FROM auth.users WHERE email = p_email LIMIT 1;
  IF resolved IS NOT NULL THEN
    RETURN resolved;
  END IF;

  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'instance_id'
  ) THEN
    INSERT INTO auth.users(
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000', p_preferred_id, 'authenticated', 'authenticated',
      p_email,
      extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('display_name', p_display_name),
      now(), now(), '', '', '', ''
    )
    ON CONFLICT (id) DO NOTHING;
  ELSE
    INSERT INTO auth.users(id, email, email_confirmed_at, raw_user_meta_data)
    VALUES (
      p_preferred_id, p_email, now(),
      jsonb_build_object('display_name', p_display_name)
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  SELECT id INTO resolved FROM auth.users WHERE email = p_email LIMIT 1;
  IF resolved IS NULL THEN
    RAISE EXCEPTION 'demo auth user resolution failed for %', p_email;
  END IF;
  RETURN resolved;
END;
$$;

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
    lng = EXCLUDED.lng;

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
    status = EXCLUDED.status,
    starting_price_minor = EXCLUDED.starting_price_minor,
    min_increment_minor = EXCLUDED.min_increment_minor;

  UPDATE app.listings
  SET auction_id = demo_auction
  WHERE id = sale_listing;
END;
$$;

REVOKE ALL ON FUNCTION app.ensure_demo_auth_user(text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app.ensure_demo_auth_user(text, uuid, text) TO postgres, service_role;

REVOKE ALL ON FUNCTION app.seed_demo_fixture() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app.seed_demo_fixture() TO postgres, service_role;