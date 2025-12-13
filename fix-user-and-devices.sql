-- Obriši sve uređaje osim trenutnog i postavi korisnika kao vlasnika
-- Ova skripta:
-- 1. Postavlja korisnika kao vlasnika
-- 2. Briše sve uređaje osim trenutnog (Chrome)
-- 3. Postavlja trenutni uređaj kao vlasnik i approved

BEGIN;

-- 1. Postavi korisnika kao vlasnika
UPDATE users
SET 
    is_owner = true,
    role = 'vlasnik',
    updated_at = NOW()
WHERE email = 'gitara.zizu@gmail.com';

RAISE NOTICE 'Korisnik postavljen kao vlasnik';

-- 2. Pronađi trenutni uređaj (Chrome) - trebaš znati device_id
-- Za sada ću obrisati sve uređaje osim onih koji imaju status 'approved' i role 'vlasnik'
-- Možda bolje prvo vidjeti sve uređaje, pa onda obrisati one koje ne trebamo

-- Provjeri sve uređaje
DO $$
DECLARE
    user_id_val TEXT;
    device_rec RECORD;
    chrome_device_id TEXT := NULL;
BEGIN
    -- Pronađi user_id
    SELECT id INTO user_id_val FROM users WHERE email = 'gitara.zizu@gmail.com';
    
    IF user_id_val IS NULL THEN
        RAISE EXCEPTION 'Korisnik sa email-om gitara.zizu@gmail.com ne postoji';
    END IF;
    
    RAISE NOTICE 'Korisnik ID: %', user_id_val;
    
    -- Pronađi Chrome uređaj (pretpostavljamo da ima "Chrome" u device_info ili device_name)
    SELECT device_id INTO chrome_device_id
    FROM devices
    WHERE user_id = user_id_val
    AND (
        device_name ILIKE '%Chrome%' OR
        device_info::text ILIKE '%Chrome%' OR
        device_id IN (
            SELECT device_id 
            FROM devices 
            WHERE user_id = user_id_val 
            ORDER BY last_login DESC NULLS LAST, created_at DESC
            LIMIT 1
        )
    )
    ORDER BY last_login DESC NULLS LAST, created_at DESC
    LIMIT 1;
    
    IF chrome_device_id IS NULL THEN
        -- Ako nema Chrome uređaja, uzmi najnoviji uređaj
        SELECT device_id INTO chrome_device_id
        FROM devices
        WHERE user_id = user_id_val
        ORDER BY last_login DESC NULLS LAST, created_at DESC
        LIMIT 1;
    END IF;
    
    IF chrome_device_id IS NULL THEN
        RAISE NOTICE 'Nema uređaja za brisanje';
    ELSE
        RAISE NOTICE 'Zadržavam uređaj: %', chrome_device_id;
        
        -- Obriši sve uređaje osim trenutnog
        DELETE FROM devices
        WHERE user_id = user_id_val
        AND device_id != chrome_device_id;
        
        RAISE NOTICE 'Obrisano uređaja: %', ROW_COUNT;
        
        -- Postavi trenutni uređaj kao vlasnik i approved
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
            updated_at = NOW()
        WHERE user_id = user_id_val
        AND device_id = chrome_device_id;
        
        RAISE NOTICE 'Trenutni uređaj postavljen kao vlasnik i approved';
    END IF;
END $$;

-- 3. Provjeri rezultat
SELECT 
    u.email,
    u.role as user_role,
    u.is_owner,
    d.device_id,
    d.device_name,
    d.role as device_role,
    d.status,
    d.is_blocked
FROM users u
LEFT JOIN devices d ON d.user_id = u.id
WHERE u.email = 'gitara.zizu@gmail.com';

COMMIT;

