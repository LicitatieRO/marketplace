BEGIN;
SET search_path = public, extensions;
SELECT plan(6);

SELECT lives_ok(
  $$INSERT INTO app.properties(id,owner_id,title,description,neighborhood,exact_address,property_type,area_sqm,rooms,floor,built_year,judet)
    VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','11111111-1111-4111-8111-111111111111','Fixture title','Fixture description','Centru','Private fixture address 1','apartment',50,2,1,2000,'Cluj')
    ON CONFLICT (id) DO UPDATE SET judet = EXCLUDED.judet$$,
  'canonical judet Cluj accepted'
);

SELECT is(
  (SELECT judet FROM app.properties WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'),
  'Cluj',
  'judet stored with canonical casing'
);

SELECT throws_ok(
  $$INSERT INTO app.properties(id,owner_id,title,description,neighborhood,exact_address,property_type,area_sqm,rooms,floor,built_year,judet)
    VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','11111111-1111-4111-8111-111111111111','Fixture title','Fixture description','Centru','Private fixture address 2','apartment',50,2,1,2000,'Chisinau')$$,
  'P0001',
  NULL,
  'non-Romanian judet rejected'
);

SELECT lives_ok(
  $$INSERT INTO app.properties(id,owner_id,title,description,neighborhood,exact_address,property_type,area_sqm,rooms,floor,built_year,judet)
    VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3','11111111-1111-4111-8111-111111111111','Fixture title','Fixture description','Centru','Private fixture address 3','apartment',50,2,1,2000,'CLUJ')
    ON CONFLICT (id) DO UPDATE SET judet = EXCLUDED.judet$$,
  'case-normalized judet CLUJ accepted'
);

DELETE FROM app.properties
WHERE id IN (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'::uuid,
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'::uuid,
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3'::uuid
);

SELECT is(app.resolve_judet('bucuresti'), 'București', 'diacritic-free Bucuresti resolves to București');

SELECT is(app.resolve_judet('Bistrita-Nasaud'), 'Bistrița-Năsăud', 'Bistrița-Năsăud spelling and cedilla variants resolve');

SELECT * FROM finish();
ROLLBACK;