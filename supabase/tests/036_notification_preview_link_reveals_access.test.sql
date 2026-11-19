BEGIN;
SET search_path = public, extensions;
SELECT plan(7);

SELECT ok(
  (SELECT c.relrowsecurity FROM pg_catalog.pg_class AS c
   JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
   WHERE n.nspname = 'app' AND c.relname = 'notification_preview_link_reveals'),
  'RLS enabled on app.notification_preview_link_reveals'
);

SELECT ok(
  NOT has_table_privilege('public', 'app.notification_preview_link_reveals', 'SELECT'),
  'public role cannot select notification_preview_link_reveals'
);
SELECT ok(
  NOT has_table_privilege('anon', 'app.notification_preview_link_reveals', 'SELECT'),
  'anon cannot select notification_preview_link_reveals'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'app.notification_preview_link_reveals', 'SELECT'),
  'authenticated cannot select notification_preview_link_reveals'
);
SELECT ok(
  NOT has_table_privilege('service_role', 'app.notification_preview_link_reveals', 'SELECT'),
  'service_role has no direct select on notification_preview_link_reveals (audit RPC only)'
);

SELECT ok(
  NOT has_table_privilege('public', 'app.notification_preview_link_reveals', 'INSERT'),
  'public role cannot insert notification_preview_link_reveals'
);
SELECT ok(
  NOT has_table_privilege('anon', 'app.notification_preview_link_reveals', 'INSERT'),
  'anon cannot insert notification_preview_link_reveals'
);

SELECT * FROM finish();
ROLLBACK;