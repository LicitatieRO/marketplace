-- Local demonstration only. Password is generated and discarded; scripts/local-env
-- sets a fresh secret through GoTrue Admin, never a source-controlled password.
--
-- Hard rules (hosted staging may have real accounts, e.g. founder@licitatiero.local):
-- - No TRUNCATE and no unscoped DELETE on auth.users, auth.identities, auth.mfa_factors,
--   or app.profiles (nothing that cascades into non-demo users).
-- - Demo auth users are resolved by email (existing id wins; never reassign an auth user id).
-- - Never UPDATE is_staff (or other profile fields) on non-demo users.
-- - Catalogue rows use fixed demo UUID families; properties/listings upsert in place (no
--   property DELETE) so property_promos, favorites, and other FK children are preserved.
--
-- app.seed_demo_fixture() is defined in migrations and requires the session marker below.
-- Hosted production must never set app.allow_demo_seed; staging operators set it only for
-- deliberate catalogue refresh in a controlled SQL session (same marker as local reset).

BEGIN;
SELECT set_config('app.allow_demo_seed', 'on', true);
SELECT app.seed_demo_fixture();
COMMIT;