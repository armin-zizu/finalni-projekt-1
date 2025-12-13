-- Migriraj korisnika sa "admin-user" ID-jem na UUID
-- Ovo je sigurno rješenje koje:
-- 1. Provjerava da li korisnik postoji
-- 2. Kreira novog korisnika sa UUID-om
-- 3. Migrira sve podatke
-- 4. Briše starog korisnika

BEGIN;

-- Provjeri da li korisnik sa "admin-user" ID-jem postoji
DO $$
DECLARE
    old_user_id TEXT := 'admin-user';
    new_user_id UUID;
    user_email TEXT;
BEGIN
    -- Provjeri da li postoji korisnik sa "admin-user" ID-jem
    IF EXISTS (SELECT 1 FROM users WHERE id::text = old_user_id) THEN
        -- Dohvati email korisnika
        SELECT email INTO user_email FROM users WHERE id::text = old_user_id;
        
        RAISE NOTICE 'Pronađen korisnik sa ID-jem: %, email: %', old_user_id, user_email;
        
        -- Provjeri da li već postoji korisnik sa istim email-om i UUID id-jem
        IF EXISTS (SELECT 1 FROM users WHERE email = user_email AND id::text != old_user_id) THEN
            RAISE NOTICE 'Korisnik sa email-om % već postoji sa UUID id-jem. Koristi se postojeći UUID.', user_email;
            SELECT id INTO new_user_id FROM users WHERE email = user_email AND id::text != old_user_id LIMIT 1;
        ELSE
            -- Kreiraj novog korisnika sa UUID-om
            INSERT INTO users (id, email, password_hash, role, is_owner, app_name, permissions, created_at, updated_at)
            SELECT 
                gen_random_uuid(),
                email,
                password_hash,
                role,
                is_owner,
                app_name,
                permissions,
                created_at,
                updated_at
            FROM users
            WHERE id::text = old_user_id
            RETURNING id INTO new_user_id;
            
            RAISE NOTICE 'Kreiran novi korisnik sa UUID id-jem: %', new_user_id;
        END IF;
        
        -- Migriraj devices
        UPDATE devices 
        SET user_id = new_user_id
        WHERE user_id::text = old_user_id;
        
        RAISE NOTICE 'Migrirano devices zapisa: %', ROW_COUNT;
        
        -- Migriraj obracuni
        UPDATE obracuni 
        SET user_id = new_user_id
        WHERE user_id::text = old_user_id;
        
        RAISE NOTICE 'Migrirano obracuni zapisa: %', ROW_COUNT;
        
        -- Migriraj cjenovnik
        UPDATE cjenovnik 
        SET user_id = new_user_id
        WHERE user_id::text = old_user_id;
        
        RAISE NOTICE 'Migrirano cjenovnik zapisa: %', ROW_COUNT;
        
        -- Migriraj sessions
        UPDATE sessions 
        SET user_id = new_user_id
        WHERE user_id::text = old_user_id;
        
        RAISE NOTICE 'Migrirano sessions zapisa: %', ROW_COUNT;
        
        -- Migriraj payments
        UPDATE payments 
        SET user_id = new_user_id
        WHERE user_id::text = old_user_id;
        
        RAISE NOTICE 'Migrirano payments zapisa: %', ROW_COUNT;
        
        -- Migriraj subscriptions
        UPDATE subscriptions 
        SET user_id = new_user_id
        WHERE user_id::text = old_user_id;
        
        RAISE NOTICE 'Migrirano subscriptions zapisa: %', ROW_COUNT;
        
        -- Migriraj file_uploads
        UPDATE file_uploads 
        SET user_id = new_user_id
        WHERE user_id::text = old_user_id;
        
        RAISE NOTICE 'Migrirano file_uploads zapisa: %', ROW_COUNT;
        
        -- Obriši starog korisnika
        DELETE FROM users WHERE id::text = old_user_id;
        
        RAISE NOTICE 'Obrisan stari korisnik sa ID-jem: %', old_user_id;
        
    ELSE
        RAISE NOTICE 'Korisnik sa ID-jem % ne postoji. Migracija nije potrebna.', old_user_id;
    END IF;
END $$;

-- Provjeri rezultat
SELECT 
    u.id,
    u.email,
    u.role,
    u.is_owner,
    COUNT(DISTINCT d.id) as devices_count,
    COUNT(DISTINCT o.id) as obracuni_count
FROM users u
LEFT JOIN devices d ON d.user_id = u.id
LEFT JOIN obracuni o ON o.user_id = u.id
WHERE u.email = 'gitara.zizu@gmail.com'
GROUP BY u.id, u.email, u.role, u.is_owner;

COMMIT;

