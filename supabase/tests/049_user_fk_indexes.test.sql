BEGIN;
SET search_path = public, extensions;
SELECT plan(16);

SELECT has_index(
  'app',
  'auction_members',
  'auction_members_invited_by_idx',
  'auction_members.invited_by FK supporting index exists'
);
SELECT has_index(
  'app',
  'auction_members',
  'auction_members_user_id_idx',
  'auction_members.user_id FK supporting index exists'
);
SELECT has_index(
  'app',
  'auctions',
  'auctions_owner_id_idx',
  'auctions.owner_id FK supporting index exists'
);
SELECT has_index(
  'app',
  'conversation_members',
  'conversation_members_user_id_idx',
  'conversation_members.user_id FK supporting index exists'
);
SELECT has_index(
  'app',
  'conversations',
  'conversations_buyer_id_idx',
  'conversations.buyer_id FK supporting index exists'
);
SELECT has_index(
  'app',
  'conversations',
  'conversations_owner_id_idx',
  'conversations.owner_id FK supporting index exists'
);
SELECT has_index(
  'app',
  'listings',
  'listings_owner_id_idx',
  'listings.owner_id FK supporting index exists'
);
SELECT has_index(
  'app',
  'messages',
  'messages_sender_id_idx',
  'messages.sender_id FK supporting index exists'
);
SELECT has_index(
  'app',
  'notification_outbox',
  'notification_outbox_user_id_idx',
  'notification_outbox.user_id FK supporting index exists'
);
SELECT has_index(
  'app',
  'properties',
  'properties_owner_id_idx',
  'properties.owner_id FK supporting index exists'
);
SELECT has_index(
  'app',
  'property_promos',
  'property_promos_owner_id_idx',
  'property_promos.owner_id FK supporting index exists'
);
SELECT has_index(
  'app',
  'reservations',
  'reservations_buyer_id_idx',
  'reservations.buyer_id FK supporting index exists'
);
SELECT has_index(
  'app',
  'reservations',
  'reservations_owner_id_idx',
  'reservations.owner_id FK supporting index exists'
);
SELECT has_index(
  'app',
  'viewings',
  'viewings_buyer_id_idx',
  'viewings.buyer_id FK supporting index exists'
);
SELECT has_index(
  'app',
  'viewings',
  'viewings_owner_id_idx',
  'viewings.owner_id FK supporting index exists'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_constraint AS con
    JOIN pg_class AS src ON src.oid = con.conrelid
    JOIN pg_namespace AS src_ns ON src_ns.oid = src.relnamespace
    JOIN pg_class AS ref ON ref.oid = con.confrelid
    JOIN pg_namespace AS ref_ns ON ref_ns.oid = ref.relnamespace
    JOIN unnest(con.conkey) AS fk_attnum(attnum) ON true
    JOIN pg_attribute AS att
      ON att.attrelid = con.conrelid
     AND att.attnum = fk_attnum.attnum
     AND NOT att.attisdropped
    WHERE con.contype = 'f'
      AND ref_ns.nspname = 'app'
      AND ref.relname = 'profiles'
      AND src_ns.nspname = 'app'
      AND NOT EXISTS (
        SELECT 1
        FROM pg_index AS i
        WHERE i.indrelid = con.conrelid
          AND i.indkey[0] = fk_attnum.attnum
      )
  ),
  'every app FK to profiles has a leading index on the FK column'
);

SELECT * FROM finish();
ROLLBACK;