-- ============================================
-- QUICK DEVICE APPROVAL - Brzi upit za odobravanje uređaja
-- ============================================
-- Ova skripta omogućava brzo pronalaženje i odobravanje uređaja
--
-- UPUTSTVO:
-- 1. Pronađite email korisnika ili device_id
-- 2. Pokrenite odgovarajući upit
-- ============================================

-- ============================================
-- KORAK 1: PRONAĐITE KORISNIKA
-- ============================================

-- Prikaži sve korisnike
SELECT 
    id,
    email,
    role,
    is_owner,
    created_at
FROM users
ORDER BY created_at DESC;

-- Pronađite korisnika po emailu (promijenite email)
-- SELECT id, email, role, is_owner 
-- FROM users 
-- WHERE LOWER(email) = LOWER('korisnik@email.com');


-- ============================================
-- KORAK 2: PRONAĐITE UREĐAJE KORISNIKA
-- ============================================

-- Prikaži sve uređaje određenog korisnika (PROMIJENITE EMAIL!)
-- SELECT 
--     d.id,
--     d.device_id,
--     d.device_name,
--     d.status,
--     d.role,
--     d.is_blocked,
--     d.last_login,
--     d.created_at
-- FROM devices d
-- INNER JOIN users u ON d.user_id = u.id
-- WHERE LOWER(u.email) = LOWER('korisnik@email.com')
-- ORDER BY d.created_at DESC;

-- Prikaži uređaje koji čekaju verifikaciju
SELECT 
    u.email,
    d.device_id,
    d.device_name,
    d.status,
    d.role,
    d.created_at
FROM devices d
INNER JOIN users u ON d.user_id = u.id
WHERE d.status = 'verifikacija' OR d.status IS NULL
ORDER BY d.created_at DESC;


-- ============================================
-- KORAK 3: ODOBRI UREĐAJ
-- ============================================

-- OPCIJA A: Odobri specifičan uređaj (PROMIJENITE EMAIL I DEVICE_ID!)
-- BEGIN;
-- 
-- UPDATE devices
-- SET status = 'approved',
--     role = 'vlasnik',
--     is_blocked = FALSE,
--     permissions = '{
--         "dashboard": true,
--         "obracun": true,
--         "arhiva": true,
--         "cjenovnik": true,
--         "profit": true,
--         "profile": true,
--         "admin": true
--     }'::jsonb,
--     updated_at = NOW()
-- WHERE device_id = 'DEVICE_ID_OVDJE'
--   AND user_id = (SELECT id FROM users WHERE LOWER(email) = LOWER('EMAIL_OVDJE'));
-- 
-- -- Provjeri rezultat
-- SELECT device_id, device_name, status, role, is_blocked
-- FROM devices
-- WHERE device_id = 'DEVICE_ID_OVDJE';
-- 
-- COMMIT;


-- OPCIJA B: Odobri sve uređaje korisnika (PROMIJENITE EMAIL!)
-- BEGIN;
-- 
-- UPDATE devices
-- SET status = 'approved',
--     role = 'vlasnik',
--     is_blocked = FALSE,
--     permissions = '{
--         "dashboard": true,
--         "obracun": true,
--         "arhiva": true,
--         "cjenovnik": true,
--         "profit": true,
--         "profile": true,
--         "admin": true
--     }'::jsonb,
--     updated_at = NOW()
-- WHERE user_id = (SELECT id FROM users WHERE LOWER(email) = LOWER('EMAIL_OVDJE'))
--   AND (
--       status IS NULL OR
--       status != 'approved' OR
--       role IS NULL OR
--       role != 'vlasnik' OR
--       is_blocked = TRUE
--   );
-- 
-- -- Provjeri rezultate
-- SELECT device_id, device_name, status, role, is_blocked
-- FROM devices
-- WHERE user_id = (SELECT id FROM users WHERE LOWER(email) = LOWER('EMAIL_OVDJE'));
-- 
-- COMMIT;


-- OPCIJA C: Odobri sve uređaje koji čekaju verifikaciju (OPREZNO!)
-- BEGIN;
-- 
-- UPDATE devices
-- SET status = 'approved',
--     is_blocked = FALSE,
--     updated_at = NOW()
-- WHERE status = 'verifikacija' OR status IS NULL;
-- 
-- SELECT COUNT(*) as approved_count FROM devices WHERE status = 'approved';
-- 
-- COMMIT;


-- ============================================
-- KORAK 4: PROVJERA REZULTATA
-- ============================================

-- Provjeri status uređaja nakon odobravanja
-- SELECT 
--     u.email,
--     d.device_id,
--     d.device_name,
--     d.status,
--     d.role,
--     d.is_blocked
-- FROM devices d
-- INNER JOIN users u ON d.user_id = u.id
-- WHERE LOWER(u.email) = LOWER('EMAIL_OVDJE')
-- ORDER BY d.created_at DESC;

