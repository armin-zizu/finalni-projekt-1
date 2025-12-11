# Koristi port 3001 umjesto 3000

## Problem
Port 3000 je zauzet i PM2 automatski restartuje procese.

## Rješenje: Koristi port 3001

### Na serveru:

**1. Dodaj PORT u .env.local:**
```bash
cd ~/bar-app
echo "PORT=3001" >> .env.local
```

Ili uredi .env.local:
```bash
nano .env.local
```
Dodaj liniju: `PORT=3001`

**2. Ubij sve procese:**
```bash
pm2 kill
pkill -9 next
killall -9 next-server
kill -9 206474  # ili bilo koji PID koji se pojavi
```

**3. Pokreni sa PM2:**
```bash
PORT=3001 pm2 start npm --name "office-app" -- start
pm2 save
pm2 status
```

**4. Provjeri da li radi:**
```bash
pm2 logs office-app
curl http://localhost:3001
```

**5. Ako želiš pristupiti preko browsera:**
Aplikacija će biti dostupna na: `http://46.224.115.49:3001`

Ili ako imaš Nginx reverse proxy, konfiguriraj ga da proxy-uje na port 3001.

