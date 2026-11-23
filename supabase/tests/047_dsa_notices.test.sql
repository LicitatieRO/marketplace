BEGIN;
SET search_path=public,extensions;
SELECT no_plan();
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
 ('68686868-0000-4000-8000-000000000001','dsa-reporter@example.test',now()),
 ('68686868-0000-4000-8000-000000000002','dsa-staff@example.test',now());
UPDATE app.profiles SET is_staff=true WHERE id='68686868-0000-4000-8000-000000000002';
SELECT set_config('request.jwt.claims','{"sub":"68686868-0000-4000-8000-000000000001","role":"authenticated"}',true);
INSERT INTO app.properties(
 id,owner_id,title,description,neighborhood,exact_address,property_type,area_sqm,rooms,floor,built_year,judet
) VALUES (
 '68686868-0000-4000-8000-00000000f001',
 '68686868-0000-4000-8000-000000000001',
 'DSA notice fixture property',
 'Deterministic property for DSA notice pgTAP coverage.',
 'Cotroceni',
 '1 DSA Fixture Street',
 'apartment',
 50,
 2,
 3,
 1990,
 'București'
) ON CONFLICT (id) DO NOTHING;
INSERT INTO app.listings(
 id,property_id,owner_id,transaction_type,price_minor,status
) VALUES (
 '68686868-0000-4000-8000-00000000f002',
 '68686868-0000-4000-8000-00000000f001',
 '68686868-0000-4000-8000-000000000001',
 'sale',
 20000000,
 'published'
) ON CONFLICT (id) DO NOTHING;
SELECT set_config('test.dsa_listing','68686868-0000-4000-8000-00000000f002',true);
SET ROLE service_role;
SELECT set_config('test.dsa_notice',(
 (public.submit_dsa_notice(
  current_setting('test.dsa_listing')::uuid,
  'https://example.test/listings/'||current_setting('test.dsa_listing'),
  'description',
  'fraud',
  'This listing appears to misstate the legal status of the property involved.',
  'Reporter',
  'reporter@example.test',
  true
 ))->>'id'),
 true
);
SELECT isnt(current_setting('test.dsa_notice',true),NULL,'service role can submit a notice');
SELECT lives_ok($$SELECT public.submit_dsa_notice(
 current_setting('test.dsa_listing')::uuid,
 'https://example.test/listings/'||current_setting('test.dsa_listing'),
 'description',
 'csam',
 'Anonymous report with enough explanatory detail included.',
 NULL,
 NULL,
 true
)$$,'CSAM notice allows anonymous notifier fields');
SELECT set_config('test.dsa_csam',(
 (public.submit_dsa_notice(
  current_setting('test.dsa_listing')::uuid,
  'https://example.test/listings/'||current_setting('test.dsa_listing'),
  'description',
  'csam',
  'Supplied identity must not be stored for CSAM notices anyway.',
  'Should Not Store',
  'hide@example.test',
  true
 ))->>'id'
),true);
SELECT throws_ok($$SELECT public.submit_dsa_notice(
 current_setting('test.dsa_listing')::uuid,
 'https://example.test/listings/'||current_setting('test.dsa_listing'),
 'description',
 'fraud',
 'Too short.',
 'Reporter',
 'reporter@example.test',
 true
)$$,'23514',NULL,'explanation length check enforced');
SELECT throws_ok($$SELECT public.submit_dsa_notice(
 current_setting('test.dsa_listing')::uuid,
 'https://example.test/listings/'||current_setting('test.dsa_listing'),
 'description',
 'fraud',
 'Missing notifier identity should fail for non-CSAM reasons.',
 NULL,
 NULL,
 true
)$$,'23514',NULL,'non-CSAM requires notifier identity');
SELECT throws_ok($$SELECT public.submit_dsa_notice(
 current_setting('test.dsa_listing')::uuid,
 'https://example.test/listings/'||current_setting('test.dsa_listing'),
 'description',
 'fraud',
 'Good faith must be true for every submitted notice here.',
 'Reporter',
 'reporter@example.test',
 false
)$$,'P0001','Good faith confirmation required','good faith must be true');
RESET ROLE;
SELECT ok(NOT has_table_privilege('anon','app.dsa_notices','SELECT'),'anon cannot read DSA notices');
SELECT ok(NOT has_table_privilege('authenticated','app.dsa_notices','SELECT'),'authenticated cannot read DSA notices');
SELECT ok(NOT has_function_privilege('anon','public.submit_dsa_notice(uuid,text,text,text,text,text,text,boolean)','EXECUTE'),'anon cannot execute submit DSA notice');
SELECT ok(NOT has_function_privilege('authenticated','public.submit_dsa_notice(uuid,text,text,text,text,text,text,boolean)','EXECUTE'),'authenticated cannot execute submit DSA notice');
SELECT set_config('request.jwt.claims','{"sub":"68686868-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
SELECT throws_ok('SELECT public.list_dsa_notices('''',''all'',10)','P0001','Staff MFA required','non-staff cannot list notices');
SELECT set_config('request.jwt.claims','{"sub":"68686868-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
SELECT throws_ok('SELECT public.list_dsa_notices('''',''all'',10)','P0001','Staff MFA required','staff without MFA cannot list notices');
SELECT set_config('request.jwt.claims','{"sub":"68686868-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
SET ROLE service_role;
SELECT lives_ok($$SELECT public.submit_dsa_notice(
 current_setting('test.dsa_listing')::uuid,
 'https://example.test/listings/'||current_setting('test.dsa_listing'),
 'whole_listing',
 'terms_breach',
 'This listing breaches platform terms on promotional claims and contact details.',
 'Terms reporter',
 'terms@example.test',
 true
)$$,'terms breach notices can be submitted');
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"68686868-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
SELECT is(jsonb_array_length(public.list_dsa_notices('','all',10)),4,'staff MFA can list notices');
SELECT is(jsonb_array_length(public.list_dsa_notices('','art16',10)),3,'art16 queue excludes terms breach');
SELECT is(jsonb_array_length(public.list_dsa_notices('','terms_breach',10)),1,'terms breach section is separate from art.16 queue');
SELECT ok(public.get_dsa_notice(current_setting('test.dsa_notice')::uuid) ? 'notifier_email','founder detail includes notifier identity');
SELECT is(public.get_dsa_notice(current_setting('test.dsa_csam')::uuid)->>'notifier_name',NULL,'CSAM path stores NULL notifier name even when supplied');
SELECT is(public.get_dsa_notice(current_setting('test.dsa_csam')::uuid)->>'notifier_email',NULL,'CSAM path stores NULL notifier email even when supplied');
SELECT lives_ok(format($u$
 SELECT public.update_dsa_notice(
  %L,
  'decided',
  'no_action',
  'Reviewed the listing description and supporting details from the notice.',
  'legal',
  'Law 123/2000',
  NULL,
  false,
  false,
  'Notifier email body',
  'Owner statement body'
 )
$u$,current_setting('test.dsa_notice')),'founder can record decision');
SELECT * FROM finish();
ROLLBACK;
