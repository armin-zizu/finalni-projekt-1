# Fix App Not Starting

## Provjeri Status

### 1. Provjeri PM2 status
```bash
pm2 status
```

### 2. Provjeri da li postoji proces
```bash
pm2 list
```

### 3. Provjeri logove
```bash
pm2 logs office-app --lines 100
```

## Pokreni Aplikaciju Korak po Korak

### Korak 1: Idi u direktorij
```bash
cd ~/bar-app
pwd
```

### Korak 2: Provjeri da li postoje fajlovi
```bash
ls -la
ls -la .next
```

### Korak 3: Provjeri package.json
```bash
cat package.json | grep -A 5 "scripts"
```

### Korak 4: Provjeri .env.local
```bash
cat .env.local
```

### Korak 5: Očisti PM2 i pokreni ponovo
```bash
# Obriši sve PM2 procese
pm2 delete all

# Provjeri da li su procesi obrisani
pm2 list

# Provjeri da li .next folder postoji
ls -la .next

# Ako ne postoji, rebuild
npm run build

# Pokreni aplikaciju
pm2 start npm --name "office-app" -- start

# Provjeri status
pm2 status

# Provjeri logove
pm2 logs office-app --lines 50
```

### Korak 6: Ako build ne radi
```bash
# Provjeri Node.js verziju
node --version
npm --version

# Provjeri da li postoje node_modules
ls -la node_modules

# Ako ne postoje, instaliraj dependencies
npm install

# Zatim build
npm run build

# Pokreni
pm2 start npm --name "office-app" -- start
```

### Korak 7: Ako i dalje ne radi, provjeri port
```bash
# Provjeri da li port 3001 sluša
netstat -tulpn | grep 3001

# Ako postoji proces na portu, ubij ga
sudo lsof -ti:3001 | xargs kill -9

# Ili
pkill -f "next start"

# Zatim pokreni ponovo
pm2 start npm --name "office-app" -- start
```

### Korak 8: Sačuvaj PM2 konfiguraciju
```bash
pm2 save
pm2 startup
```

## Debug Komande

### Provjeri da li Next.js može da se pokrene direktno
```bash
cd ~/bar-app
npm run start
```

Ako ovo radi, problem je sa PM2 konfiguracijom.

### Provjeri PM2 ecosystem fajl (ako postoji)
```bash
cat ecosystem.config.js
```

### Ručno pokreni sa logovima
```bash
cd ~/bar-app
NODE_ENV=production PORT=3001 npm start
```

## Hitno Rješenje - Minimalna Konfiguracija

```bash
cd ~/bar-app
pm2 delete all
rm -rf .next
npm run build
PORT=3001 pm2 start npm --name "office-app" -- start
pm2 save
pm2 logs office-app
```

## Ako Ništa Ne Radi

Provjeri logove detaljno:
```bash
pm2 logs office-app --err --lines 200
pm2 logs office-app --out --lines 200
```

Ili provjeri sistem logove:
```bash
journalctl -u pm2-root -n 100
```

