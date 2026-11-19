-- Matching pgTAP for 202611140010_listing_json_strip_owner_id.sql
-- Requires migration 006 so listing_json has promo_expires_at.
-- Local only (`npm run test:db`).
--
-- auth.role() / auth.uid() read request.jwt.claims, not the session role,
-- and listing_json is SECURITY DEFINER. Each persona therefore sets jwt
-- claims (and SET LOCAL ROLE) the way PostgREST does in production.

BEGIN;
SET search_path=public,extensions;
SELECT no_plan();

INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
  ('01501501-0000-4000-8000-000000000001','privacy-owner@test.local',now()),
  ('01501501-0000-4000-8000-000000000002','privacy-other@test.local',now());

SELECT set_config('request.jwt.claims','{"sub":"01501501-0000-4000-8000-000000000001","role":"authenticated"}',true);
CREATE TEMP TABLE f AS
  SELECT public.create_property(
    'Privacy apartment','Description for owner privacy contract','Cotroceni',
    'Exact address must stay private','apartment',50,2,1,2019,10000000,50000,'{}'
  ) j;
SELECT set_config(
  'test.listing_id',
  (SELECT id::text FROM app.listings WHERE property_id=(SELECT (j->>'id')::uuid FROM f) AND transaction_type='sale'),
  true
);

-- Owner: key present on get_listing and get_catalogue, value is their uid.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"01501501-0000-4000-8000-000000000001","role":"authenticated"}',true);
SELECT ok(public.get_listing(current_setting('test.listing_id')::uuid) ? 'owner_id','owner get_listing includes owner_id key');
SELECT is(
  public.get_listing(current_setting('test.listing_id')::uuid)->>'owner_id',
  '01501501-0000-4000-8000-000000000001',
  'owner get_listing owner_id is the listing owner'
);
SELECT ok((SELECT elem FROM jsonb_array_elements(public.get_catalogue()) AS t(elem) WHERE elem->>'id'=current_setting('test.listing_id')) ? 'owner_id','owner get_catalogue includes owner_id key');
SELECT is(
  (SELECT elem FROM jsonb_array_elements(public.get_catalogue()) AS t(elem) WHERE elem->>'id'=current_setting('test.listing_id'))->>'owner_id',
  '01501501-0000-4000-8000-000000000001',
  'owner get_catalogue owner_id is the listing owner'
);
SELECT ok(public.get_listing(current_setting('test.listing_id')::uuid) ? 'promo_expires_at','owner get_listing still has promo_expires_at');
SELECT ok((SELECT elem FROM jsonb_array_elements(public.get_catalogue()) AS t(elem) WHERE elem->>'id'=current_setting('test.listing_id')) ? 'promo_expires_at','owner get_catalogue still has promo_expires_at');
RESET ROLE;

-- Other authenticated user (including a self-asserted staff claim): no key.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"01501501-0000-4000-8000-000000000002","role":"authenticated"}',true);
SELECT ok(NOT public.get_listing(current_setting('test.listing_id')::uuid) ? 'owner_id','other user get_listing omits owner_id key');
SELECT ok(NOT (SELECT elem FROM jsonb_array_elements(public.get_catalogue()) AS t(elem) WHERE elem->>'id'=current_setting('test.listing_id')) ? 'owner_id','other user get_catalogue omits owner_id key');
SELECT ok(public.get_listing(current_setting('test.listing_id')::uuid) ? 'promo_expires_at','other user get_listing still has promo_expires_at');
SELECT ok((SELECT elem FROM jsonb_array_elements(public.get_catalogue()) AS t(elem) WHERE elem->>'id'=current_setting('test.listing_id')) ? 'promo_expires_at','other user get_catalogue still has promo_expires_at');
SELECT set_config('request.jwt.claims','{"sub":"01501501-0000-4000-8000-000000000002","role":"staff","aal":"aal2"}',true);
SELECT ok(NOT public.get_listing(current_setting('test.listing_id')::uuid) ? 'owner_id','staff claim does not reveal owner_id');
RESET ROLE;

-- Anonymous guest: no key. Clear sub so a leftover owner jwt cannot leak it.
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims','{"role":"anon"}',true);
SELECT ok(NOT public.get_listing(current_setting('test.listing_id')::uuid) ? 'owner_id','anon get_listing omits owner_id key');
SELECT ok(NOT (SELECT elem FROM jsonb_array_elements(public.get_catalogue()) AS t(elem) WHERE elem->>'id'=current_setting('test.listing_id')) ? 'owner_id','anon get_catalogue omits owner_id key');
SELECT ok(public.get_listing(current_setting('test.listing_id')::uuid) ? 'promo_expires_at','anon get_listing still has promo_expires_at');
SELECT ok((SELECT elem FROM jsonb_array_elements(public.get_catalogue()) AS t(elem) WHERE elem->>'id'=current_setting('test.listing_id')) ? 'promo_expires_at','anon get_catalogue still has promo_expires_at');
RESET ROLE;

-- service_role (jwt role, as the Data API sets it): key present.
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SELECT ok(public.get_listing(current_setting('test.listing_id')::uuid) ? 'owner_id','service_role get_listing includes owner_id key');
SELECT is(
  public.get_listing(current_setting('test.listing_id')::uuid)->>'owner_id',
  '01501501-0000-4000-8000-000000000001',
  'service_role get_listing owner_id is the listing owner'
);
SELECT ok((SELECT elem FROM jsonb_array_elements(public.get_catalogue()) AS t(elem) WHERE elem->>'id'=current_setting('test.listing_id')) ? 'owner_id','service_role get_catalogue includes owner_id key');
SELECT ok(public.get_listing(current_setting('test.listing_id')::uuid) ? 'promo_expires_at','service_role get_listing still has promo_expires_at');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;