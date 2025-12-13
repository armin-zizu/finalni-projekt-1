# Kako Provjeriti Korisnike u Bazi Podataka

## Provjera koliko korisnika ima:

```bash
sudo -u postgres psql -d office_app -c "SELECT COUNT(*) as total_users FROM users;"
```

## Provjera svih korisnika sa osnovnim informacijama:

```bash
sudo -u postgres psql -d office_app -c "SELECT id, email, role, is_owner, password_hash IS NOT NULL as has_password, created_at FROM users;"
```

## Provjera određenog korisnika (npr. gitara.zizu@gmail.com):

```bash
sudo -u postgres psql -d office_app -c "SELECT id, email, role, is_owner, password_hash IS NOT NULL as has_password, created_at, updated_at FROM users WHERE email = 'gitara.zizu@gmail.com';"
```

## Provjera detaljnih informacija o korisniku (bez prikazivanja password_hash, samo da li postoji):

```bash
sudo -u postgres psql -d office_app -c "SELECT id, email, role, is_owner, CASE WHEN password_hash IS NULL THEN 'NO' ELSE 'YES' END as has_password, LENGTH(password_hash::text) as password_hash_length, created_at, updated_at FROM users WHERE email = 'gitara.zizu@gmail.com';"
```

## Provjera svih korisnika koji imaju lozinku:

```bash
sudo -u postgres psql -d office_app -c "SELECT id, email, role, is_owner, created_at FROM users WHERE password_hash IS NOT NULL;"
```

## Provjera svih korisnika koji NEMAJU lozinku:

```bash
sudo -u postgres psql -d office_app -c "SELECT id, email, role, is_owner, created_at FROM users WHERE password_hash IS NULL;"
```

## Provjera vlasnika (owners):

```bash
sudo -u postgres psql -d office_app -c "SELECT id, email, role, is_owner, password_hash IS NOT NULL as has_password FROM users WHERE is_owner = true;"
```

## Provjera korisnika sa određenom ulogom:

```bash
sudo -u postgres psql -d office_app -c "SELECT id, email, role, is_owner, password_hash IS NOT NULL as has_password FROM users WHERE role = 'vlasnik';"
```

---

## Interaktivni način (ulazak u PostgreSQL shell):

```bash
sudo -u postgres psql -d office_app
```

U PostgreSQL shell-u možeš koristiti:

```sql
-- Broj korisnika
SELECT COUNT(*) FROM users;

-- Svi korisnici
SELECT id, email, role, is_owner, password_hash IS NOT NULL as has_password FROM users;

-- Određeni korisnik
SELECT id, email, role, is_owner, password_hash IS NOT NULL as has_password FROM users WHERE email = 'gitara.zizu@gmail.com';

-- Izlaz
\q
```

---

## Kompletan pregled (sve odjednom):

```bash
echo "=== UKUPAN BROJ KORISNIKA ==="
sudo -u postgres psql -d office_app -c "SELECT COUNT(*) as total FROM users;"

echo ""
echo "=== KORISNICI SA LOZINKOM ==="
sudo -u postgres psql -d office_app -c "SELECT id, email, role, is_owner FROM users WHERE password_hash IS NOT NULL;"

echo ""
echo "=== KORISNICI BEZ LOZINKE ==="
sudo -u postgres psql -d office_app -c "SELECT id, email, role, is_owner FROM users WHERE password_hash IS NULL;"

echo ""
echo "=== KORISNIK gitara.zizu@gmail.com ==="
sudo -u postgres psql -d office_app -c "SELECT id, email, role, is_owner, password_hash IS NOT NULL as has_password, created_at FROM users WHERE email = 'gitara.zizu@gmail.com';"
```

---

## Provjera detalja o određenom korisniku (sa svim informacijama):

```bash
sudo -u postgres psql -d office_app -c "
SELECT 
    id,
    email,
    role,
    is_owner,
    CASE WHEN password_hash IS NULL THEN 'NEMA' ELSE 'IMA' END as lozinka,
    CASE WHEN password_hash IS NOT NULL THEN LENGTH(password_hash::text) ELSE 0 END as duzina_hash,
    created_at,
    updated_at
FROM users 
WHERE email = 'gitara.zizu@gmail.com';"
```

---

## Ako korisnik ne postoji:

Ako query vraća prazan rezultat (0 rows), korisnik ne postoji u bazi.

Ako korisnik postoji ali nema `password_hash`, možeš ga kreirati kroz registraciju ili ručno dodati password_hash (ali to je komplikovanije).

---

## Najbrži način (jedna komanda):

Za provjeru određenog korisnika:
```bash
sudo -u postgres psql -d office_app -c "SELECT id, email, role, is_owner, password_hash IS NOT NULL as has_password FROM users WHERE email = 'gitara.zizu@gmail.com';"
```

Za sve korisnike:
```bash
sudo -u postgres psql -d office_app -c "SELECT id, email, role, is_owner, password_hash IS NOT NULL as has_password FROM users ORDER BY created_at DESC;"
```

