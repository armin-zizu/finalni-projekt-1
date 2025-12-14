# Fix Server Action Error

## Problem
Greška: `Error: Failed to find Server Action "x". This request might be from an older or newer deployment.`

## Rješenje

Ova greška se javlja kada build nije sinkronizovan. Potrebno je:

### 1. Obriši .next folder i rebuild

```bash
cd ~/bar-app
rm -rf .next
npm run build
pm2 restart office-app
```

### 2. Ako problem i dalje postoji, potpuni restart

```bash
cd ~/bar-app
pm2 delete all
rm -rf .next
npm run build
pm2 start npm --name "office-app" -- start
pm2 save
```

### 3. Provjeri da li postoje cache problemi

```bash
cd ~/bar-app
rm -rf .next node_modules/.cache
npm run build
pm2 restart office-app
```

## Provjera

Nakon rebuild-a:
```bash
pm2 logs office-app --lines 50
```

Greška bi trebala nestati.

