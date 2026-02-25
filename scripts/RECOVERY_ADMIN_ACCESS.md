# 🔐 Uputstvo za Recovery Admin Pristupa

Ako ste zaključani sa svih uređaja i ne možete se prijaviti u aplikaciju, možete odobriti uređaje direktno kroz bazu podataka.

## 📋 Opcija 1: Preko psql komandne linije (preporučeno)

### Korak 1: Prijavite se na bazu podataka

```bash
psql -h localhost -U office_user -d office_app
```

(Unesite lozinku kada se zatraži)

### Korak 2: Pokrenite recovery skriptu

Unutar psql terminala:

```sql
\i scripts/approve-admin-devices-recovery.sql
```

ILI kopirajte i zalijepite SQL komande direktno iz fajla.

---

## 📋 Opcija 2: Preko komandne linije (jedna komanda)

```bash
psql -h localhost -U office_user -d office_app -f scripts/approve-admin-devices-recovery.sql
```

---

## 📋 Opcija 3: Direktno SQL komande (brza opcija)

Ako imate pristup psql, kopirajte i zalijepite ove komande:

```sql
BEGIN;

-- Postavi is_owner i odobri sve uređaje za admin korisnika
UPDATE users
SET is_owner = TRUE,
    role = 'vlasnik',
    updated_at = NOW()
WHERE LOWER(email) = LOWER('gitara.zizu@gmail.com');

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
WHERE user_id = (SELECT id FROM users WHERE LOWER(email) = LOWER('gitara.zizu@gmail.com'))
  AND (
      status IS NULL OR
      status != 'approved' OR
      role IS NULL OR
      role != 'vlasnik' OR
      is_blocked = TRUE
  );

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
```

### ⚠️ Važno: ako prekinete izvršavanje poslije `BEGIN;`

Ako prekinete sesiju ili komande prije `COMMIT;`, transakcija može ostati otvorena i zaključati redove (`users`/`devices`), što uzrokuje jako spore login/device pozive.

U istom `psql` prozoru obavezno završite sa:

```sql
ROLLBACK;
```

Ako sumnjate na lock, pokrenite:

```bash
psql -h localhost -U office_user -d office_app -f scripts/check-db-locks.sql
```

---

## 📋 Opcija 4: Odobri samo jedan specifičan uređaj

Ako znate `device_id` uređaja koji želite odobriti:

```sql
UPDATE devices
SET status = 'approved',
    role = 'vlasnik',
    is_blocked = FALSE,
    updated_at = NOW()
WHERE user_id = (SELECT id FROM users WHERE LOWER(email) = LOWER('gitara.zizu@gmail.com'))
  AND device_id = 'VAŠ_DEVICE_ID_OVDJE';
```

Za pronalaženje `device_id`, prvo pokrenite:

```sql
SELECT device_id, device_name, status, role, created_at
FROM devices
WHERE user_id = (SELECT id FROM users WHERE LOWER(email) = LOWER('gitara.zizu@gmail.com'))
ORDER BY created_at DESC;
```

---

## 🔍 Provjera statusa

Nakon izvršavanja skripte, provjerite da li su uređaji odobreni:

```sql
SELECT 
    u.email,
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
```

Svi uređaji trebaju imati:
- `status = 'approved'`
- `role = 'vlasnik'`
- `is_blocked = false`

---

## ⚠️ Napomene

1. **Backup**: Prije izvršavanja, razmislite o kreiranju backup-a baze (ako je moguće).
2. **Email**: Ako se admin email razlikuje od `gitara.zizu@gmail.com`, promijenite ga u SQL komandama.
3. **Sigurnost**: Ove komande direktno mijenjaju bazu podataka, budite oprezni.
4. **Testiranje**: Nakon recovery-ja, probajte se prijaviti i provjerite da li sve radi.

---

## 🆘 Ako nemate pristup PostgreSQL klijentu

Ako nemate instaliran `psql` ili pristup serveru:

1. **Kontaktirajte hosting provajdera** da pokrenu SQL komande umjesto vas
2. **Koristite pgAdmin** ili drugi GUI alat ako imate pristup
3. **Kreirajte privremeni API endpoint** koji će ovo uraditi (ali to zahtijeva pristup serveru)

---

## 📞 Dodatna pomoć

Ako imate problema:
1. Provjerite da li imate prava za UPDATE operacije na `users` i `devices` tabele
2. Provjerite da li je konekcija na bazu uspješna
3. Provjerite da li admin korisnik postoji u bazi

