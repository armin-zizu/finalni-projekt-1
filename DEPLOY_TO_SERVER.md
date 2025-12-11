# Instrukcije za Deployment na Server

## Koraci za deployment novih promjena:

### 1. Povezivanje na server:
```bash
ssh root@<server-ip>
```

### 2. Idi u direktorij aplikacije:
```bash
cd ~/bar-app
```

### 3. Pull najnovije promjene sa GitHuba:
```bash
git pull origin main
```

### 4. Instaliraj nove dependencies (ako ih ima):
```bash
npm install
```

### 5. Build aplikacije:
```bash
npm run build
```

### 6. Restart PM2 procesa:
```bash
pm2 restart office-app
```

### 7. Provjeri status:
```bash
pm2 status
pm2 logs office-app --lines 50
```

## Kompletan niz komandi (jedna po jedna):
```bash
cd ~/bar-app
git pull origin main
npm install
npm run build
pm2 restart office-app
pm2 logs office-app --lines 50
```

## Ako se pojavi greška pri build-u:
- Provjeri logove: `pm2 logs office-app`
- Provjeri da li su sve environment varijable postavljene: `cat .env.local`
- Provjeri da li port 3001 nije zauzet: `netstat -tulpn | grep 3001`

## Ako treba zaustaviti aplikaciju:
```bash
pm2 stop office-app
```

## Ako treba potpuno restartovati:
```bash
pm2 delete office-app
pm2 start npm --name "office-app" -- start
pm2 save
```
