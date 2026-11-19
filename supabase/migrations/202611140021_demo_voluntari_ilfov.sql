-- Correct demo Voluntari (Pipera) property judet after 019 backfill set judet = București on null rows.

UPDATE app.properties
SET judet = 'Ilfov'
WHERE id = '10000000-0000-4000-8000-000000000002'::uuid
  AND owner_id = '11111111-1111-4111-8111-111111111111'::uuid
  AND neighborhood = 'Voluntari (Ilfov)'
  AND judet IS DISTINCT FROM 'Ilfov';