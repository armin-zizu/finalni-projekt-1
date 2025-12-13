-- Obriši sve uređaje osim trenutnog (najnovijeg) i postavi kao vlasnik
-- Ovo će obrisati sve loginove osim trenutnog

BEGIN;

-- 1. Postavi korisnika kao vlasnika
UPDATE users
SET 
    is_owner = true,
    role = 'vlasnik',
    updated_at = NOW()
WHERE email = 'gitara.zizu@gmail.com';

-- 2. Pronađi najnoviji uređaj (trenutni login)
-- Prvo vidimo sve uređaje
SELECT 
    device_id,
    device_name,
    last_login,
    created_at,
    role,
    status
FROM devices
WHERE user_id = (SELECT id FROM users WHERE email = 'gitara.zizu@gmail.com')
ORDER BY last_login DESC NULLS LAST, created_at DESC;

-- 3. Obriši SVE uređaje osim najnovijeg
DO $$
DECLARE
    user_id_val TEXT;
    keep_device_id TEXT;
BEGIN
    SELECT id INTO user_id_val FROM users WHERE email = 'gitara.zizu@gmail.com';
    
    -- Pronađi najnoviji uređaj (zadnji login ili najnoviji kreiran)
    SELECT device_id INTO keep_device_id
    FROM devices
    WHERE user_id = user_id_val
    ORDER BY 
        COALESCE(last_login, '1970-01-01'::timestamp) DESC,
        created_at DESC
    LIMIT 1;
    
    IF keep_device_id IS NOT NULL THEN
        RAISE NOTICE 'Zadržavam uređaj: %', keep_device_id;
        
        -- Obriši SVE ostale uređaje
        DELETE FROM devices
        WHERE user_id = user_id_val
        AND device_id != keep_device_id;
        
        RAISE NOTICE 'Obrisano uređaja: %', ROW_COUNT;
        
        -- Postavi zadržani uređaj kao vlasnik i approved
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
            last_login = NOW(),
            updated_at = NOW()
        WHERE user_id = user_id_val
        AND device_id = keep_device_id;
        
        RAISE NOTICE 'Uređaj postavljen kao vlasnik';
    ELSE
        RAISE NOTICE 'Nema uređaja za zadržati';
    END IF;
END $$;

-- 4. Provjeri rezultat - treba biti samo jedan uređaj
SELECT 
    u.email,
    u.role as user_role,
    u.is_owner,
    d.device_id,
    d.device_name,
    d.role as device_role,
    d.status,
    d.is_blocked,
    d.last_login
FROM users u
LEFT JOIN devices d ON d.user_id = u.id
WHERE u.email = 'gitara.zizu@gmail.com';

COMMIT;

