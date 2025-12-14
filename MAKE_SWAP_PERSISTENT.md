# Make Swap File Persistent

## Problem
Swap fajl se kreira, ali se ne mount-uje automatski nakon restart-a servera.

## Rješenje - Dodaj swap u /etc/fstab

### 1. Provjeri da li swap radi

```bash
free -h
swapon --show
```

### 2. Dodaj swap u /etc/fstab (da ostane nakon restart-a)

```bash
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 3. Provjeri da li je dodano

```bash
cat /etc/fstab
# Trebao bi vidjeti: /swapfile none swap sw 0 0
```

## Objašnjenje Memorije

### Build proces (npm run build):
- **Troši:** 2-4GB RAM memorije
- **Kada se koristi:** Samo kada deploy-uješ novu verziju
- **Traje:** 30-60 sekundi
- **Rješenje:** Swap fajl (2GB) + oslobođena memorija

### Produkcijska aplikacija (npm start / PM2):
- **Troši:** 50-200MB RAM memorije
- **Kada se koristi:** Sve vrijeme dok aplikacija radi
- **Traje:** Trajno dok aplikacija radi
- **Rješenje:** Normalno, ne treba swap za produkciju

### Zaključak:
- Build proces je težak (treba swap)
- Produkcija je laka (ne treba swap)
- Swap fajl će pomoći samo kod build-a
- Produkcija će raditi normalno bez problema

