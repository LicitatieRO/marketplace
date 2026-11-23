BEGIN;
SET search_path = public, extensions;
SELECT plan(33);

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
SELECT ok(
  NOT has_function_privilege('anon', 'app.account_delete_eligibility(uuid)', 'EXECUTE'),
  'anon cannot call app account delete eligibility function'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'app.account_delete_eligibility(uuid)', 'EXECUTE'),
  'authenticated cannot call app account delete eligibility function'
);
SELECT ok(
  NOT has_function_privilege('anon', 'app.account_delete_non_cascade_user_fks()', 'EXECUTE'),
  'anon cannot call account delete non-cascade FK helper'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'app.account_delete_non_cascade_user_fks()', 'EXECUTE'),
  'authenticated cannot call account delete non-cascade FK helper'
);
SELECT ok(
  has_function_privilege('service_role', 'app.account_delete_release_invites(uuid)', 'EXECUTE'),
  'service_role may call account delete release invites'
);
SELECT ok(
  NOT has_function_privilege('anon', 'app.account_delete_release_invites(uuid)', 'EXECUTE'),
  'anon cannot call account delete release invites'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'app.account_delete_release_invites(uuid)', 'EXECUTE'),
  'authenticated cannot call account delete release invites'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint AS c
    JOIN pg_class AS src ON src.oid = c.conrelid
    JOIN pg_namespace AS ns ON ns.oid = src.relnamespace
    WHERE ns.nspname = 'app'
      AND src.relname = 'notification_outbox'
      AND c.conname = 'notification_outbox_user_id_fkey'
      AND c.confdeltype = 'c'
      AND c.confrelid = 'app.profiles'::regclass
  ),
  'notification outbox user_id cascades on app.profiles delete'
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
  ('a1690001-0000-4000-8000-000000000003', 'adelete-history@example.test', now()),
  ('a1690001-0000-4000-8000-000000000004', 'adelete-dsa@example.test', now()),
  ('a1690001-0000-4000-8000-000000000005', 'adelete-blockers@example.test', now()),
  ('a1690001-0000-4000-8000-000000000006', 'adelete-auction-owner@example.test', now()),
  ('a1690001-0000-4000-8000-000000000007', 'adelete-invitee@example.test', now()),
  ('a1690001-0000-4000-8000-000000000008', 'adelete-notify@example.test', now())
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
SELECT set_config(
  'test.dsa_user',
  'a1690001-0000-4000-8000-000000000004',
  true
);
SELECT set_config(
  'test.blocker_user',
  'a1690001-0000-4000-8000-000000000005',
  true
);
SELECT set_config(
  'test.auction_owner',
  'a1690001-0000-4000-8000-000000000006',
  true
);
SELECT set_config(
  'test.invitee_user',
  'a1690001-0000-4000-8000-000000000007',
  true
);
SELECT set_config(
  'test.notify_user',
  'a1690001-0000-4000-8000-000000000008',
  true
);

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
  'a1690102-0000-4000-8000-000000000010',
  current_setting('test.auction_owner')::uuid,
  'DSA eligibility fixture listing',
  'Deterministic listing for notice eligibility coverage.',
  'Cotroceni',
  '2 Fixture Street',
  'apartment',
  48,
  2,
  2,
  1990,
  'București'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO app.listings (
  id,
  property_id,
  owner_id,
  transaction_type,
  price_minor,
  status
) VALUES (
  'a1690103-0000-4000-8000-000000000010',
  'a1690102-0000-4000-8000-000000000010',
  current_setting('test.auction_owner')::uuid,
  'sale',
  30000000,
  'published'
) ON CONFLICT (id) DO NOTHING;

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
VALUES (
  current_setting('test.history_user')::uuid,
  'a1690103-0000-4000-8000-000000000010'
);

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
  id,
  property_id,
  owner_id,
  transaction_type,
  price_minor,
  status
) VALUES (
  'a1690101-0000-4000-8000-000000000099',
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

INSERT INTO app.dsa_notices (
  listing_id,
  listing_url,
  element,
  reason,
  explanation,
  notifier_name,
  notifier_email,
  good_faith,
  status
)
VALUES (
  'a1690103-0000-4000-8000-000000000010',
  'https://example.test/listings/a1690103-0000-4000-8000-000000000010',
  'description',
  'fraud',
  'Third-party notice uses victim email without verified notifier link.',
  'Someone else',
  'adelete-dsa@example.test',
  true,
  'received'
);

SET LOCAL ROLE service_role;
SELECT is(
  public.account_delete_eligibility(
    current_setting('test.dsa_user')::uuid
  ),
  NULL,
  'unverified notifier email match does not block delete'
);
RESET ROLE;

INSERT INTO app.dsa_notices (
  listing_id,
  listing_url,
  element,
  reason,
  explanation,
  notifier_name,
  notifier_email,
  good_faith,
  status
)
VALUES (
  'a1690103-0000-4000-8000-000000000010',
  'https://example.test/listings/a1690103-0000-4000-8000-000000000010',
  'price_details',
  'misleading_info',
  'Closed notice with matching email must not block delete either.',
  'Reporter',
  'adelete-dsa@example.test',
  true,
  'closed'
);

SET LOCAL ROLE service_role;
SELECT is(
  public.account_delete_eligibility(
    current_setting('test.dsa_user')::uuid
  ),
  NULL,
  'closed notice does not block delete'
);
RESET ROLE;

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
  'a1690104-0000-4000-8000-000000000020',
  current_setting('test.blocker_user')::uuid,
  'Active auction blocker fixture',
  'Property for active auction eligibility coverage.',
  'Floreasca',
  '3 Fixture Street',
  'apartment',
  60,
  3,
  5,
  2000,
  'București'
);

INSERT INTO app.listings (
  id,
  property_id,
  owner_id,
  transaction_type,
  price_minor,
  status
) VALUES (
  'a1690105-0000-4000-8000-000000000020',
  'a1690104-0000-4000-8000-000000000020',
  current_setting('test.blocker_user')::uuid,
  'sale',
  40000000,
  'closed'
);

INSERT INTO app.auctions (
  id,
  property_id,
  listing_id,
  owner_id,
  mode,
  access,
  starts_at,
  ends_at,
  status,
  starting_price_minor,
  min_increment_minor
) VALUES (
  'a1690106-0000-4000-8000-000000000020',
  'a1690104-0000-4000-8000-000000000020',
  'a1690105-0000-4000-8000-000000000020',
  current_setting('test.blocker_user')::uuid,
  'ascending',
  'public',
  clock_timestamp() - interval '1 hour',
  clock_timestamp() + interval '1 day',
  'active',
  1000000,
  10000
);

UPDATE app.listings
SET auction_id = 'a1690106-0000-4000-8000-000000000020'
WHERE id = 'a1690105-0000-4000-8000-000000000020';

SET LOCAL ROLE service_role;
SELECT is(
  public.account_delete_eligibility(
    current_setting('test.blocker_user')::uuid
  ),
  'active_auctions',
  'scheduled or active owned auction blocks delete'
);
RESET ROLE;

UPDATE app.auctions
SET status = 'closed'
WHERE id = 'a1690106-0000-4000-8000-000000000020';

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
  'a1690107-0000-4000-8000-000000000030',
  current_setting('test.auction_owner')::uuid,
  'Open bid blocker fixture',
  'Property for open bid eligibility coverage.',
  'Dorobanți',
  '4 Fixture Street',
  'apartment',
  55,
  2,
  4,
  1995,
  'București'
);

INSERT INTO app.listings (
  id,
  property_id,
  owner_id,
  transaction_type,
  price_minor,
  status
) VALUES (
  'a1690108-0000-4000-8000-000000000030',
  'a1690107-0000-4000-8000-000000000030',
  current_setting('test.auction_owner')::uuid,
  'sale',
  35000000,
  'closed'
);

INSERT INTO app.auctions (
  id,
  property_id,
  listing_id,
  owner_id,
  mode,
  access,
  starts_at,
  ends_at,
  status,
  starting_price_minor,
  min_increment_minor
) VALUES (
  'a1690109-0000-4000-8000-000000000030',
  'a1690107-0000-4000-8000-000000000030',
  'a1690108-0000-4000-8000-000000000030',
  current_setting('test.auction_owner')::uuid,
  'ascending',
  'public',
  clock_timestamp() - interval '1 hour',
  clock_timestamp() + interval '1 day',
  'active',
  1000000,
  10000
);

UPDATE app.listings
SET auction_id = 'a1690109-0000-4000-8000-000000000030'
WHERE id = 'a1690108-0000-4000-8000-000000000030';

INSERT INTO app.bids (
  auction_id,
  bidder_id,
  amount_minor,
  idempotency_key
) VALUES (
  'a1690109-0000-4000-8000-000000000030',
  current_setting('test.blocker_user')::uuid,
  1100000,
  'a169010a-0000-4000-8000-000000000030'
);

SET LOCAL ROLE service_role;
SELECT is(
  public.account_delete_eligibility(
    current_setting('test.blocker_user')::uuid
  ),
  'open_bids',
  'bid in active auction blocks delete'
);
RESET ROLE;

DELETE FROM app.bids
WHERE bidder_id = current_setting('test.blocker_user')::uuid;

UPDATE app.auctions
SET status = 'closed'
WHERE id = 'a1690109-0000-4000-8000-000000000030';

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
  'a169010b-0000-4000-8000-000000000040',
  current_setting('test.auction_owner')::uuid,
  'Reservation blocker fixture',
  'Property for open reservation eligibility coverage.',
  'Tineretului',
  '5 Fixture Street',
  'apartment',
  45,
  2,
  1,
  1988,
  'București'
);

INSERT INTO app.listings (
  id,
  property_id,
  owner_id,
  transaction_type,
  price_minor,
  status
) VALUES (
  'a169010c-0000-4000-8000-000000000040',
  'a169010b-0000-4000-8000-000000000040',
  current_setting('test.auction_owner')::uuid,
  'sale',
  28000000,
  'closed'
);

INSERT INTO app.auctions (
  id,
  property_id,
  listing_id,
  owner_id,
  mode,
  access,
  starts_at,
  ends_at,
  status,
  starting_price_minor,
  min_increment_minor
) VALUES (
  'a169010d-0000-4000-8000-000000000040',
  'a169010b-0000-4000-8000-000000000040',
  'a169010c-0000-4000-8000-000000000040',
  current_setting('test.auction_owner')::uuid,
  'ascending',
  'public',
  clock_timestamp() - interval '2 days',
  clock_timestamp() - interval '1 day',
  'closed',
  1000000,
  10000
);

UPDATE app.listings
SET auction_id = 'a169010d-0000-4000-8000-000000000040'
WHERE id = 'a169010c-0000-4000-8000-000000000040';

INSERT INTO app.bids (
  id,
  auction_id,
  bidder_id,
  amount_minor,
  idempotency_key
) VALUES (
  'a169010e-0000-4000-8000-000000000040',
  'a169010d-0000-4000-8000-000000000040',
  current_setting('test.blocker_user')::uuid,
  1200000,
  'a169010f-0000-4000-8000-000000000040'
);

INSERT INTO app.reservations (
  property_id,
  listing_id,
  bid_id,
  owner_id,
  buyer_id,
  deposit_minor,
  status
) VALUES (
  'a169010b-0000-4000-8000-000000000040',
  'a169010c-0000-4000-8000-000000000040',
  'a169010e-0000-4000-8000-000000000040',
  current_setting('test.auction_owner')::uuid,
  current_setting('test.blocker_user')::uuid,
  50000,
  'requested'
);

SET LOCAL ROLE service_role;
SELECT is(
  public.account_delete_eligibility(
    current_setting('test.blocker_user')::uuid
  ),
  'open_reservations',
  'open reservation as buyer blocks delete'
);
RESET ROLE;

DELETE FROM app.reservations
WHERE buyer_id = current_setting('test.blocker_user')::uuid;

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
  'a1690110-0000-4000-8000-000000000050',
  current_setting('test.blocker_user')::uuid,
  'Promotion blocker fixture',
  'Property for open promotion eligibility coverage.',
  'Unirii',
  '6 Fixture Street',
  'apartment',
  50,
  2,
  6,
  2010,
  'București'
);

INSERT INTO app.property_promos (
  property_id,
  owner_id,
  expires_at,
  status,
  mode
) VALUES (
  'a1690110-0000-4000-8000-000000000050',
  current_setting('test.blocker_user')::uuid,
  clock_timestamp() + interval '7 days',
  'pending',
  'mock'
);

SET LOCAL ROLE service_role;
SELECT is(
  public.account_delete_eligibility(
    current_setting('test.blocker_user')::uuid
  ),
  'open_promotions',
  'pending promotion blocks delete'
);
RESET ROLE;

INSERT INTO app.auction_members (
  auction_id,
  user_id,
  invited_by
) VALUES (
  'a1690109-0000-4000-8000-000000000030',
  current_setting('test.invitee_user')::uuid,
  current_setting('test.auction_owner')::uuid
);

SET LOCAL ROLE service_role;
SELECT is(
  public.account_delete_eligibility(
    current_setting('test.invitee_user')::uuid
  ),
  NULL,
  'invite-only auction member may delete'
);
SELECT is(
  app.account_delete_release_invites(
    current_setting('test.invitee_user')::uuid
  ),
  1,
  'release invites removes exactly one invite-only membership row'
);
RESET ROLE;

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM app.auction_members
    WHERE user_id = current_setting('test.invitee_user')::uuid
  ),
  'invite-only membership row removed after release invites'
);

INSERT INTO app.notification_outbox (user_id, event, entity_id)
VALUES (
  current_setting('test.notify_user')::uuid,
  'auction.invited',
  'a1690109-0000-4000-8000-000000000030'
);

SET LOCAL ROLE service_role;
SELECT is(
  public.account_delete_eligibility(
    current_setting('test.notify_user')::uuid
  ),
  NULL,
  'notification outbox recipient-only row may delete'
);
RESET ROLE;

DELETE FROM app.notification_outbox
WHERE user_id = current_setting('test.notify_user')::uuid;

INSERT INTO app.auction_members (
  auction_id,
  user_id,
  invited_by
) VALUES (
  'a1690109-0000-4000-8000-000000000030',
  current_setting('test.invitee_user')::uuid,
  current_setting('test.auction_owner')::uuid
);

SET LOCAL ROLE service_role;
SELECT is(
  public.account_delete_eligibility(
    current_setting('test.auction_owner')::uuid
  ),
  'has_history',
  'auction inviter still blocked via invited_by history'
);
SELECT is(
  app.account_delete_release_invites(
    current_setting('test.auction_owner')::uuid
  ),
  0,
  'release invites does not remove another users membership row'
);
RESET ROLE;

INSERT INTO app.bids (
  auction_id,
  bidder_id,
  amount_minor,
  idempotency_key
) VALUES (
  'a1690109-0000-4000-8000-000000000030',
  current_setting('test.blocker_user')::uuid,
  1150000,
  'a1690111-0000-4000-8000-000000000030'
);

INSERT INTO app.auction_members (
  auction_id,
  user_id,
  invited_by
) VALUES (
  'a1690109-0000-4000-8000-000000000030',
  current_setting('test.blocker_user')::uuid,
  current_setting('test.auction_owner')::uuid
)
ON CONFLICT DO NOTHING;

SET LOCAL ROLE service_role;
SELECT is(
  public.account_delete_eligibility(
    current_setting('test.blocker_user')::uuid
  ),
  'open_bids',
  'bidder with auction membership still blocked by open bids'
);
SELECT is(
  app.account_delete_release_invites(
    current_setting('test.blocker_user')::uuid
  ),
  0,
  'release invites does not remove membership when user bid in that auction'
);
RESET ROLE;

SELECT ok(
  EXISTS (
    SELECT 1
    FROM app.auction_members
    WHERE user_id = current_setting('test.blocker_user')::uuid
      AND auction_id = 'a1690109-0000-4000-8000-000000000030'
  ),
  'membership with bids remains after release invites'
);

SELECT * FROM finish();
ROLLBACK;
