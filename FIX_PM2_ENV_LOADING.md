# Popravka: PM2 Ne Učitava .env.local

## Problem:
PM2 ne učitava `.env.local` automatski, pa `DATABASE_URL` nije dostupan u aplikaciji.

Logovi pokazuju:
```
hasDATABASE_URL: false,
safeConnectionString: 'postgresql://postgres:@localhost:5432/office_app'
```

## Rješenje 1: Koristi dotenv-cli (Preporučeno)

Instaliraj `dotenv-cli`:
```bash
cd ~/bar-app
npm install --save-dev dotenv-cli
```

Zatim promijeni PM2 start komandu da koristi `dotenv`:
```bash
pm2 delete office-app
pm2 start npm --name "office-app" -- run start:prod
```

Ali prvo dodaj u `package.json`:
```json
"scripts": {
  "start:prod": "dotenv -e .env.local -- next start"
}
```

## Rješenje 2: PM2 Ecosystem File (Najbolje za Production)

Kreiraj `ecosystem.config.js` fajl:

```bash
cd ~/bar-app
nano ecosystem.config.js
```

Dodaj:
```javascript
module.exports = {
  apps: [{
    name: 'office-app',
    script: 'npm',
    args: 'start',
    cwd: '/root/bar-app',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
    },
    env_file: '.env.local', // PM2 ne podržava ovo direktno
  }]
};
```

Ali PM2 ne podržava `env_file` direktno. Umjesto toga, učitaj `.env.local` ručno:

```bash
cd ~/bar-app
npm install --save-dev dotenv-cli
```

Ili koristi `--env-file` flag (ako PM2 verzija podržava, ali obično ne).

## Rješenje 3: Source .env.local i Start PM2 (Najbrže)

```bash
cd ~/bar-app

# Učitaj .env.local u trenutnu shell sesiju
set -a
source .env.local
set +a

# Startuj PM2 sa environment variables
pm2 delete office-app
pm2 start npm --name "office-app" -- start
pm2 save
```

Ali ovo ne traje nakon restarta servera - treba ručno svaki put.

## Rješenje 4: PM2 sa --update-env i ručno učitavanje (Najlakše)

Postavi environment variables direktno u PM2:

```bash
cd ~/bar-app

# Učitaj .env.local
export $(cat .env.local | grep -v '^#' | xargs)

# Update PM2 sa environment variables
pm2 restart office-app --update-env
```

## Rješenje 5: next.config.ts učitava .env.local (Next.js 15)

Next.js 15 automatski učitava `.env.local`, ali možda ne u production build-u. Provjeri `next.config.ts`.

## Rješenje 6: Koristi dotenv u kod-u (Nije preporučeno za production)

Dodaj na početak `src/lib/db.ts`:
```typescript
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
```

Ali ovo nije najbolje rješenje.

---

## Najbolje Rješenje: PM2 Ecosystem File sa dotenv-cli

### Korak 1: Instaliraj dotenv-cli
```bash
cd ~/bar-app
npm install --save-dev dotenv-cli
```

### Korak 2: Dodaj script u package.json
```bash
nano package.json
```

Dodaj u `scripts`:
```json
"start:prod": "dotenv -e .env.local -- next start -p 3001"
```

### Korak 3: Update PM2 da koristi novi script
```bash
pm2 delete office-app
pm2 start npm --name "office-app" -- run start:prod
pm2 save
```

---

## Alternativno: Jednostavnije - Export Environment Variables

```bash
cd ~/bar-app

# Učitaj .env.local
export $(grep -v '^#' .env.local | xargs)

# Restart PM2
pm2 restart office-app --update-env
```

Ali ovo traje samo dok je shell aktivan.

---

## Najlakše: Koristi PM2 sa env_file opcijom (Ako PM2 verzija podržava)

Provjeri PM2 verziju:
```bash
pm2 --version
```

Ako je PM2 5.0+, možeš koristiti:
```bash
pm2 start npm --name "office-app" -- run start --env-file .env.local
```

Ali to možda ne radi.

---

## Preporučeno Rješenje (Za Trajnost):

1. Instaliraj `dotenv-cli`
2. Dodaj `start:prod` script
3. Update PM2 da koristi `start:prod`

Ovo je najsigurnije i najtrajnije rješenje.

