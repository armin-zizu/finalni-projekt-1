# Migracija: Dodavanje display_order kolone

## Brza migracija na serveru

Nakon što push-uješ kod na server, pokreni:

```bash
cd ~/bar-app  # ili ~/office-app (gdje je projekat)
git pull origin main
npm install
npm run migrate:display-order
```

## Ili direktno SQL komandama

Ako imaš pristup PostgreSQL direktno (psql ili pgAdmin), pokreni:

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

## Status

- ✅ Automatska migracija je implementirana u API-ju
- ✅ Fallback logika radi bez grešaka ako kolona ne postoji
- ⚠️ Migracija se mora pokrenuti ručno na serveru (zbog dozvola)

## Provjera nakon migracije

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'cjenovnik' AND column_name = 'display_order';
```

Trebalo bi vratiti jedan red sa `display_order` kolonom.

