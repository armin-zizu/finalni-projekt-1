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

cd ~/bar-app && git pull origin main && npm run build && pm2 restart office-app --update-env

## Dodaj display_order kolonu u cjenovnik tabelu (NA SERVERU):
```bash
# Na serveru (nakon što se push-uje kod i pull-uješ promjene):
cd ~/bar-app  # ili ~/office-app
git pull origin main
npm install  # ako ima novih zavisnosti
npm run migrate:display-order
```

**VAŽNO:** Ova migracija MORA biti pokrenuta na serveru sa admin pristupom bazi. 
Lokalno neće raditi jer nemaš dozvole, ali aplikacija će raditi sa fallback logikom.

Nakon migracije, redoslijed artikala će se čuvati i biti perzistentan!