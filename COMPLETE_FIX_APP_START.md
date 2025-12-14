# Kompletno Rješenje - Pokretanje Aplikacije

## Problem
- Build je prekinut (^C)
- Port 3001 je zauzet
- Više PM2 procesa

## Rješenje - Korak po Korak

### 1. Obriši SVE procese i oslobodi port

```bash
# Obriši sve PM2 procese
pm2 delete all

# Ubij sve next-server procese
pkill -f "next-server"
pkill -f "next start"
pkill -f node

# Provjeri da li je port oslobođen
netstat -tulpn | grep 3001

# Ako i dalje postoji proces, ubij ga direktno
sudo kill -9 $(sudo lsof -t -i:3001)

# Ili provjeri PID i ubij ručno
sudo lsof -i:3001
# Zatim: sudo kill -9 <PID>
```

### 2. Očisti .next folder

```bash
cd ~/bar-app
rm -rf .next
```

### 3. Build aplikacije (NEMOJ prekidati!)

```bash
cd ~/bar-app
npm run build
```

**VAŽNO:** Ne prekidaj build proces (ne pritisni Ctrl+C). Može trajati 1-2 minute. Sačekaj da vidiš:
```
✓ Compiled successfully
✓ Collecting page data
✓ Generating static pages
✓ Finalizing page optimization
```

### 4. Provjeri da li je build završen

```bash
ls -la .next
# Trebao bi postojati folder sa fajlovima
```

### 5. Pokreni aplikaciju

```bash
cd ~/bar-app
PORT=3001 pm2 start npm --name "office-app" -- start
```

### 6. Provjeri status

```bash
pm2 status
pm2 logs office-app --lines 30
```

### 7. Sačuvaj PM2

```bash
pm2 save
```

## Sve u Jednom (Nakon što ubiješ procese)

```bash
cd ~/bar-app && \
pm2 delete all && \
pkill -f "next" && \
pkill -f node && \
sleep 2 && \
rm -rf .next && \
npm run build && \
PORT=3001 pm2 start npm --name "office-app" -- start && \
pm2 save && \
pm2 logs office-app
```

**VAŽNO:** Ne prekidaj build proces. Sačekaj da završi!

## Ako Port I Dalje Nije Oslobođen

```bash
# Pronađi i ubij proces koji drži port
sudo lsof -i:3001
# Kopiraj PID i ubij:
sudo kill -9 <PID>

# Ili forsiraj oslobađanje porta
sudo fuser -k 3001/tcp
```

## Provjera da Radi

```bash
# Provjeri da li aplikacija radi
curl http://localhost:3001

# Ili u browseru
# http://46.224.115.49:3001
```

