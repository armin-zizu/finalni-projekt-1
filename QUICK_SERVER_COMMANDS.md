# Brze komande za server

## Pokreni aplikaciju:
```bash
pm2 start npm --name "office-app" -- start
```

## Restart aplikacije:
```bash
pm2 restart office-app
```

## Zaustavi aplikaciju:
```bash
pm2 stop office-app
```

## Provjeri status:
```bash
pm2 status
```

## Pregled logova:
```bash
pm2 logs office-app
```

## Sačuvaj PM2 konfiguraciju:
```bash
pm2 save
```

## Pull najnovije promjene i restart:
```bash
cd ~/bar-app
git pull origin main
npm run build
pm2 restart office-app
```

