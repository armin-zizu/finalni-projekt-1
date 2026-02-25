# Kako pokrenuti migraciju sa postgres superuser pristupom

## Problem
`office_user` nema dozvole da mijenja tabelu `cjenovnik` jer nije owner.

## Rješenje 1: Pristup kao postgres superuser

```bash
# Pristupi kao postgres superuser
sudo -u postgres psql -d office_app

# Ili direktno:
psql -h localhost -U postgres -d office_app
```

Zatim pokreni migraciju:
```sql
ALTER TABLE cjenovnik 
ADD COLUMN IF NOT EXISTS display_order INTEGER;

UPDATE cjenovnik
SET display_order = subquery.row_num - 1
FROM (
  SELECT 
    id,
    user_id,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY naziv ASC) as row_num
  FROM cjenovnik
  WHERE display_order IS NULL
) AS subquery
WHERE cjenovnik.id = subquery.id AND cjenovnik.user_id = subquery.user_id;

CREATE INDEX IF NOT EXISTS idx_cjenovnik_display_order ON cjenovnik(user_id, display_order);
```

## Rješenje 2: Daj dozvole office_user-u

Pristupi kao postgres superuser i dodaj dozvole:

```bash
sudo -u postgres psql -d office_app
```

```sql
-- Daj dozvole office_user-u
ALTER TABLE cjenovnik OWNER TO office_user;

-- Ili samo daj potrebne dozvole bez promjene ownership-a:
GRANT ALL PRIVILEGES ON TABLE cjenovnik TO office_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO office_user;
```

## Rješenje 3: Koristi Node.js script sa postgres konekcijom

Ako imaš `.env.local` na serveru sa postgres credentials, možeš pokrenuti:

```bash
cd ~/bar-app  # ili ~/office-app
npm run migrate:display-order
```

Ali script mora koristiti postgres konekciju, ne office_user.

## Provjera nakon migracije

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'cjenovnik' AND column_name = 'display_order';
```

## Najbrže rješenje

1. Pristupi kao postgres:
```bash
sudo -u postgres psql -d office_app
```

2. Pokreni migraciju (kopiraj SQL komande iznad)

3. Provjeri da je kolona dodana

