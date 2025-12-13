# Fix User ID from TEXT to UUID

## Problem
Korisnik u bazi ima `id` = "admin-user" (TEXT) umjesto UUID-a, što uzrokuje greške jer:
1. JWT token sadrži "admin-user" umjesto UUID-a
2. Tabele `devices`, `obracuni`, itd. očekuju UUID `user_id`
3. API endpointi validiraju UUID format i odbijaju "admin-user"

## Rješenje

### Korak 1: Provjeri trenutno stanje

```bash
sudo -u postgres psql -d office_app -f ~/check-database-status.sql
```

### Korak 2: Provjeri strukturu tabela

```bash
sudo -u postgres psql -d office_app -c "\d users"
sudo -u postgres psql -d office_app -c "\d obracuni"
```

### Korak 3: Ako korisnik ima TEXT id, migriraj ga

**Opcija A: Ako users.id je već UUID tip, ali korisnik ima TEXT vrijednost**

```sql
-- Provjeri da li postoji korisnik sa "admin-user"
SELECT id, email FROM users WHERE id::text = 'admin-user';

-- Ako postoji, možda trebamo kreirati novog korisnika sa UUID-om
-- ili ažurirati postojećeg ako može
```

**Opcija B: Ako users.id je TEXT tip, moramo migrirati**

```sql
-- 1. Kreiraj novog korisnika sa UUID-om
INSERT INTO users (id, email, password_hash, role, is_owner, app_name)
SELECT 
    gen_random_uuid(),
    email,
    password_hash,
    role,
    is_owner,
    app_name
FROM users
WHERE id = 'admin-user'
RETURNING id, email;

-- 2. Ažuriraj devices da koriste novi UUID
UPDATE devices 
SET user_id = (SELECT id FROM users WHERE email = 'gitara.zizu@gmail.com' AND id::text != 'admin-user')
WHERE user_id = 'admin-user';

-- 3. Ažuriraj obracuni da koriste novi UUID
UPDATE obracuni 
SET user_id = (SELECT id FROM users WHERE email = 'gitara.zizu@gmail.com' AND id::text != 'admin-user')
WHERE user_id = 'admin-user';

-- 4. Ažuriraj ostale tabele (cjenovnik, sessions, itd.)
UPDATE cjenovnik 
SET user_id = (SELECT id FROM users WHERE email = 'gitara.zizu@gmail.com' AND id::text != 'admin-user')
WHERE user_id = 'admin-user';

-- 5. Obriši starog korisnika
DELETE FROM users WHERE id = 'admin-user';
```

### Korak 4: Provjeri da sve radi

```sql
-- Provjeri korisnika
SELECT id, email, role, is_owner FROM users WHERE email = 'gitara.zizu@gmail.com';

-- Provjeri devices
SELECT device_id, role, status FROM devices 
WHERE user_id = (SELECT id FROM users WHERE email = 'gitara.zizu@gmail.com');

-- Provjeri obracuni
SELECT COUNT(*) as broj_obracuna FROM obracuni 
WHERE user_id = (SELECT id FROM users WHERE email = 'gitara.zizu@gmail.com');
```

## Alternativno: Promijeni tip kolone users.id u UUID (ako nije već)

```sql
-- Provjeri trenutni tip
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'id';

-- Ako je TEXT, migriraj na UUID (OPASNO - samo ako nema podataka!)
-- ALTER TABLE users ALTER COLUMN id TYPE UUID USING id::uuid;
```

