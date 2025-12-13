-- Postavi uređaj kao vlasnik (owner) - SQL script za ručno postavljanje
-- Zamijeni 'DEVICE_ID_OVDJE' sa stvarnim device_id iz baze

-- 1. Provjeri sve uređaje za korisnika
SELECT 
    d.id,
    d.device_id,
    d.device_name,
    d.role,
    d.status,
    d.is_blocked,
    u.email,
    u.is_owner as user_is_owner
FROM devices d
JOIN users u ON d.user_id = u.id
WHERE u.email = 'gitara.zizu@gmail.com';

-- 2. Postavi sve uređaje za korisnika kao vlasnik (role = 'vlasnik', status = 'approved')
UPDATE devices
SET 
    role = 'vlasnik',
    status = 'approved',
    is_blocked = false,
    updated_at = NOW()
WHERE user_id = (SELECT id FROM users WHERE email = 'gitara.zizu@gmail.com');

-- 3. Provjeri da li je korisnik već postavljen kao owner u users tabeli
SELECT id, email, role, is_owner FROM users WHERE email = 'gitara.zizu@gmail.com';

-- 4. Postavi korisnika kao owner u users tabeli (ako već nije)
UPDATE users
SET 
    is_owner = true,
    role = 'vlasnik',
    updated_at = NOW()
WHERE email = 'gitara.zizu@gmail.com';

-- 5. Finalna provjera - provjeri da su sve promjene primijenjene
SELECT 
    u.email,
    u.role as user_role,
    u.is_owner as user_is_owner,
    d.device_id,
    d.role as device_role,
    d.status as device_status,
    d.is_blocked as device_blocked
FROM users u
LEFT JOIN devices d ON d.user_id = u.id
WHERE u.email = 'gitara.zizu@gmail.com';

