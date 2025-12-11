# Instrukcije za promjenu porta na 3001

## Problem:
Port 3000 je zauzet, aplikacija ne može pokrenuti.

## Rješenje:

### Opcija 1: Promijeni PORT u .env.local (preporučeno)
```bash
cd ~/bar-app
nano .env.local
```

Dodaj ili promijeni:
```
PORT=3001
```

Zatim restartuj PM2:
```bash
pm2 restart office-app
```

### Opcija 2: Koristi PORT u PM2 komandi
```bash
cd ~/bar-app
pm2 delete office-app
PORT=3001 pm2 start npm --name "office-app" -- start
pm2 save
```

### Opcija 3: Kill proces koji koristi port 3000
```bash
# Pronađi proces
lsof -i :3000
# ili
netstat -tulpn | grep 3000

# Kill proces (zamijeni <PID> sa stvarnim PID)
kill -9 <PID>

# Zatim restartuj PM2
pm2 restart office-app
```

### Provjeri da li radi:
```bash
pm2 status
pm2 logs office-app --lines 20
```

Aplikacija će biti dostupna na: `http://<server-ip>:3001`

