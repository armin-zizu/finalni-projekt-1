# Kako Provjeriti Logove na Serveru

## Metoda 1: PM2 Logovi (Najlakša)

### Pregled poslednjih 50 linija:
```bash
pm2 logs office-app --lines 50
```

### Pregled svih logova (real-time):
```bash
pm2 logs office-app
```
Za izlaz: pritisni `Ctrl+C`

### Pregled samo error logova:
```bash
pm2 logs office-app --err --lines 100
```

### Pregled samo output logova:
```bash
pm2 logs office-app --out --lines 100
```

---

## Metoda 2: Direktni pristup log fajlovima

PM2 čuva logove u:
- **Output logovi:** `/root/.pm2/logs/office-app-out.log`
- **Error logovi:** `/root/.pm2/logs/office-app-error.log`

### Pregled poslednjih 100 linija error loga:
```bash
tail -n 100 /root/.pm2/logs/office-app-error.log
```

### Pregled poslednjih 100 linija output loga:
```bash
tail -n 100 /root/.pm2/logs/office-app-out.log
```

### Pregled svih logova (od početka):
```bash
cat /root/.pm2/logs/office-app-error.log
cat /root/.pm2/logs/office-app-out.log
```

### Pretraga za određenu grešku (npr. "Database"):
```bash
grep -i "database" /root/.pm2/logs/office-app-error.log
grep -i "database" /root/.pm2/logs/office-app-out.log
```

### Pretraga za grešku sa kontekstom (10 linija prije i posle):
```bash
grep -i -A 10 -B 10 "database" /root/.pm2/logs/office-app-error.log
```

---

## Metoda 3: Kombinovani pregled (output + error)

### Pregled oba log fajla odjednom:
```bash
tail -n 50 /root/.pm2/logs/office-app-out.log
tail -n 50 /root/.pm2/logs/office-app-error.log
```

### Pregled real-time (kao `tail -f`):
```bash
tail -f /root/.pm2/logs/office-app-error.log
```
Za izlaz: pritisni `Ctrl+C`

---

## Šta Tražiti u Logovima

### 1. Database Connection Greške:
Traži:
- `SASL: SCRAM-SERVER-FIRST-MESSAGE`
- `password must be a string`
- `connection refused`
- `Database connection error`
- `Database query error`

### 2. Authentication Greške:
Traži:
- `Unauthorized`
- `Invalid token`
- `JWT_SECRET`
- `Not authenticated`

### 3. Login Greške:
Traži:
- `Login attempt started`
- `Login request for email:`
- `Invalid email or password`
- `Database query error in login`

### 4. Environment Variables:
Traži:
- `hasDATABASE_URL:`
- `Initializing database pool:`
- `safeConnectionString:`

---

## Korisne Komande za Debugging

### 1. Provjeri da li aplikacija radi:
```bash
pm2 status
```

### 2. Provjeri environment variables koje PM2 vidi:
```bash
pm2 env 0
```

### 3. Provjeri da li .env.local postoji i šta sadrži:
```bash
cd ~/bar-app
ls -la .env.local
cat .env.local
```

**VAŽNO:** Ovo će prikazati lozinke u plain textu - pazi gdje kopiraš output!

### 4. Provjeri da li se možeš povezati na bazu:
```bash
psql -U postgres -d office_app -c "SELECT NOW();"
```

### 5. Provjeri da li PostgreSQL radi:
```bash
sudo systemctl status postgresql
```

### 6. Provjeri koji port koristi aplikacija:
```bash
netstat -tulpn | grep 3001
```

---

## Preporučeni Redoslijed Provjere

### Korak 1: Provjeri status aplikacije
```bash
pm2 status
pm2 logs office-app --lines 50
```

### Korak 2: Provjeri error logove
```bash
tail -n 100 /root/.pm2/logs/office-app-error.log
```

### Korak 3: Provjeri environment variables
```bash
cd ~/bar-app
cat .env.local
pm2 env 0 | grep DATABASE_URL
```

### Korak 4: Provjeri database connection
```bash
psql -U postgres -d office_app -c "SELECT NOW();"
```

### Korak 5: Provjeri output logove za detalje
```bash
tail -n 100 /root/.pm2/logs/office-app-out.log | grep -i "database\|login\|auth"
```

---

## Kopiranje Logova za Dijeljenje

### Kopiraj poslednje 100 linija error loga:
```bash
tail -n 100 /root/.pm2/logs/office-app-error.log > /tmp/error-log.txt
cat /tmp/error-log.txt
```

Onda možeš kopirati sadržaj iz `/tmp/error-log.txt` i poslati.

### Ili direktno kopiraj poslednje linije:
```bash
tail -n 100 /root/.pm2/logs/office-app-error.log
```
Onda kopiraj output iz terminala i pošalji.

---

## Tipični Problemi i Šta Tražiti

### Problem: "SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string"
**Traži u logu:**
- `hasDATABASE_URL: false` ili `hasDATABASE_URL: true`
- `safeConnectionString: 'postgresql://postgres:@localhost...'` (prazna lozinka)

**Rješenje:** `.env.local` nema `DATABASE_URL` ili `DATABASE_URL` nema lozinku.

---

### Problem: "Database connection error"
**Traži u logu:**
- `connection refused`
- `timeout`
- `ECONNREFUSED`

**Rješenje:** PostgreSQL možda ne radi ili lozinka nije tačna.

---

### Problem: "Unauthorized" ili "Invalid token"
**Traži u logu:**
- `JWT_SECRET is not configured`
- `Auth middleware error`

**Rješenje:** `JWT_SECRET` nije postavljen u `.env.local`.

---

### Problem: "Login works but redirects to wrong page"
**Traži u logu:**
- `Login attempt started`
- `Login request for email:`
- `Token uspješno verificiran`

**Rješenje:** Problem je u frontend-u, ne u API-ju.

---

## Komanda za Sve od Jednom

Ako želiš sve važne informacije odjednom:

```bash
echo "=== PM2 STATUS ==="
pm2 status
echo ""
echo "=== ERROR LOG (last 50 lines) ==="
tail -n 50 /root/.pm2/logs/office-app-error.log
echo ""
echo "=== OUTPUT LOG (last 50 lines) ==="
tail -n 50 /root/.pm2/logs/office-app-out.log
echo ""
echo "=== ENV CHECK ==="
cd ~/bar-app
echo "DATABASE_URL exists:" 
grep -c "DATABASE_URL" .env.local 2>/dev/null && echo "YES" || echo "NO"
echo "JWT_SECRET exists:"
grep -c "JWT_SECRET" .env.local 2>/dev/null && echo "YES" || echo "NO"
echo ""
echo "=== POSTGRESQL STATUS ==="
sudo systemctl status postgresql --no-pager | head -n 5
```

Kopiraj output ovih komandi i pošalji mi.

