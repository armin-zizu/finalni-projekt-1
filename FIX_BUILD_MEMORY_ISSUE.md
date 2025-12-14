# Fix Build Memory Issue

## Problem
Server ima:
- **RAM:** 3.7GB (od čega je 3.1GB zauzeto, samo 651MB slobodno)
- **Disk:** 60GB (ovo je HDD/SSD prostor, nije RAM memorija)

Build proces se ubija (SIGKILL) jer nema dovoljno RAM memorije.

## Rješenje

### 1. Obriši SVE Node procese (uključujući next dev)

```bash
# Pronađi sve Node procese
ps aux | grep node

# Ubij sve Node procese
pkill -9 -f node
pkill -9 -f next

# Provjeri da li su svi obrisani
ps aux | grep node
# Trebao bi vidjeti samo grep proces
```

### 2. Oslobodi memoriju

```bash
# Očisti cache
sync; echo 3 > /proc/sys/vm/drop_caches

# Provjeri memoriju
free -h
# Trebao bi biti više slobodne memorije
```

### 3. Build sa minimalnom memorijom

```bash
cd ~/bar-app
rm -rf .next
NODE_OPTIONS=--max-old-space-size=1536 npm run build
```

### 4. Ili build lokalno i deploy samo .next folder

**Opcija A:** Build lokalno, upload .next folder na server
**Opcija B:** Kreiraj swap fajl za dodatnu memoriju

### 5. Kreiraj swap fajl (ako je potrebno)

```bash
# Kreiraj 2GB swap fajl
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Provjeri
free -h
# Trebao bi vidjeti swap memoriju

# Zatim pokušaj build
cd ~/bar-app
npm run build
```

## Provjera procesa

```bash
# Provjeri sve Node/next procese
ps aux | grep -E "node|next" | grep -v grep

# Provjeri memoriju svih procesa
ps aux --sort=-%mem | head -20
```

