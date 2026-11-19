BEGIN;
SET search_path = public, extensions;
SELECT plan(2);

SELECT has_index(
  'app',
  'properties',
  'properties_judet_idx',
  'properties.judet FK supporting index exists'
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
      AND ic.relname = 'properties_judet_idx'
      AND tblns.nspname = 'app'
      AND tbl.relname = 'properties'
      AND a.attname = 'judet'
      AND array_length(i.indkey, 1) = 1
  ),
  'properties_judet_idx indexes only properties.judet (FK column)'
);

SELECT * FROM finish();
ROLLBACK;