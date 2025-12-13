# Environment Variables Checklist

## Fajlovi koje treba provjeriti:

1. **`.env.local`** - glavni fajl sa environment variables (NE COMMITUJE SE u Git)
2. **`next.config.ts`** - Next.js konfiguracija (može imati env settings)
3. **`next-env.d.ts`** - TypeScript definicije za Next.js (auto-generisan)
4. **`src/lib/db.ts`** - učitava `.env.local` eksplicitno za PM2

---

## Potrebne Environment Variables:

### Obavezne:
```env
DATABASE_URL=postgresql://office_user:LOZINKA@localhost:5432/office_app
JWT_SECRET=neki-secret-key-minimum-32-characters
NODE_ENV=production
PORT=3001
```

### Opciono:
```env
JWT_EXPIRES_IN=7d
DB_USER=postgres
DB_PASSWORD=lozinka
DB_HOST=localhost
DB_PORT=5432
DB_NAME=office_app
```

---

## Provjera na Serveru:

### 1. Provjeri da li `.env.local` postoji:
```bash
cd ~/bar-app
ls -la .env.local
```

### 2. Provjeri sadržaj `.env.local`:
```bash
cd ~/bar-app
cat .env.local
```

**Mora sadržavati:**
- ✅ `DATABASE_URL=...`
- ✅ `JWT_SECRET=...`
- ✅ `NODE_ENV=production`
- ✅ `PORT=3001`

### 3. Provjeri da li se učitava u logovima:
```bash
pm2 logs office-app --lines 50 | grep -i "database environment check\|hasDATABASE_URL"
```

**Trebao bi vidjeti:**
```
Database environment check: {
  hasDATABASE_URL: true,  ← Mora biti true!
  DATABASE_URL_length: 67,  ← Mora biti > 0
  ...
}
```

### 4. Provjeri `next.config.ts`:
```bash
cat next.config.ts
```

**Trenutno ne treba ništa posebno**, ali možeš dodati:
```typescript
env: {
  CUSTOM_KEY: process.env.CUSTOM_KEY,
}
```

### 5. Provjeri da li `dotenv` učitava `.env.local`:
```bash
# U src/lib/db.ts bi trebalo biti:
# dotenv.config({ path: resolve(process.cwd(), '.env.local') });
```

---

## Problem: PM2 Ne Učitava .env.local

### Rješenje 1: Eksplicitno učitavanje u `db.ts` (VEĆ DODANO)
`src/lib/db.ts` sada eksplicitno učitava `.env.local` koristeći `dotenv`.

### Rješenje 2: Provjeri da li `.env.local` postoji u pravom mjestu
Na serveru, `.env.local` mora biti u root direktoriju aplikacije:
```
/root/bar-app/.env.local
```

### Rješenje 3: Provjeri putanju u `db.ts`
```typescript
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
```

`process.cwd()` u production buildu može biti različit. Provjeri da li je putanja ispravna.

---

## Debug Komande na Serveru:

### 1. Provjeri da li `.env.local` postoji:
```bash
cd ~/bar-app
test -f .env.local && echo "EXISTS" || echo "NOT FOUND"
```

### 2. Provjeri absolutnu putanju:
```bash
cd ~/bar-app
pwd
ls -la .env.local
```

### 3. Provjeri da li `dotenv` može pročitati fajl:
```bash
cd ~/bar-app
node -e "require('dotenv').config({path: '.env.local'}); console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET (' + process.env.DATABASE_URL.length + ' chars)' : 'NOT SET');"
```

### 4. Provjeri logove nakon restarta:
```bash
pm2 restart office-app
sleep 2
pm2 logs office-app --lines 30 --nostream | grep -A 10 "Database environment check"
```

---

## Troubleshooting:

### Problem: `hasDATABASE_URL: false`
**Uzrok:** `.env.local` se ne učitava
**Rješenje:**
1. Provjeri da li `.env.local` postoji u `/root/bar-app/`
2. Provjeri da li `dotenv` paket je instaliran: `npm list dotenv`
3. Provjeri logove da vidiš putanju koju `dotenv` pokušava koristiti
4. Dodaj dodatno logiranje u `db.ts`:

```typescript
const envPath = resolve(process.cwd(), '.env.local');
console.log('Trying to load .env.local from:', envPath);
console.log('File exists:', require('fs').existsSync(envPath));
const result = dotenv.config({ path: envPath });
console.log('Dotenv result:', result.error ? result.error.message : 'SUCCESS');
```

### Problem: `DATABASE_URL_length: 0`
**Uzrok:** `.env.local` je prazan ili `DATABASE_URL` nije postavljen
**Rješenje:** Provjeri `cat .env.local` i dodaj `DATABASE_URL`

### Problem: Connection string nema lozinku
**Uzrok:** `DATABASE_URL` nema lozinku ili lozinka nije ispravno formatirana
**Rješenje:** Provjeri format: `postgresql://user:password@host:port/database`

---

## Kompletna Provjera (Copy-Paste):

```bash
cd ~/bar-app

echo "=== 1. FILE EXISTS ==="
test -f .env.local && echo "✅ .env.local EXISTS" || echo "❌ .env.local NOT FOUND"

echo ""
echo "=== 2. FILE LOCATION ==="
pwd
ls -la .env.local 2>/dev/null || echo "File not found"

echo ""
echo "=== 3. FILE CONTENT (masked) ==="
if [ -f .env.local ]; then
  cat .env.local | sed 's/:[^:@]*@/:****@/g' | sed 's/=.*SECRET.*=/=****/g'
else
  echo "File not found"
fi

echo ""
echo "=== 4. NODE TEST ==="
node -e "
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const envPath = path.resolve(process.cwd(), '.env.local');
console.log('Path:', envPath);
console.log('Exists:', fs.existsSync(envPath));
const result = dotenv.config({path: envPath});
if (result.error) {
  console.log('Error:', result.error.message);
} else {
  console.log('✅ Loaded successfully');
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET (' + process.env.DATABASE_URL.length + ' chars)' : 'NOT SET');
  console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'SET (' + process.env.JWT_SECRET.length + ' chars)' : 'NOT SET');
}
"

echo ""
echo "=== 5. PM2 LOGS ==="
pm2 logs office-app --lines 20 --nostream | grep -A 5 "Database environment check" | tail -n 10
```

