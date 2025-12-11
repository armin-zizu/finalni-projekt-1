# Deploy na Hetzner Server - Plan

## ✅ Što već imamo:
- ✅ Login funkcionalnost radi
- ✅ Database migracije završene (users, devices tabele)
- ✅ PostgreSQL baza postavljenja i radi
- ✅ Osnovne API rute funkcionalne

## 📋 Plan deploya

### Korak 1: Priprema servera
- Provjeriti Node.js instalaciju
- Provjeriti PM2 (process manager) ili instalirati
- Provjeriti Nginx ili postaviti
- Provjeriti git setup

### Korak 2: Environment varijable
- Kreirati `.env.local` ili `.env.production` na serveru
- Postaviti `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production`

### Korak 3: Deploy aplikacije
- Clone/pull projekta na server
- Instalirati dependencies (`npm install`)
- Build aplikacije (`npm run build`)
- Pokrenuti sa PM2 (`npm start` ili `pm2 start`)

### Korak 4: Nginx reverse proxy (ako je potrebno)
- Konfigurirati Nginx da proxy-uje na Next.js port
- SSL setup (Let's Encrypt)

## 🎯 Prednosti deploya na server:
- ✅ Brži razvoj - sve promjene se vide odmah
- ✅ Realističnije okruženje
- ✅ Lakše testiranje
- ✅ Možemo nastaviti migraciju direktno na produkciji

## ⚠️ Napomene:
- Možda ćemo raditi direktno na produkciji (ali to je OK za development)
- Možemo koristiti `npm run dev` za development ili `npm run build && npm start` za production

Hajde da krenemo!

