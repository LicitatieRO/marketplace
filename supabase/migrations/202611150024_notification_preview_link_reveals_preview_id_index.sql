-- Index supporting notification_preview_link_reveals.preview_id -> app.notification_previews(id)
-- (notification_preview_link_reveals_preview_id_fkey; Supabase advisor unindexed_foreign_keys).

CREATE INDEX IF NOT EXISTS notification_preview_link_reveals_preview_id_idx
  ON app.notification_preview_link_reveals (preview_id);
