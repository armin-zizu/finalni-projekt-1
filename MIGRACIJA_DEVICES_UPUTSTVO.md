# Migracija za fix devices unique constraint

## Problem
Uređaji se dupliraju u bazi podataka jer UNIQUE constraint je samo na `device_id`, a treba biti na kombinaciji `(user_id, device_id)`.

## Rješenje
Promijeniti UNIQUE constraint sa `device_id` na `(user_id, device_id)` kombinaciju.

## Kako pokrenuti migraciju na serveru:

### Opcija 1: Koristeći Node.js skriptu (preporučeno)
```bash
# SSH na server
ssh root@46.224.115.49

# Idi u direktorij aplikacije
cd ~/bar-app

# Pull najnovije promjene
git pull origin main

# Pokreni migraciju
npm run migrate:devices
```

### Opcija 2: Direktno SQL komande
```bash
# SSH na server
ssh root@46.224.115.49

# Poveži se na PostgreSQL
sudo -u postgres psql -d office_app

# Zatim izvrši SQL komande:
```

```sql
-- Ukloni stari UNIQUE constraint
ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_device_id_key;
ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_device_id_unique;

-- Očisti duplikate (zadrži najnoviji za svaku kombinaciju user_id + device_id)
WITH ranked_devices AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY user_id, device_id ORDER BY 
           COALESCE(last_login, created_at) DESC, created_at DESC) as rn
  FROM devices
)
DELETE FROM devices
WHERE id IN (
  SELECT id FROM ranked_devices WHERE rn > 1
);

-- Dodaj novi UNIQUE constraint
ALTER TABLE devices ADD CONSTRAINT devices_user_id_device_id_unique UNIQUE (user_id, device_id);

-- Kreiraj index za brže pretrage
CREATE INDEX IF NOT EXISTS idx_devices_user_device ON devices(user_id, device_id);

-- Provjeri rezultat
SELECT user_id, device_id, COUNT(*) as count
FROM devices
GROUP BY user_id, device_id
HAVING COUNT(*) > 1;
-- Ovo bi trebalo vratiti 0 redova ako je sve u redu

-- Izlaz
\q
```

## Provjera nakon migracije
```sql
-- Provjeri da li constraint postoji
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'devices' AND constraint_type = 'UNIQUE';

-- Provjeri da li ima duplikata
SELECT user_id, device_id, COUNT(*) as count
FROM devices
GROUP BY user_id, device_id
HAVING COUNT(*) > 1;
```

## Napomena
- Migracija je sigurna - neće obrisati podatke (samo duplikate)
- Ako već postoji constraint `devices_user_id_device_id_unique`, migracija će propasti - to je OK, znači da je već primijenjena
- Nakon migracije, aplikacija će automatski koristiti novi constraint i neće dozvoliti duplikate

