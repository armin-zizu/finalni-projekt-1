-- Postavi korisnika kao vlasnika i odobri device
-- Pokreni direktno u psql

-- 1. Postavi korisnika kao vlasnika
UPDATE users 
SET 
  is_owner = true,
  role = 'vlasnik'
WHERE email = 'gitara.zizu@gmail.com';

-- 2. Odobri sve uređaje za ovog korisnika (ako postoje)
UPDATE devices 
SET 
  is_blocked = false,
  status = 'approved',
  role = 'vlasnik'
WHERE user_id = (SELECT id FROM users WHERE email = 'gitara.zizu@gmail.com');

-- 3. Provjeri rezultat
SELECT id, email, role, is_owner 
FROM users 
WHERE email = 'gitara.zizu@gmail.com';

SELECT id, device_id, device_name, role, status, is_blocked
FROM devices 
WHERE user_id = (SELECT id FROM users WHERE email = 'gitara.zizu@gmail.com');

