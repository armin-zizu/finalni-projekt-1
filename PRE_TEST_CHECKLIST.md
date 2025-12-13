# Pre-Test Checklist - Šta Provjeriti Prije Testiranja

## 1. Environment Variables (.env.local)

Provjeri da li postoje svi potrebni environment variables:

```bash
cd ~/bar-app
cat .env.local
```

**Mora sadržavati:**
- ✅ `DATABASE_URL=postgresql://postgres:LOZINKA@localhost:5432/office_app`
- ✅ `JWT_SECRET=...` (minimalno 32 karaktera)
- ✅ `NODE_ENV=production`
- ✅ `PORT=3001`

**Provjera:**
```bash
cd ~/bar-app
echo "DATABASE_URL exists:" && grep -c "DATABASE_URL" .env.local 2>/dev/null && echo "✅" || echo "❌"
echo "JWT_SECRET exists:" && grep -c "JWT_SECRET" .env.local 2>/dev/null && echo "✅" || echo "❌"
echo "NODE_ENV exists:" && grep -c "NODE_ENV" .env.local 2>/dev/null && echo "✅" || echo "❌"
echo "PORT exists:" && grep -c "PORT" .env.local 2>/dev/null && echo "✅" || echo "❌"
```

---

## 2. Database Connection

Provjeri da li se može povezati na bazu:

```bash
# Provjeri da li DATABASE_URL radi
cd ~/bar-app
source .env.local 2>/dev/null || true
psql "$DATABASE_URL" -c "SELECT NOW();"
```

Ili direktno:
```bash
sudo -u postgres psql -d office_app -c "SELECT NOW();"
```

**Ako ovo ne radi**, DATABASE_URL nema tačnu lozinku.

---

## 3. Korisnik Postoji u Bazi

Provjeri da li korisnik postoji i ima lozinku:

```bash
sudo -u postgres psql -d office_app -c "SELECT id, email, role, is_owner, password_hash IS NOT NULL as has_password FROM users WHERE email = 'gitara.zizu@gmail.com';"
```

**Mora biti:**
- `has_password = true`
- Korisnik postoji

---

## 4. PostgreSQL Radi

Provjeri status PostgreSQL servisa:

```bash
sudo systemctl status postgresql --no-pager | head -n 5
```

**Mora biti:** `Active: active (running)`

---

## 5. Aplikacija Je Rebuildana

Provjeri da li je aplikacija rebuildana sa najnovijim promjenama:

```bash
cd ~/bar-app
git pull origin main
npm run build
```

---

## 6. PM2 Koristi Najnovije Promjene

Restartuj PM2 da učita nove environment variables i najnoviji build:

```bash
cd ~/bar-app
pm2 restart office-app --update-env
pm2 status
```

---

## 7. Provjeri Logove Nakon Restarta

Nakon restarta, provjeri da li ima grešaka:

```bash
pm2 logs office-app --lines 30 --nostream
```

**Traži:**
- ✅ `Initializing database pool:` sa `hasDATABASE_URL: true`
- ✅ `safeConnectionString: 'postgresql://postgres:****@localhost:5432/office_app'` (sa `****` umjesto lozinke)
- ❌ Nema `SASL: SCRAM-SERVER-FIRST-MESSAGE` greške
- ❌ Nema `JWT_SECRET is not configured` greške

---

## 8. Provjeri Da Li Aplikacija Sluša Na Pravom Portu

```bash
netstat -tulpn | grep 3001
```

**Mora prikazati:** Node.js proces sluša na portu 3001

---

## Kompletan Test Script (Sve Odjednom)

```bash
cd ~/bar-app

echo "=== 1. ENVIRONMENT VARIABLES ==="
echo "DATABASE_URL:" && grep "DATABASE_URL" .env.local | head -c 50 && echo "..."
echo "JWT_SECRET:" && grep "JWT_SECRET" .env.local | head -c 30 && echo "..."
echo "NODE_ENV:" && grep "NODE_ENV" .env.local
echo "PORT:" && grep "PORT" .env.local

echo ""
echo "=== 2. DATABASE CONNECTION ==="
sudo -u postgres psql -d office_app -c "SELECT NOW();" 2>&1 | head -n 3

echo ""
echo "=== 3. KORISNIK ==="
sudo -u postgres psql -d office_app -c "SELECT id, email, role, is_owner, password_hash IS NOT NULL as has_password FROM users WHERE email = 'gitara.zizu@gmail.com';"

echo ""
echo "=== 4. POSTGRESQL STATUS ==="
sudo systemctl status postgresql --no-pager | head -n 3

echo ""
echo "=== 5. PM2 STATUS ==="
pm2 status

echo ""
echo "=== 6. PORT 3001 ==="
netstat -tulpn | grep 3001

echo ""
echo "=== 7. PM2 LOGS (last 20 lines) ==="
pm2 logs office-app --lines 20 --nostream | tail -n 20
```

---

## Redoslijed Akcija Prije Testiranja:

1. **Pull najnovije promjene:**
   ```bash
   cd ~/bar-app
   git pull origin main
   ```

2. **Build aplikacije:**
   ```bash
   npm run build
   ```

3. **Restart PM2:**
   ```bash
   pm2 restart office-app --update-env
   ```

4. **Provjeri logove:**
   ```bash
   pm2 logs office-app --lines 30
   ```

5. **Testiraj login u browseru**

---

## Ako Sve Prođe:

Ako sve provjere prođu uspješno, aplikacija je spremna za testiranje. Pokušaj login sa:
- **Email:** `gitara.zizu@gmail.com`
- **Password:** (lozinku koju si postavio pri registraciji)

---

## Ako Ima Grešaka:

1. **Database connection error** → Provjeri `DATABASE_URL` u `.env.local`
2. **JWT_SECRET error** → Provjeri `JWT_SECRET` u `.env.local`
3. **User not found** → Provjeri da li korisnik postoji u bazi
4. **Port already in use** → Provjeri `netstat -tulpn | grep 3001` i oslobodi port

