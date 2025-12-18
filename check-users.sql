-- Proveri broj korisnika u bazi podataka

-- Ukupan broj korisnika
SELECT COUNT(*) as ukupan_broj_korisnika FROM users;

-- Detaljni pregled korisnika
SELECT 
    id,
    email,
    app_name,
    role,
    is_owner,
    created_at,
    updated_at
FROM users
ORDER BY created_at DESC;

-- Broj korisnika po ulogama
SELECT 
    role,
    COUNT(*) as broj_korisnika
FROM users
GROUP BY role
ORDER BY broj_korisnika DESC;

-- Broj vlasnika
SELECT COUNT(*) as broj_vlasnika 
FROM users 
WHERE role = 'vlasnik' OR is_owner = true;

-- Broj konobara
SELECT COUNT(*) as broj_konobara 
FROM users 
WHERE role = 'konobar';

-- Korisnici sa pretplatama
SELECT 
    u.id,
    u.email,
    u.app_name,
    u.role,
    s.status,
    s.is_active,
    s.end_date
FROM users u
LEFT JOIN subscriptions s ON u.id = s.user_id
ORDER BY u.created_at DESC;

