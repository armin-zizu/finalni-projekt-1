-- Postavi korisnika kao vlasnika (owner)
-- Pokreni: sudo -u postgres psql -d office_app -f set-user-as-owner.sql
-- Ili direktno u psql: COPY I PASTE SQL komande

-- Postavi korisnika kao vlasnika
UPDATE users 
SET 
  is_owner = true,
  role = 'vlasnik'
WHERE email = 'gitara.zizu@gmail.com';

-- Provjeri rezultat
SELECT id, email, role, is_owner, created_at 
FROM users 
WHERE email = 'gitara.zizu@gmail.com';

