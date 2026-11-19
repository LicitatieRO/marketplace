# Lightweight local integration harness

LOCAL ONLY. Genuine GoTrue + PostgREST + PostgreSQL for integration testing on machines where the complete Supabase CLI image set will not fit. It is not a production hosting design or full Supabase replacement. Normal CI continues using `supabase start`.

Run from marketplace: `node scripts/local-stack.mjs start`;

On this storage-constrained task, root explicitly authorized sharing the existing test cluster while keeping its original database unchanged: `LOCAL_STACK_EXISTING_DB=licitatiero-test-db node scripts/local-stack.mjs start` creates a separate `licitatiero_app` database and local admin role on54329, then starts only the Auth/REST containers. The existing container joins the local bridge; stop never stops it. This mode changes cluster roles but leaves the original database tables/schema untouched.

 reapply newly added migrations with `node scripts/local-stack.mjs migrate`; stop without removing data with `node scripts/local-stack.mjs stop`.

Separate containers `licitatiero-local-db`, `licitatiero-local-auth`, `licitatiero-local-rest`, Docker network `licitatiero-local`, and database volume `licitatiero-local-db`. All host ports bind loopback: gateway54321, Postgres54322, GoTrue54323, PostgREST54324. Existing integration test DB54329 is untouched.

Generated credentials: ignored `.local-stack.json` mode0600. Runtime env files and gateway PID are under ignored `dev/lightweight/.runtime/`. Do not print or commit them. Config fields `apiUrl`, `anonKey`, `serviceRoleKey`, `databaseUrl` support the local environment helper; remaining fields are local implementation secrets.

Auth schema is migrated by genuine GoTrue before app migrations and demo seed are applied. Migrations have checksum tracking and run transactionally. Editing an applied migration intentionally fails; create a fresh local test stack explicitly if the DB agent changes an in-progress migration. Service role has BYPASSRLS as in Supabase; anon/authenticated requests use PostgREST JWT role switching.

Email autoconfirm is enabled ONLY for local testing, with no email delivery. It is not evidence that production verification emails work. This harness excludes Storage, Realtime, SMTP, Studio, edge functions, pgTAP and pg_cron. Database RPCs still use authoritative clock/locking when invoked. No independent durable expiry worker is supplied here; use full Supabase scheduling for worker/recovery verification.

Start requires adequate Docker storage. VFS Docker copies image files per container and can require much more than the compressed image size. Failed Docker clone operations may consume backing filesystem capacity even without visible container metadata; do not prune other tasks' images or data.
