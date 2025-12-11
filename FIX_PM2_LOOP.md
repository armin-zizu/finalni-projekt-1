# Fix PM2 restart loop i port 3000

## Problem
PM2 je u restart loop-u jer port 3000 već koristi neki proces (next-server PID 125120).

## Rješenje - Korak po korak:

**1. Zaustavi PM2 potpuno:**
```bash
pm2 kill
```

**2. Ubij sve Node i Next procese:**
```bash
pkill -9 node
pkill -9 next
killall -9 node
```

**3. Pronađi što još koristi port 3000:**
```bash
netstat -tulpn | grep :3000
# Ili
lsof -i :3000
```

**4. Ako vidiš proces (npr. PID 125120), ubij ga:**
```bash
kill -9 125120
```

**5. Sačekaj 2 sekunde i provjeri da li je port oslobođen:**
```bash
lsof -i :3000
```
(Ako ništa ne prikazuje = port je slobodan)

**6. Pokreni PM2 čisto:**
```bash
cd ~/bar-app
pm2 start npm --name "office-app" -- start
pm2 save
pm2 status
pm2 logs office-app --lines 50
```

## Ako i dalje ima problema:

**Koristi drugi port (npr. 3001):**
```bash
PORT=3001 pm2 start npm --name "office-app" -- start
```

Ili dodaj u `.env.local`:
```
PORT=3001
```

## Provjera da li aplikacija radi:

```bash
curl http://localhost:3000
# ili
curl http://localhost:3001
```

Ako dobiješ HTML response = aplikacija radi!

