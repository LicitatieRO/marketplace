-- Btree indexes on foreign keys referencing app.profiles(id) without a leading index.
-- Supports account-delete eligibility scans (#173) and profile delete / anonymisation checks.

CREATE INDEX IF NOT EXISTS auction_members_invited_by_idx ON app.auction_members (invited_by);
CREATE INDEX IF NOT EXISTS auction_members_user_id_idx ON app.auction_members (user_id);
CREATE INDEX IF NOT EXISTS auctions_owner_id_idx ON app.auctions (owner_id);
CREATE INDEX IF NOT EXISTS conversation_members_user_id_idx ON app.conversation_members (user_id);
CREATE INDEX IF NOT EXISTS conversations_buyer_id_idx ON app.conversations (buyer_id);
CREATE INDEX IF NOT EXISTS conversations_owner_id_idx ON app.conversations (owner_id);
CREATE INDEX IF NOT EXISTS listings_owner_id_idx ON app.listings (owner_id);
CREATE INDEX IF NOT EXISTS messages_sender_id_idx ON app.messages (sender_id);
CREATE INDEX IF NOT EXISTS notification_outbox_user_id_idx ON app.notification_outbox (user_id);
CREATE INDEX IF NOT EXISTS properties_owner_id_idx ON app.properties (owner_id);
CREATE INDEX IF NOT EXISTS property_promos_owner_id_idx ON app.property_promos (owner_id);
CREATE INDEX IF NOT EXISTS reservations_buyer_id_idx ON app.reservations (buyer_id);
CREATE INDEX IF NOT EXISTS reservations_owner_id_idx ON app.reservations (owner_id);
CREATE INDEX IF NOT EXISTS viewings_buyer_id_idx ON app.viewings (buyer_id);
CREATE INDEX IF NOT EXISTS viewings_owner_id_idx ON app.viewings (owner_id);