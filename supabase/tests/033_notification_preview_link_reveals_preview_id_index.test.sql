BEGIN;
SET search_path = public, extensions;
SELECT plan(2);

SELECT has_index(
  'app',
  'notification_preview_link_reveals',
  'notification_preview_link_reveals_preview_id_idx',
  'notification_preview_link_reveals.preview_id FK supporting index exists'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_class AS ic
    JOIN pg_namespace AS ins ON ins.oid = ic.relnamespace
    JOIN pg_index AS i ON i.indexrelid = ic.oid
    JOIN pg_class AS tbl ON tbl.oid = i.indrelid
    JOIN pg_namespace AS tblns ON tblns.oid = tbl.relnamespace
    JOIN pg_attribute AS a ON a.attrelid = tbl.oid
      AND a.attnum = i.indkey[0]
      AND NOT a.attisdropped
    WHERE ins.nspname = 'app'
      AND ic.relname = 'notification_preview_link_reveals_preview_id_idx'
      AND tblns.nspname = 'app'
      AND tbl.relname = 'notification_preview_link_reveals'
      AND a.attname = 'preview_id'
      AND array_length(i.indkey, 1) = 1
  ),
  'notification_preview_link_reveals_preview_id_idx indexes only notification_preview_link_reveals.preview_id (FK column)'
);

SELECT * FROM finish();
ROLLBACK;
