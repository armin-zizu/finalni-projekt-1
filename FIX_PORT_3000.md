# Fix port 3000 already in use

## Problem
Port 3000 je već zauzet nekim procesom.

## Rješenje

**Na serveru pokreni ove komande:**

```bash
# 1. Zaustavi sve PM2 procese i očisti
pm2 delete all

# 2. Pronađi što koristi port 3000
lsof -i :3000
# ili
netstat -tulpn | grep :3000

# 3. Ubij proces koji koristi port 3000 (zamijeni PID sa stvarnim ID-em)
kill -9 <PID>

# Ili jednostavnije - ubij sve Node procese:
pkill -f node

# 4. Provjeri da li je port oslobođen
lsof -i :3000

# 5. Pokreni PM2 ponovo
cd ~/bar-app
pm2 start npm --name "office-app" -- start
pm2 save
```

## Alternativa: Koristi drugi port

Ako želiš koristiti drugi port (npr. 3001):

```bash
PORT=3001 pm2 start npm --name "office-app" -- start
```

Ili u `.env.local` dodaj:
```
PORT=3001
```

