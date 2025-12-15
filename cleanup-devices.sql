-- Cleanup devices script
-- Ovaj script:
-- 1. Pronalazi korisnika gitara.zizu@gmail.com
-- 2. Pronalazi trenutni uređaj (Chrome na Linux)
-- 3. Briše sve ostale uređaje za tog korisnika
-- 4. Postavlja trenutni uređaj kao vlasnik

-- Korak 1: Pronađi korisnika
DO $$
DECLARE
    v_user_id UUID;
    v_device_id VARCHAR(255);
    v_device_uuid UUID;
BEGIN
    -- Pronađi user ID
    SELECT id INTO v_user_id
    FROM users
    WHERE LOWER(email) = LOWER('gitara.zizu@gmail.com');
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Korisnik gitara.zizu@gmail.com nije pronađen';
    END IF;
    
    RAISE NOTICE 'Pronađen korisnik: %', v_user_id;
    
    -- Korak 2: Pronađi trenutni uređaj (Chrome na Linux)
    -- Traži uređaj gdje device_info->>'browser' = 'Chrome' i device_info->>'os' = 'Linux'
    SELECT d.device_id, d.id INTO v_device_id, v_device_uuid
    FROM devices d
    WHERE d.user_id = v_user_id
      AND d.device_info->>'browser' = 'Chrome'
      AND d.device_info->>'os' = 'Linux'
    ORDER BY d.last_login DESC NULLS LAST, d.created_at DESC
    LIMIT 1;
    
    IF v_device_id IS NULL THEN
        RAISE EXCEPTION 'Trenutni uređaj (Chrome na Linux) nije pronađen za korisnika';
    END IF;
    
    RAISE NOTICE 'Pronađen trenutni uređaj: % (UUID: %)', v_device_id, v_device_uuid;
    
    -- Korak 3: Obriši sve ostale uređaje (sve osim trenutnog)
    DELETE FROM devices
    WHERE user_id = v_user_id
      AND device_id != v_device_id;
    
    RAISE NOTICE 'Obrisani svi ostali uređaji za korisnika';
    
    -- Korak 4: Postavi trenutni uređaj kao vlasnik
    UPDATE devices
    SET 
        role = 'vlasnik',
        status = 'approved',
        is_blocked = FALSE,
        permissions = jsonb_build_object(
            'dashboard', true,
            'obracun', true,
            'arhiva', true,
            'cjenovnik', true,
            'profit', true,
            'profile', true,
            'admin', true
        ),
        last_login = NOW(),
        updated_at = NOW()
    WHERE device_id = v_device_id
      AND user_id = v_user_id;
    
    RAISE NOTICE 'Trenutni uređaj postavljen kao vlasnik sa svim dozvolama';
    
    -- Prikaži rezultat
    RAISE NOTICE '';
    RAISE NOTICE '=== REZULTAT ===';
    RAISE NOTICE 'Ostao je samo jedan uređaj:';
    RAISE NOTICE '  Device ID: %', v_device_id;
    RAISE NOTICE '  Role: vlasnik';
    RAISE NOTICE '  Status: approved';
    RAISE NOTICE '  Admin: true';
    
END $$;

-- Prikaži finalni status uređaja
SELECT 
    d.device_id,
    d.device_name,
    d.device_info->>'browser' as browser,
    d.device_info->>'os' as os,
    d.role,
    d.status,
    d.is_blocked,
    d.permissions->>'admin' as admin_permission,
    d.last_login,
    u.email
FROM devices d
JOIN users u ON d.user_id = u.id
WHERE LOWER(u.email) = LOWER('gitara.zizu@gmail.com')
ORDER BY d.created_at DESC;

