-- FORSIRANO POSTAVLJANJE KORISNIKA KAO VLASNIKA I ODOBRENJE UREĐAJA
-- Ova skripta će sigurno postaviti sve kako treba

BEGIN;

-- 1. Postavi korisnika kao vlasnika (FORCE)
UPDATE users
SET 
    is_owner = true,
    role = 'vlasnik',
    updated_at = NOW()
WHERE email = 'gitara.zizu@gmail.com';

-- 2. Pronađi trenutni uređaj i postavi ga kao vlasnik i approved
DO $$
DECLARE
    user_id_val TEXT;
    device_rec RECORD;
BEGIN
    SELECT id INTO user_id_val FROM users WHERE email = 'gitara.zizu@gmail.com';
    
    IF user_id_val IS NULL THEN
        RAISE EXCEPTION 'Korisnik ne postoji!';
    END IF;
    
    -- Postavi SVE uređaje kao vlasnik i approved (uključujući trenutni)
    UPDATE devices
    SET 
        role = 'vlasnik',
        status = 'approved',
        is_blocked = false,
        permissions = jsonb_build_object(
            'dashboard', true,
            'obracun', true,
            'arhiva', true,
            'cjenovnik', true,
            'profit', true,
            'profile', true,
            'admin', false
        ),
        last_login = COALESCE(last_login, NOW()),
        updated_at = NOW()
    WHERE user_id = user_id_val;
    
    RAISE NOTICE 'Ažurirano uređaja: %', ROW_COUNT;
    
    -- Ako nema uređaja, kreiraj novi (fallback)
    IF NOT EXISTS (SELECT 1 FROM devices WHERE user_id = user_id_val) THEN
        INSERT INTO devices (
            user_id,
            device_id,
            device_name,
            device_info,
            role,
            status,
            is_blocked,
            permissions,
            last_login
        ) VALUES (
            user_id_val,
            'default-device-' || user_id_val,
            'Default Device',
            '{}'::jsonb,
            'vlasnik',
            'approved',
            false,
            jsonb_build_object(
                'dashboard', true,
                'obracun', true,
                'arhiva', true,
                'cjenovnik', true,
                'profit', true,
                'profile', true,
                'admin', false
            ),
            NOW()
        );
        RAISE NOTICE 'Kreiran default uređaj';
    END IF;
END $$;

-- 3. Provjeri rezultat
SELECT 
    '=== KORISNIK ===' as info;
    
SELECT 
    id,
    email,
    role as user_role,
    is_owner,
    created_at
FROM users
WHERE email = 'gitara.zizu@gmail.com';

SELECT 
    '=== UREĐAJI ===' as info;

SELECT 
    device_id,
    device_name,
    role as device_role,
    status,
    is_blocked,
    last_login,
    created_at
FROM devices
WHERE user_id = (SELECT id FROM users WHERE email = 'gitara.zizu@gmail.com')
ORDER BY last_login DESC NULLS LAST, created_at DESC;

COMMIT;

-- Provjera finalnog stanja
SELECT 
    '=== FINALNA PROVJERA ===' as info;

SELECT 
    u.email,
    u.role as user_role,
    u.is_owner as user_is_owner,
    COUNT(d.id) as broj_uredjaja,
    COUNT(CASE WHEN d.role = 'vlasnik' THEN 1 END) as uredjaja_vlasnik,
    COUNT(CASE WHEN d.status = 'approved' THEN 1 END) as uredjaja_odobreno
FROM users u
LEFT JOIN devices d ON d.user_id = u.id
WHERE u.email = 'gitara.zizu@gmail.com'
GROUP BY u.email, u.role, u.is_owner;

