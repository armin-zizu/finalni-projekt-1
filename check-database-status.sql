-- Provjeri strukturu tabele users
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

-- Provjeri strukturu tabele obracuni
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'obracuni' 
ORDER BY ordinal_position;

-- Provjeri korisnike i njihove ID-jeve
SELECT id, email, role, is_owner, created_at 
FROM users 
ORDER BY created_at;

-- Provjeri da li postoji korisnik sa "admin-user" ID-jem
SELECT id, email, role, is_owner 
FROM users 
WHERE id = 'admin-user' OR id::text = 'admin-user';

