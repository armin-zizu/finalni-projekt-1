# 🎯 Server Setup - Korak po Korak

## 📋 Šta je kreirano:

1. ✅ **Backend API struktura** (`src/lib/` i `src/app/api/`)
   - Database connection (`src/lib/db.ts`)
   - JWT autentifikacija (`src/lib/jwt.ts`)
   - Password hashing (`src/lib/password.ts`)
   - Auth middleware (`src/lib/auth-middleware.ts`)
   - Login/Register/Logout API routes

2. ✅ **Database Schema** (`database_schema.sql`)
   - Sve potrebne tabele
   - Indexes za performanse
   - Triggers za auto-update

3. ✅ **Setup skripte**
   - `setup-server.sh` - Automatski setup
   - `check-server.sh` - Health check
   - `test-connection.js` - Test database konekcije

4. ✅ **Dokumentacija**
   - `QUICK_START_SERVER.md` - Quick start guide
   - `BACKEND_SETUP.md` - Detaljne instrukcije
   - `MIGRATION_PLAN.md` - Kompletan plan migracije

---

## 🚀 Sada na serveru (u Cursor-u preko Remote-SSH):

### Korak 1: Povezivanje

1. Otvorite Cursor
2. `F1` → "Remote-SSH: Connect to Host..."
3. Ukucajte: `ssh armin@46.224.115.49`
4. Enter → Linux
5. File → Open Folder → `/home/armin/bar-app`

### Korak 2: Setup (pokrenite u terminalu na serveru)

```bash
# Automatski setup
bash setup-server.sh

# ILI manual setup:
npm install
cp .env.example .env.local
nano .env.local  # Promijenite password i JWT_SECRET
```

### Korak 3: PostgreSQL Setup

```bash
# Kreirajte bazu
sudo -u postgres psql
```

U PostgreSQL konzoli:
```sql
CREATE DATABASE office_app;
CREATE USER office_user WITH ENCRYPTED PASSWORD 'vaš_password';
GRANT ALL PRIVILEGES ON DATABASE office_app TO office_user;
\q
```

```bash
# Importujte schema
psql -U office_user -d office_app -f database_schema.sql
```

### Korak 4: Testiranje

```bash
# Provjera servera
bash check-server.sh

# Test database
npm run test:db

# Pokrenite aplikaciju
npm run dev

# Test API (u drugom terminalu)
curl http://localhost:3000/api/test-db
```

---

## ⚠️ VAŽNO - Promijenite u .env.local:

```bash
# 1. DB_PASSWORD - Vaš PostgreSQL password
DB_PASSWORD=your_secure_password_here

# 2. JWT_SECRET - Random string (minimalno 32 karaktera)
# Generirajte sa:
openssl rand -base64 32
JWT_SECRET=your_generated_secret_here
```

---

## ✅ Checklist:

- [ ] Povezan na server u Cursor-u
- [ ] Pokrenuo `setup-server.sh`
- [ ] Promijenio DB_PASSWORD u .env.local
- [ ] Promijenio JWT_SECRET u .env.local  
- [ ] Kreirao PostgreSQL bazu
- [ ] Importovao database_schema.sql
- [ ] Testirao konekciju (`npm run test:db`)
- [ ] Pokrenuo dev server (`npm run dev`)
- [ ] Testirao API endpoint (`/api/test-db`)

---

## 🔗 Korisni linkovi:

- `QUICK_START_SERVER.md` - Brzi start
- `BACKEND_SETUP.md` - Detaljne instrukcije
- `MIGRATION_PLAN.md` - Kompletan plan

---

**Sada možete raditi direktno na serveru! 🎉**

Svaka promjena u Cursor-u = odmah live na serveru!


