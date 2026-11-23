-- Account delete: exclude recipient-only system rows from history scan (via CASCADE on profile delete).

ALTER TABLE app.notification_outbox
  DROP CONSTRAINT notification_outbox_user_id_fkey;

ALTER TABLE app.notification_outbox
  ADD CONSTRAINT notification_outbox_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES app.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE app.auction_members
  DROP CONSTRAINT auction_members_user_id_fkey;

ALTER TABLE app.auction_members
  ADD CONSTRAINT auction_members_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES app.profiles(id)
  ON DELETE CASCADE;
