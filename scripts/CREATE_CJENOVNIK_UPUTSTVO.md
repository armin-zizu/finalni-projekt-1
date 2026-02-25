# Uputstvo za kreiranje tabele cjenovnik

## Opcija 1: Korištenje psql komande direktno

1. Otvori terminal/PowerShell na svom računaru

2. Poveži se na PostgreSQL server sa:
```bash
psql -h localhost -U office_user -d office_app
```

3. Kada se zatraži lozinka, unesi lozinku iz `.env.local` fajla (promenljiva `DB_PASSWORD`)

4. Kada si povezan, kopiraj i pokreni sledeću SQL komandu:

```sql
CREATE TABLE IF NOT EXISTS cjenovnik (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    naziv VARCHAR(255) NOT NULL,
    cijena DECIMAL(10, 2) NOT NULL,
    proizvodna_cijena DECIMAL(10, 2),
    zestoko_kolicina DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, naziv)
);

CREATE INDEX IF NOT EXISTS idx_cjenovnik_user_id ON cjenovnik(user_id);
CREATE INDEX IF NOT EXISTS idx_cjenovnik_user_naziv ON cjenovnik(user_id, naziv);
```

5. Ako je uspešno, videćeš poruku: `CREATE TABLE`

6. Napusti psql sa: `\q` ili `exit`

---

## Opcija 2: Korištenje SQL fajla direktno

1. Otvori terminal/PowerShell u folderu gde se nalazi `scripts/create-cjenovnik-table.sql`

2. Pokreni:
```bash
psql -h localhost -U office_user -d office_app -f scripts/create-cjenovnik-table.sql
```

3. Unesi lozinku kada se zatraži

---

## Opcija 3: Korištenje pgAdmin ili drugog database tool-a

1. Otvori pgAdmin ili svoj omiljeni PostgreSQL admin tool

2. Poveži se na server:
    - Host: `localhost`
   - Port: `5432`
   - Database: `office_app`
   - Username: `office_user`
   - Password: (iz `.env.local` fajla)

3. Kada si povezan, otvori Query Tool (Query → New Query)

4. Kopiraj SQL kod iz opcije 1 ili otvori `scripts/create-cjenovnik-table.sql` fajl

5. Pokreni query (F5 ili Execute)

---

## Verifikacija da je tabela kreirana

Nakon što si pokrenuo SQL, proveri da li je tabela kreirana:

```sql
-- Poveži se na bazu ponovo ili koristi postojeću konekciju
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'cjenovnik';
```

Trebalo bi da vidiš jedan red sa `cjenovnik`.

---

## Napomena

Ako dobiješ grešku `function gen_random_uuid() does not exist`, koristi ovu verziju:

```sql
CREATE TABLE IF NOT EXISTS cjenovnik (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    naziv VARCHAR(255) NOT NULL,
    cijena DECIMAL(10, 2) NOT NULL,
    proizvodna_cijena DECIMAL(10, 2),
    zestoko_kolicina DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, naziv)
);

CREATE INDEX IF NOT EXISTS idx_cjenovnik_user_id ON cjenovnik(user_id);
CREATE INDEX IF NOT EXISTS idx_cjenovnik_user_naziv ON cjenovnik(user_id, naziv);
```

Ili prvo pokreni:
```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

Ako dobiješ grešku da `uuid_generate_v4()` ne postoji, pokreni:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

