-- Index supporting properties.judet -> app.romania_judete(name) (properties_judet_fk).

CREATE INDEX IF NOT EXISTS properties_judet_idx ON app.properties (judet);