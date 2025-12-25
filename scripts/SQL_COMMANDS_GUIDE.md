# 📘 SQL Komande - Vodič za Upravljanje Korisnicima i Uređajima

Ovaj vodič sadrži sve potrebne SQL komande za upravljanje korisnicima i uređajima direktno kroz bazu podataka.

---

## 🔐 1. PRIJAVA U BAZU PODATAKA

### Preko komandne linije (psql):

```bash
psql -h 46.224.115.49 -U office_user -d office_app
```

(Unesite lozinku kada se zatraži)

### Alternativno sa lozinkom u komandi (manje sigurno):

```bash
PGPASSWORD='vaša_lozinka' psql -h 46.224.115.49 -U office_user -d office_app
```

### Provjera konekcije:

```sql
SELECT version();
SELECT current_database();
SELECT current_user;
```

---

## 👥 2. PREGLED SVIH KORISNIKA

### Prikaži sve korisnike sa osnovnim informacijama:

```sql
SELECT 
    id,
    email,
    role,
    is_owner,
    created_at,
    updated_at
FROM users
ORDER BY created_at DESC;
```

### Detaljniji pregled korisnika:

```sql
SELECT 
    id,
    email,
    app_name,
    role,
    is_owner,
    permissions,
    created_at,
    updated_at
FROM users
ORDER BY created_at DESC;
```

### Pronađi korisnika po emailu:

```sql
SELECT 
    id,
    email,
    role,
    is_owner,
    created_at
FROM users
WHERE LOWER(email) = LOWER('korisnik@email.com');
```

### Provjeri da li korisnik postoji:

```sql
SELECT EXISTS(
    SELECT 1 
    FROM users 
    WHERE LOWER(email) = LOWER('korisnik@email.com')
) AS user_exists;
```

### Broj korisnika:

```sql
SELECT COUNT(*) as total_users FROM users;
```

### Korisnici koji su vlasnici (is_owner = true):

```sql
SELECT 
    id,
    email,
    role,
    created_at
FROM users
WHERE is_owner = TRUE
ORDER BY created_at DESC;
```

---

## 📱 3. PREGLED UREĐAJA KORISNIKA

### Prikaži sve uređaje određenog korisnika (po emailu):

```sql
SELECT 
    d.id,
    d.device_id,
    d.device_name,
    d.status,
    d.role,
    d.is_blocked,
    d.last_login,
    d.created_at,
    d.updated_at,
    u.email as user_email
FROM devices d
INNER JOIN users u ON d.user_id = u.id
WHERE LOWER(u.email) = LOWER('korisnik@email.com')
ORDER BY d.created_at DESC;
```

### Prikaži sve uređaje određenog korisnika (po user_id):

```sql
SELECT 
    d.id,
    d.device_id,
    d.device_name,
    d.status,
    d.role,
    d.is_blocked,
    d.last_login,
    d.created_at,
    d.device_info
FROM devices d
WHERE d.user_id = 'user-uuid-ovdje'
ORDER BY d.created_at DESC;
```

### Prikaži sve uređaje svih korisnika:

```sql
SELECT 
    u.email,
    d.device_id,
    d.device_name,
    d.status,
    d.role,
    d.is_blocked,
    d.last_login,
    d.created_at
FROM devices d
INNER JOIN users u ON d.user_id = u.id
ORDER BY d.created_at DESC;
```

### Uređaji koji čekaju verifikaciju:

```sql
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
```

### Uređaji koji su blokirani:

```sql
SELECT 
    u.email,
    d.device_id,
    d.device_name,
    d.status,
    d.role,
    d.is_blocked,
    d.created_at
FROM devices d
INNER JOIN users u ON d.user_id = u.id
WHERE d.is_blocked = TRUE
ORDER BY d.created_at DESC;
```

### Broj uređaja po korisniku:

```sql
SELECT 
    u.email,
    COUNT(d.id) as device_count,
    COUNT(CASE WHEN d.status = 'approved' THEN 1 END) as approved_count,
    COUNT(CASE WHEN d.status = 'verifikacija' THEN 1 END) as pending_count,
    COUNT(CASE WHEN d.is_blocked = TRUE THEN 1 END) as blocked_count
FROM users u
LEFT JOIN devices d ON u.id = d.user_id
GROUP BY u.email
ORDER BY device_count DESC;
```

### Pronađi uređaj po device_id:

```sql
SELECT 
    d.*,
    u.email as user_email
FROM devices d
INNER JOIN users u ON d.user_id = u.id
WHERE d.device_id = 'device-id-ovdje';
```

---

## ✅ 4. ODOBRAVANJE UREĐAJA

### Odobri specifičan uređaj (po device_id i user emailu):

```sql
BEGIN;

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
WHERE device_id = 'device-id-ovdje'
  AND user_id = (SELECT id FROM users WHERE LOWER(email) = LOWER('korisnik@email.com'));

-- Provjeri rezultat
SELECT 
    device_id,
    device_name,
    status,
    role,
    is_blocked
FROM devices
WHERE device_id = 'device-id-ovdje';

COMMIT;
```

### Odobri sve uređaje određenog korisnika:

```sql
BEGIN;

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
WHERE user_id = (SELECT id FROM users WHERE LOWER(email) = LOWER('korisnik@email.com'))
  AND (
      status IS NULL OR
      status != 'approved' OR
      role IS NULL OR
      role != 'vlasnik' OR
      is_blocked = TRUE
  );

-- Provjeri rezultate
SELECT 
    device_id,
    device_name,
    status,
    role,
    is_blocked
FROM devices
WHERE user_id = (SELECT id FROM users WHERE LOWER(email) = LOWER('korisnik@email.com'))
ORDER BY created_at DESC;

COMMIT;
```

### Odobri sve uređaje koji čekaju verifikaciju:

```sql
BEGIN;

UPDATE devices
SET status = 'approved',
    is_blocked = FALSE,
    updated_at = NOW()
WHERE status = 'verifikacija' OR status IS NULL;

-- Provjeri koliko je uređaja odobreno
SELECT COUNT(*) as approved_count
FROM devices
WHERE status = 'approved';

COMMIT;
```

### Postavi korisnika kao vlasnika i odobri sve njegove uređaje:

```sql
BEGIN;

-- Postavi korisnika kao vlasnika
UPDATE users
SET is_owner = TRUE,
    role = 'vlasnik',
    updated_at = NOW()
WHERE LOWER(email) = LOWER('korisnik@email.com');

-- Odobri sve uređaje
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
WHERE user_id = (SELECT id FROM users WHERE LOWER(email) = LOWER('korisnik@email.com'));

COMMIT;
```

### Odobri uređaj sa ulogom "konobar" (sa ograničenim permisijama):

```sql
BEGIN;

UPDATE devices
SET status = 'approved',
    role = 'konobar',
    is_blocked = FALSE,
    permissions = '{
        "dashboard": true,
        "obracun": true,
        "cjenovnik": true,
        "profile": true
    }'::jsonb,
    updated_at = NOW()
WHERE device_id = 'device-id-ovdje'
  AND user_id = (SELECT id FROM users WHERE LOWER(email) = LOWER('korisnik@email.com'));

COMMIT;
```

---

## 🚫 5. BLOKIRANJE UREĐAJA

### Blokiraj specifičan uređaj:

```sql
UPDATE devices
SET is_blocked = TRUE,
    updated_at = NOW()
WHERE device_id = 'device-id-ovdje'
  AND user_id = (SELECT id FROM users WHERE LOWER(email) = LOWER('korisnik@email.com'));
```

### Blokiraj sve uređaje određenog korisnika:

```sql
UPDATE devices
SET is_blocked = TRUE,
    updated_at = NOW()
WHERE user_id = (SELECT id FROM users WHERE LOWER(email) = LOWER('korisnik@email.com'));
```

### Deblokiraj uređaj:

```sql
UPDATE devices
SET is_blocked = FALSE,
    updated_at = NOW()
WHERE device_id = 'device-id-ovdje';
```

---

## 🔍 6. KORISNE UPITE ZA DIJAGNOSTIKU

### Pregled aktivnih prijava (uređaji sa recent login-om):

```sql
SELECT 
    u.email,
    d.device_id,
    d.device_name,
    d.last_login,
    d.status,
    d.role
FROM devices d
INNER JOIN users u ON d.user_id = u.id
WHERE d.last_login > NOW() - INTERVAL '7 days'
ORDER BY d.last_login DESC;
```

### Korisnici bez odobrenih uređaja:

```sql
SELECT 
    u.email,
    COUNT(d.id) as total_devices,
    COUNT(CASE WHEN d.status = 'approved' THEN 1 END) as approved_devices
FROM users u
LEFT JOIN devices d ON u.id = d.user_id
GROUP BY u.email
HAVING COUNT(CASE WHEN d.status = 'approved' THEN 1 END) = 0
   AND COUNT(d.id) > 0;
```

### Najnoviji uređaji koji čekaju verifikaciju:

```sql
SELECT 
    u.email,
    d.device_id,
    d.device_name,
    d.created_at,
    EXTRACT(EPOCH FROM (NOW() - d.created_at)) / 3600 as hours_waiting
FROM devices d
INNER JOIN users u ON d.user_id = u.id
WHERE d.status = 'verifikacija' OR d.status IS NULL
ORDER BY d.created_at DESC
LIMIT 20;
```

### Statistika uređaja po statusu:

```sql
SELECT 
    status,
    COUNT(*) as count
FROM devices
GROUP BY status
ORDER BY count DESC;
```

---

## ⚙️ 7. ADMIN OPERACIJE

### Postavi korisnika kao vlasnika (is_owner = true):

```sql
UPDATE users
SET is_owner = TRUE,
    role = 'vlasnik',
    updated_at = NOW()
WHERE LOWER(email) = LOWER('korisnik@email.com');
```

### Promijeni ulogu korisnika:

```sql
UPDATE users
SET role = 'konobar',  -- ili 'vlasnik'
    updated_at = NOW()
WHERE LOWER(email) = LOWER('korisnik@email.com');
```

### Brisanje uređaja (oprezno!):

```sql
-- Prvo provjerite koji će se uređaj obrisati
SELECT * FROM devices
WHERE device_id = 'device-id-ovdje'
  AND user_id = (SELECT id FROM users WHERE LOWER(email) = LOWER('korisnik@email.com'));

-- Ako je sve u redu, obrišite
DELETE FROM devices
WHERE device_id = 'device-id-ovdje'
  AND user_id = (SELECT id FROM users WHERE LOWER(email) = LOWER('korisnik@email.com'));
```

---

## 📝 8. KORIŠTENE TABELE I KOLONE

### Tabela `users`:
- `id` - UUID korisnika
- `email` - Email adresa
- `role` - Uloga korisnika (vlasnik, konobar)
- `is_owner` - Da li je korisnik vlasnik (boolean)
- `permissions` - JSON sa permisijama
- `created_at` - Datum kreiranja
- `updated_at` - Datum ažuriranja

### Tabela `devices`:
- `id` - ID uređaja (auto-increment)
- `device_id` - UUID uređaja (unikatan)
- `device_name` - Naziv uređaja
- `device_info` - JSON sa informacijama o uređaju
- `user_id` - ID korisnika (FK na users.id)
- `status` - Status uređaja ('approved', 'verifikacija', 'pending')
- `role` - Uloga na ovom uređaju
- `permissions` - JSON sa permisijama
- `is_blocked` - Da li je uređaj blokiran (boolean)
- `last_login` - Datum posljednje prijave
- `created_at` - Datum kreiranja
- `updated_at` - Datum ažuriranja

---

## ⚠️ VAŽNE NAPOMENE

1. **Uvijek koristite `BEGIN;` i `COMMIT;`** za transakcije - ako nešto pođe po zlu, možete koristiti `ROLLBACK;`

2. **Provjerite prije brisanja** - uvijek prvo pokrenite SELECT upit da vidite šta će se obrisati

3. **Sigurnost** - ne dijelite lozinku za bazu podataka

4. **Backup** - prije velikih promjena, razmislite o backup-u

5. **Testiranje** - nakon izvršavanja komandi, testirajte u aplikaciji

---

## 🆘 BRZI REFERENCE

### Najčešće korištene komande:

```sql
-- 1. Pregled korisnika
SELECT id, email, is_owner, role FROM users ORDER BY created_at DESC;

-- 2. Pregled uređaja korisnika
SELECT d.*, u.email 
FROM devices d 
JOIN users u ON d.user_id = u.id 
WHERE LOWER(u.email) = LOWER('email@example.com');

-- 3. Odobri uređaj
UPDATE devices 
SET status = 'approved', role = 'vlasnik', is_blocked = FALSE 
WHERE device_id = 'xxx' 
  AND user_id = (SELECT id FROM users WHERE email = 'email@example.com');

-- 4. Odobri sve uređaje korisnika
UPDATE devices 
SET status = 'approved', role = 'vlasnik', is_blocked = FALSE 
WHERE user_id = (SELECT id FROM users WHERE email = 'email@example.com');
```

---

## 📞 Dodatna pomoć

Ako imate problema:
- Provjerite da li je konekcija na bazu uspješna: `SELECT 1;`
- Provjerite da li korisnik postoji prije nego što tražite uređaje
- Koristite `LOWER()` funkciju za case-insensitive pretrage email-a
- Provjerite rezultate sa SELECT prije nego što commitate promjene

