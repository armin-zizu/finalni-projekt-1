# Server Access Information

## Server IP
- **IP Adresa:** `46.224.115.49`
- **Port Aplikacije:** `3001`
- **URL Aplikacije:** `http://46.224.115.49:3001`

## SSH Pristup Serveru

### Windows (PowerShell ili Command Prompt)
```bash
ssh root@46.224.115.49
```

### Ako imaš SSH ključ, možda trebaš:
```bash
ssh -i path/to/your/key.pem root@46.224.115.49
```

### Ako koristiš password:
```bash
ssh root@46.224.115.49
# Unesi password kada se zatraži
```

## Osnovne Komande na Serveru

### Navigacija
```bash
# Idi u direktorij aplikacije
cd ~/bar-app

# Provjeri gdje si
pwd

# Lista fajlova
ls -la
```

### PM2 Komande (Upravljanje aplikacijom)
```bash
# Provjeri status
pm2 status

# Restart aplikacije
pm2 restart office-app

# Stani aplikaciju
pm2 stop office-app

# Pokreni aplikaciju
pm2 start office-app

# Logovi aplikacije
pm2 logs office-app --lines 50

# Logovi u realnom vremenu
pm2 logs office-app
```

### Git Komande
```bash
cd ~/bar-app
git pull origin main
git status
```

### Build Aplikacije
```bash
cd ~/bar-app
npm run build
pm2 restart office-app
```

### PostgreSQL Komande
```bash
# Pristup bazi podataka
sudo -u postgres psql -d office_app

# Izlaz iz psql
\q

# Provjeri korisnike
sudo -u postgres psql -d office_app -c "SELECT id, email, role, is_owner FROM users;"

# Provjeri uređaje
sudo -u postgres psql -d office_app -c "SELECT device_id, device_name, role, status FROM devices WHERE user_id = (SELECT id FROM users WHERE email = 'gitara.zizu@gmail.com');"
```

### Provjera Statusa
```bash
# Provjeri da li aplikacija radi
curl http://localhost:3001

# Provjeri portove
netstat -tulpn | grep 3001

# Provjeri PM2 procese
pm2 list
```

### Restart Servera (Ako je potrebno)
```bash
# Restart PM2
pm2 restart all

# Restart PostgreSQL
sudo systemctl restart postgresql

# Provjeri status PostgreSQL
sudo systemctl status postgresql
```

## Direktoriji

- **Aplikacija:** `~/bar-app` ili `/root/bar-app`
- **PM2 logovi:** `/root/.pm2/logs/`
- **Environment fajl:** `~/bar-app/.env.local`

## Environment Variables

Provjeri env varijable:
```bash
cd ~/bar-app
cat .env.local
```

## Česti Problemi i Rješenja

### Problem: Aplikacija ne radi
```bash
pm2 restart office-app
pm2 logs office-app --lines 50
```

### Problem: Greške u bazi
```bash
sudo -u postgres psql -d office_app
# Zatim SQL komande za provjeru
```

### Problem: Port zauzet
```bash
pm2 delete all
pkill -f node
pm2 start npm --name "office-app" -- start
```

## Backup

### Backup baze podataka
```bash
sudo -u postgres pg_dump office_app > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore baze podataka
```bash
sudo -u postgres psql -d office_app < backup_file.sql
```

