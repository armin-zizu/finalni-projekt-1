# Kreiranje tabele cjenovnik kao postgres korisnik

Pošto `office_user` nema dozvolu za kreiranje tabele, moraš koristiti `postgres` korisnika.

## Korak po korak:

1. **Poveži se na server:**
   ```bash
   ssh root@46.224.115.49
   ```

2. **Pokreni SQL kao postgres korisnik (direktno iz komande):**
   ```bash
   sudo -u postgres psql -d office_app -c "CREATE TABLE IF NOT EXISTS cjenovnik (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, naziv VARCHAR(255) NOT NULL, cijena DECIMAL(10, 2) NOT NULL, proizvodna_cijena DECIMAL(10, 2), zestoko_kolicina DECIMAL(10, 2), created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW(), UNIQUE(user_id, naziv));"
   ```

   **ILI bolje, poveži se interaktivno:**

   ```bash
   sudo -u postgres psql -d office_app
   ```

3. **Kada si povezan, kopiraj i pokreni:**

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

4. **Izađi iz psql:**
   ```sql
   \q
   ```

5. **Proveri da li je tabela kreirana:**
   ```bash
   sudo -u postgres psql -d office_app -c "\dt cjenovnik"
   ```

   Trebalo bi da vidiš tabelu u listi.

---

## Ako dobiješ grešku sa `gen_random_uuid()`:

Koristi ovu verziju:

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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

ILI alternativno sa `uuid_generate_v4()`:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

