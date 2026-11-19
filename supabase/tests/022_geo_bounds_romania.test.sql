BEGIN;
SET search_path=public,extensions;
SELECT plan(10);

-- Romania-wide property geo CHECKs (src/lib/geo-bounds.ts ROMANIA_BBOX).

SELECT lives_ok(
  $$INSERT INTO app.properties(id,owner_id,title,description,neighborhood,exact_address,property_type,area_sqm,rooms,floor,built_year,lat,lng)
    VALUES('bbbbbbbb-0001-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','xxx','desc','nb','adr','apartment',50,2,1,2000,44.4325,26.1039)$$,
  'Bucharest accepted'
);

SELECT lives_ok(
  $$INSERT INTO app.properties(id,owner_id,title,description,neighborhood,exact_address,property_type,area_sqm,rooms,floor,built_year,lat,lng)
    VALUES('bbbbbbbb-0002-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','xxx','desc','nb','adr','apartment',50,2,1,2000,44.46,25.97)$$,
  'Ilfov Chiajna accepted'
);

SELECT lives_ok(
  $$INSERT INTO app.properties(id,owner_id,title,description,neighborhood,exact_address,property_type,area_sqm,rooms,floor,built_year,lat,lng)
    VALUES('bbbbbbbb-0003-4000-8000-000000000003','11111111-1111-4111-8111-111111111111','xxx','desc','nb','adr','apartment',50,2,1,2000,46.77,23.59)$$,
  'Cluj-Napoca accepted'
);

SELECT lives_ok(
  $$INSERT INTO app.properties(id,owner_id,title,description,neighborhood,exact_address,property_type,area_sqm,rooms,floor,built_year,lat,lng)
    VALUES('bbbbbbbb-0004-4000-8000-000000000004','11111111-1111-4111-8111-111111111111','xxx','desc','nb','adr','apartment',50,2,1,2000,44.17,28.63)$$,
  'Constanta accepted'
);

SELECT lives_ok(
  $$INSERT INTO app.properties(id,owner_id,title,description,neighborhood,exact_address,property_type,area_sqm,rooms,floor,built_year,lat,lng)
    VALUES('bbbbbbbb-0005-4000-8000-000000000005','11111111-1111-4111-8111-111111111111','xxx','desc','nb','adr','apartment',50,2,1,2000,45.16,29.65)$$,
  'Sulina accepted'
);

SELECT throws_ok(
  $$INSERT INTO app.properties(id,owner_id,title,description,neighborhood,exact_address,property_type,area_sqm,rooms,floor,built_year,lat,lng)
    VALUES('bbbbbbbb-0006-4000-8000-000000000006','11111111-1111-4111-8111-111111111111','xxx','desc','nb','adr','apartment',50,2,1,2000,47.50,19.04)$$,
  '23514',
  NULL,
  'Budapest rejected'
);

SELECT throws_ok(
  $$INSERT INTO app.properties(id,owner_id,title,description,neighborhood,exact_address,property_type,area_sqm,rooms,floor,built_year,lat,lng)
    VALUES('bbbbbbbb-0007-4000-8000-000000000007','11111111-1111-4111-8111-111111111111','xxx','desc','nb','adr','apartment',50,2,1,2000,42.70,23.32)$$,
  '23514',
  NULL,
  'Sofia rejected'
);

SELECT throws_ok(
  $$INSERT INTO app.properties(id,owner_id,title,description,neighborhood,exact_address,property_type,area_sqm,rooms,floor,built_year,lat,lng)
    VALUES('bbbbbbbb-0008-4000-8000-000000000008','11111111-1111-4111-8111-111111111111','xxx','desc','nb','adr','apartment',50,2,1,2000,48.21,16.37)$$,
  '23514',
  NULL,
  'Vienna rejected'
);

SELECT throws_ok(
  $$INSERT INTO app.properties(id,owner_id,title,description,neighborhood,exact_address,property_type,area_sqm,rooms,floor,built_year,lat,lng)
    VALUES('bbbbbbbb-0009-4000-8000-000000000009','11111111-1111-4111-8111-111111111111','xxx','desc','nb','adr','apartment',50,2,1,2000,0,0)$$,
  '23514',
  NULL,
  'null island rejected'
);

SELECT throws_ok(
  $$INSERT INTO app.properties(id,owner_id,title,description,neighborhood,exact_address,property_type,area_sqm,rooms,floor,built_year,lat,lng)
    VALUES('bbbbbbbb-0010-4000-8000-000000000010','11111111-1111-4111-8111-111111111111','xxx','desc','nb','adr','apartment',50,2,1,2000,44.40,NULL)$$,
  '23514',
  NULL,
  'lat without lng rejected'
);

SELECT * FROM finish();
ROLLBACK;