# 🚀 Quick Start - Server Setup

## Korak 1: Povezivanje na server u Cursor-u

1. Otvorite Cursor
2. Pritisnite `F1` → otkucajte "Remote-SSH: Connect to Host..."
3. Add New SSH Host → ukucajte: `ssh armin@46.224.115.49`
4. Enter → izaberite "Linux"
5. File → Open Folder → `/home/armin/bar-app` (ili gdje je vaš folder)

## Korak 2: Setup na serveru

### Opcija A: Automatski setup (preporučeno)

```bash
# Pokrenite setup skript
bash setup-server.sh
```

### Opcija B: Manual setup

```bash
# 1. Instalirajte npm pakete
npm install

# 2. Kreirajte .env.local (kopirajte iz .env.example ili koristite setup-server.sh)
cp .env.example .env.local
nano .env.local  # Promijenite password i JWT_SECRET

# 3. Setup PostgreSQL
sudo -u postgres psql
```

U PostgreSQL konzoli:
```sql
CREATE DATABASE office_app;
CREATE USER office_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE office_app TO office_user;
\q
```

```bash
# 4. Importujte database schema
psql -U office_user -d office_app -f database_schema.sql
```

## Korak 3: Testiranje

```bash
# Provjera servera
bash check-server.sh

# Test database connection
node test-connection.js

# Ili pokrenite Next.js i testirajte API
npm run dev
# U drugom terminalu:
curl http://localhost:3000/api/test-db
```

## Korak 4: Auto-restart (opcionalno)

```bash
# Instalirajte nodemon globalno
npm install -g nodemon

# Kreirajte restart skriptu
echo 'nodemon --watch . --ext ts,tsx,js,jsx,json --exec "npm run dev" --ignore .git --ignore node_modules --ignore .next' > restart.sh
chmod +x restart.sh

# Pokrenite sa auto-restart
./restart.sh
```

**Napomena**: Next.js već ima hot reload, ali nodemon može biti koristan za API routes.

## ⚠️ Važno - Promijenite u .env.local:

1. **DB_PASSWORD** - Vaš PostgreSQL password
2. **JWT_SECRET** - Random string (minimalno 32 karaktera)

Primjer sigurnog JWT_SECRET:
```bash
openssl rand -base64 32
```

## 🐛 Troubleshooting

### Database connection error
```bash
# Provjerite da li je PostgreSQL aktivan
sudo systemctl status postgresql

# Ako nije, pokrenite ga
sudo systemctl start postgresql

# Provjerite credentials
psql -U office_user -d office_app -c "SELECT NOW();"
```

### Port 3000 je zauzet
```bash
# Pronađite proces koji koristi port 3000
lsof -i :3000

# Ili koristite drugi port
PORT=3001 npm run dev
```

### Permission denied
```bash
# Osigurajte da imate prava na folder
chmod +x setup-server.sh check-server.sh
```

---

## ✅ Checklist

- [ ] Povezan na server u Cursor-u
- [ ] Pokrenuo `setup-server.sh` ili manual setup
- [ ] Promijenio DB_PASSWORD u .env.local
- [ ] Promijenio JWT_SECRET u .env.local
- [ ] Kreirao bazu podataka
- [ ] Importovao database_schema.sql
- [ ] Testirao konekciju (`node test-connection.js`)
- [ ] Pokrenuo aplikaciju (`npm run dev`)
- [ ] Testirao API (`curl http://localhost:3000/api/test-db`)

---

**Sada možete raditi direktno na serveru! Svaka promjena u Cursor-u je odmah live! 🎉**


