# Postavi korisnika kao vlasnika

## Problem
Korisnik pri prvom loginu vidi poruku da čeka odobrenje.

## Rješenje

**Na serveru pokreni ove komande:**

### Opcija 1: Direktno u psql (preporučeno)

```bash
sudo -u postgres psql -d office_app
```

Zatim kopiraj i paste:
```sql
UPDATE users 
SET 
  is_owner = true,
  role = 'vlasnik'
WHERE email = 'gitara.zizu@gmail.com';

-- Provjeri rezultat
SELECT id, email, role, is_owner, created_at 
FROM users 
WHERE email = 'gitara.zizu@gmail.com';
```

Izađi: `\q`

### Opcija 2: Preko fajla

```bash
cd ~/bar-app
sudo -u postgres psql -d office_app -f set-user-as-owner.sql
```

## Nakon toga:

- Refresh browser
- Logout i login ponovo
- Korisnik bi trebao biti vlasnik i moći pristupiti svemu!

