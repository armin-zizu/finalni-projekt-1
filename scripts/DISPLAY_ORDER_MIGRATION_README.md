# Migracija: Dodavanje display_order kolone u cjenovnik tabelu

Ova migracija dodaje `display_order` kolonu u `cjenovnik` tabelu kako bi se omogućilo custom ordering artikala.

## Kako pokrenuti migraciju:

### Opcija 1: Node.js script (preporučeno)

```bash
# Na serveru, nakon što se kod push-uje:
cd ~/bar-app  # ili ~/office-app
npm run migrate:display-order
```

### Opcija 2: Direktno SQL

Ako imate pristup PostgreSQL direktno (psql ili pgAdmin), pokrenite:

```sql
-- Step 1: Add display_order column
ALTER TABLE cjenovnik 
ADD COLUMN IF NOT EXISTS display_order INTEGER;

-- Step 2: Migrate existing data
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

-- Step 3: Create index
CREATE INDEX IF NOT EXISTS idx_cjenovnik_display_order ON cjenovnik(user_id, display_order);
```

## Provjera

Nakon migracije, provjerite da li je kolona dodana:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'cjenovnik' AND column_name = 'display_order';
```

Trebalo bi vratiti jedan red sa `display_order` kolonom.

## Važno

- Migracija je **safe** - koristi `IF NOT EXISTS` tako da se može pokrenuti više puta bez greške
- Postojeći podaci će dobiti `display_order` vrijednosti bazirane na alfabetskom redoslijedu po `naziv`
- Novi artikli će imati `display_order = NULL` dok se ne postavi eksplicitno

