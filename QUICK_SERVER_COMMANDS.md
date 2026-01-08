# Brze komande za server

## Pokreni aplikaciju:
```bash
pm2 start npm --name "office-app" -- start
```

## Restart aplikacije:
```bash
pm2 restart office-app
```

## Zaustavi aplikaciju:
```bash
pm2 stop office-app
```

## Provjeri status:
```bash
pm2 status
```

## Pregled logova:
```bash
pm2 logs office-app
```

## Sačuvaj PM2 konfiguraciju:
```bash
pm2 save
```

## Pull najnovije promjene i restart:
```bash
# Prvo pronađi putanju aplikacije (obično je ~/office-app ili ~/bar-app)
cd ~/office-app
# ili
cd ~/bar-app

# Pull najnovije promjene
git pull origin main

# Instaliraj nove zavisnosti (ako ima)
npm install

# Build aplikaciju
npm run build

# Restart PM2 procesa
pm2 restart office-app

# Proveri logove (prvo 50 linija)
pm2 logs office-app --lines 50
```

## Dodaj display_order kolonu u cjenovnik tabelu:
```bash
# Lokalno (iz root direktorija projekta):
npm run migrate:display-order

# Ili direktno: 
node scripts/add-display-order-column.js

# Na serveru (nakon što se push-uje kod):
cd ~/bar-app  # ili ~/office-app
npm run migrate:display-order
```

## Kreiraj support_messages tabelu za chat sistem:
```bash
# Na serveru, prijavite se u PostgreSQL:
sudo -u postgres psql office_app

# Zatim kopirajte i izvršite SQL komande iz SUPPORT_CHAT_MIGRATION.md
# Ili direktno:
psql -U postgres -d office_app -f scripts/create-support-messages-table.sql
```

sifra servera officeapp