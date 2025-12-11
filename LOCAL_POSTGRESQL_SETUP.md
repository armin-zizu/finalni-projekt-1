# 🗄️ Lokalna PostgreSQL Setup za Development

## Korak 1: Instalacija PostgreSQL-a na Windows

### Opcija A: Preko PostgreSQL installer (Preporučeno)

1. **Preuzmi PostgreSQL:**
   - Idite na: https://www.postgresql.org/download/windows/
   - Kliknite "Download the installer"
   - Izaberite najnoviju verziju (v16 ili v15)

2. **Instaliraj:**
   - Pokrenite installer
   - Usput instalacije, postavi password za `postgres` korisnika (zapamti ga!)
   - Port: 5432 (default)
   - Lokalizacija: zadrži default

3. **Provjeri instalaciju:**
   ```powershell
   # Otvori PowerShell kao Administrator
   psql --version
   ```

### Opcija B: Preko Chocolatey (ako imaš)

```powershell
# Otvori PowerShell kao Administrator
choco install postgresql --params '/Password:YourPassword'
```

## Korak 2: Setup lokalne baze

### 1. Dodaj PostgreSQL u PATH (ako nije automatski):

1. Otvori "Environment Variables" (Sistemske promenljive)
2. U "System variables" → "Path" → "Edit"
3. Dodaj: `C:\Program Files\PostgreSQL\16\bin` (prilagodi verziji)

### 2. Kreiraj bazu i korisnika:

**Otvori PowerShell ili Command Prompt i pokreni:**

```powershell
# Poveži se na PostgreSQL (koristi password koji si postavio tokom instalacije)
psql -U postgres
```

**U PostgreSQL konzoli izvrši:**

```sql
-- Kreiraj bazu
CREATE DATABASE office_app;

-- Kreiraj korisnika (zamijeni 'your_password' sa željenim passwordom)
CREATE USER office_user WITH ENCRYPTED PASSWORD 'office_dev_password';

-- Dodaj privilegije
GRANT ALL PRIVILEGES ON DATABASE office_app TO office_user;

-- Poveži se na novu bazu
\c office_app

-- Daj sve privilegije na schema
GRANT ALL ON SCHEMA public TO office_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO office_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO office_user;

-- Izađi
\q
```

### 3. Importuj database schema:

```powershell
# U terminalu gdje se nalaziš u office-app folderu
psql -U postgres -d office_app -f database_schema.sql
```

**Ili ako želiš koristiti office_user:**

```powershell
# Prvo treba dati permisije
psql -U postgres -d office_app -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO office_user;"
psql -U postgres -d office_app -c "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO office_user;"

# Zatim importuj
psql -U office_user -d office_app -f database_schema.sql
```

## Korak 3: Podesi .env.local

Kreiraj ili edituj `.env.local` fajl u root folderu projekta:

```env
# Database Configuration (Lokalna)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=office_app
DB_USER=office_user
DB_PASSWORD=office_dev_password
# Ili koristi connection string format:
# DATABASE_URL=postgresql://office_user:office_dev_password@localhost:5432/office_app

# JWT Secret (koristi neki siguran random string)
JWT_SECRET=your_super_secret_jwt_key_minimum_32_characters_long_change_this

# Environment
NODE_ENV=development

# Firebase (ako još koristiš neke Firebase funkcionalnosti)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## Korak 4: Testiraj konekciju

```powershell
# Pokreni test skriptu (ako postoji)
npm run test:db

# Ili pokreni Next.js i testiraj API
npm run dev
# U browseru: http://localhost:3000/api/test-db
```

## Korak 5: Pokreni development server

```powershell
npm run dev
```

Otvori browser: `http://localhost:3000`

## Troubleshooting

### Problem: "psql: command not found"
**Rješenje:** Dodaj PostgreSQL bin folder u PATH (vidi Korak 2.1)

### Problem: "password authentication failed"
**Rješenje:** 
1. Provjeri password u `.env.local`
2. Provjeri `pg_hba.conf` fajl (obično u `C:\Program Files\PostgreSQL\16\data\pg_hba.conf`)
3. Promijeni `md5` na `trust` za localhost (samo za development!)

### Problem: "database does not exist"
**Rješenje:** Kreiraj bazu ponovo (vidi Korak 2.2)

### Problem: "permission denied"
**Rješenje:** Daj sve privilegije korisniku (vidi Korak 2.2)

## Korisne komande

```powershell
# Poveži se na bazu
psql -U office_user -d office_app

# Lista svih baza
psql -U postgres -c "\l"

# Lista korisnika
psql -U postgres -c "\du"

# Lista tabela u bazi
psql -U office_user -d office_app -c "\dt"
```

