-- ============================================
-- SKRIPTA ZA ODOBRAVANJE ADMIN UREĐAJA - RECOVERY
-- ============================================
-- Ova skripta omogućava odobravanje svih uređaja za admin korisnika
-- direktno kroz bazu podataka, bez potrebe za prijavom u aplikaciju.
--
-- UPUTSTVO:
-- 1. Prijavite se na PostgreSQL bazu podataka:
--    psql -h localhost -U office_user -d office_app
--
-- 2. Pokrenite ovu skriptu:
--    \i scripts/approve-admin-devices-recovery.sql
--    ILI kopirajte i zalijepite SQL komande direktno
--
-- ============================================

BEGIN;

-- Postavi admin email (promijenite ako je potrebno)
DO $$
DECLARE
    admin_email TEXT := 'gitara.zizu@gmail.com';
    admin_user_id TEXT;
    approved_count INT := 0;
    total_devices INT;
BEGIN
    -- Pronađi admin korisnika po emailu
    SELECT id INTO admin_user_id
    FROM users
    WHERE LOWER(email) = LOWER(admin_email);
    
    IF admin_user_id IS NULL THEN
        RAISE EXCEPTION 'Admin korisnik sa emailom % nije pronađen!', admin_email;
    END IF;
    
    RAISE NOTICE 'Pronađen admin korisnik: % (ID: %)', admin_email, admin_user_id;
    
    -- Postavi is_owner = true za admin korisnika (ako nije već postavljen)
    UPDATE users
    SET is_owner = TRUE,
        role = 'vlasnik',
        updated_at = NOW()
    WHERE id = admin_user_id
      AND (is_owner IS NULL OR is_owner = FALSE);
    
    IF FOUND THEN
        RAISE NOTICE 'Postavljen is_owner = true za admin korisnika';
    ELSE
        RAISE NOTICE 'is_owner je već postavljen na true';
    END IF;
    
    -- Broj ukupnih uređaja
    SELECT COUNT(*) INTO total_devices
    FROM devices
    WHERE user_id = admin_user_id;
    
    RAISE NOTICE 'Pronađeno % uređaja za admin korisnika', total_devices;
    
    -- Odobri sve uređaje za admin korisnika
    UPDATE devices
    SET status = 'approved',
        role = 'vlasnik',
        is_blocked = FALSE,
        permissions = '{
            "dashboard": true,
            "obracun": true,
            "arhiva": true,
            "cjenovnik": true,
            "profit": true,
            "profile": true,
            "admin": true
        }'::jsonb,
        updated_at = NOW()
    WHERE user_id = admin_user_id
      AND (
          status IS NULL OR
          status != 'approved' OR
          role IS NULL OR
          role != 'vlasnik' OR
          is_blocked = TRUE
      );
    
    GET DIAGNOSTICS approved_count = ROW_COUNT;
    
    RAISE NOTICE 'Odobreno % uređaja', approved_count;
    RAISE NOTICE 'Ukupno uređaja: %', total_devices;
    
END $$;

-- Provjeri rezultate
SELECT 
    d.device_id,
    d.device_name,
    d.status,
    d.role,
    d.is_blocked,
    d.last_login
FROM devices d
INNER JOIN users u ON d.user_id = u.id
WHERE LOWER(u.email) = LOWER('gitara.zizu@gmail.com')
ORDER BY d.created_at DESC;

COMMIT;

-- ============================================
-- ALTERNATIVNO: Odobri samo specifičan uređaj po device_id
-- ============================================
-- Ako znate device_id, možete odobriti samo taj uređaj:
--
-- UPDATE devices
-- SET status = 'approved',
--     role = 'vlasnik',
--     is_blocked = FALSE,
--     updated_at = NOW()
-- WHERE user_id = (SELECT id FROM users WHERE LOWER(email) = LOWER('gitara.zizu@gmail.com'))
--   AND device_id = 'VAŠ_DEVICE_ID_OVDJE';
--
-- ============================================

