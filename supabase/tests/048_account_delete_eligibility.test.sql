BEGIN;
SET search_path = public, extensions;
SELECT plan(11);

SELECT ok(
  has_function_privilege('service_role', 'public.account_delete_eligibility(uuid)', 'EXECUTE'),
  'service_role may call account delete eligibility RPC'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.account_delete_eligibility(uuid)', 'EXECUTE'),
  'authenticated cannot call account delete eligibility RPC'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.account_delete_eligibility(uuid)', 'EXECUTE'),
  'anon cannot call account delete eligibility RPC'
);

SELECT set_eq(
  $$
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
    ORDER BY 1, 2, 3
  $$,
  $$
    SELECT schema_name, table_name, column_name
    FROM app.account_delete_non_cascade_user_fks()
    ORDER BY 1, 2, 3
  $$,
  'eligibility FK helper matches pg_constraint non-cascade user/profile FKs'
);

INSERT INTO auth.users (id, email, email_confirmed_at)
VALUES
  ('a1690001-0000-4000-8000-000000000001', 'adelete-clean@example.test', now()),
  ('a1690001-0000-4000-8000-000000000002', 'adelete-staff@example.test', now()),
  ('a1690001-0000-4000-8000-000000000003', 'adelete-history@example.test', now())
ON CONFLICT (id) DO NOTHING;

UPDATE app.profiles SET is_staff = true
WHERE id = 'a1690001-0000-4000-8000-000000000002';

SELECT set_config(
  'test.clean_user',
  'a1690001-0000-4000-8000-000000000001',
  true
);
SELECT set_config(
  'test.staff_user',
  'a1690001-0000-4000-8000-000000000002',
  true
);
SELECT set_config(
  'test.history_user',
  'a1690001-0000-4000-8000-000000000003',
  true
);

SET LOCAL ROLE service_role;
SELECT is(
  public.account_delete_eligibility(
    'a1690001-0000-4000-8000-000000009999'::uuid
  ),
  'not_found',
  'missing auth.users row returns not_found'
);
RESET ROLE;

SET LOCAL ROLE service_role;
SELECT is(
  public.account_delete_eligibility(
    current_setting('test.clean_user')::uuid
  ),
  NULL,
  'user with only profile may delete'
);
RESET ROLE;

SET LOCAL ROLE service_role;
SELECT is(
  public.account_delete_eligibility(
    current_setting('test.staff_user')::uuid
  ),
  'staff',
  'staff accounts blocked'
);
RESET ROLE;

INSERT INTO app.favorites (user_id, listing_id)
SELECT
  current_setting('test.history_user')::uuid,
  l.id
FROM app.listings l
LIMIT 1;

SET LOCAL ROLE service_role;
SELECT is(
  public.account_delete_eligibility(
    current_setting('test.history_user')::uuid
  ),
  'has_history',
  'favorites row yields has_history'
);
RESET ROLE;

DELETE FROM app.favorites
WHERE user_id = current_setting('test.history_user')::uuid;

INSERT INTO app.properties (
  id,
  owner_id,
  title,
  description,
  neighborhood,
  exact_address,
  property_type,
  area_sqm,
  rooms,
  floor,
  built_year,
  judet
) VALUES (
  'a1690100-0000-4000-8000-000000000099',
  current_setting('test.history_user')::uuid,
  'Delete eligibility fixture',
  'Fixture property for account delete pgTAP coverage.',
  'Cotroceni',
  '1 Fixture Street',
  'apartment',
  52,
  2,
  3,
  1985,
  'București'
);

INSERT INTO app.listings (
  property_id,
  owner_id,
  transaction_type,
  price_minor,
  status
) VALUES (
  'a1690100-0000-4000-8000-000000000099',
  current_setting('test.history_user')::uuid,
  'sale',
  25000000,
  'published'
);

SET LOCAL ROLE service_role;
SELECT is(
  public.account_delete_eligibility(
    current_setting('test.history_user')::uuid
  ),
  'published_listings',
  'published listing yields published_listings'
);
RESET ROLE;

UPDATE app.listings
SET status = 'closed'
WHERE owner_id = current_setting('test.history_user')::uuid
  AND status = 'published';

SET LOCAL ROLE service_role;
SELECT is(
  public.account_delete_eligibility(
    current_setting('test.history_user')::uuid
  ),
  'has_history',
  'closed listing yields has_history after publish block cleared'
);
RESET ROLE;

DELETE FROM app.listings
WHERE owner_id = current_setting('test.history_user')::uuid;

DELETE FROM app.properties
WHERE id = 'a1690100-0000-4000-8000-000000000099';

INSERT INTO auth.users (id, email, email_confirmed_at)
VALUES (
  'a1690001-0000-4000-8000-000000000004',
  'adelete-dsa@example.test',
  now()
)
ON CONFLICT (id) DO NOTHING;

SELECT set_config(
  'test.dsa_user',
  'a1690001-0000-4000-8000-000000000004',
  true
);

INSERT INTO app.dsa_notices (
  listing_id,
  listing_url,
  element,
  reason,
  explanation,
  notifier_name,
  notifier_email,
  good_faith
)
SELECT
  l.id,
  'https://example.test/listings/' || l.id::text,
  'description',
  'fraud',
  'Recorded notifier email must block delete eligibility exactly.',
  'Reporter',
  'adelete-dsa@example.test',
  true
FROM app.listings l
LIMIT 1;

SET LOCAL ROLE service_role;
SELECT is(
  public.account_delete_eligibility(
    current_setting('test.dsa_user')::uuid
  ),
  'dsa_notices',
  'notifier email match uses exact lower() equality'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
