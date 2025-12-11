# Firebase Data Export & Import Guide

Ovaj vodič objašnjava kako eksportovati podatke sa Firebase (Vercel produkcije) i importovati ih u PostgreSQL.

## 📋 Preduslovi

1. **Firebase Service Account Key**
   - Potrebno je imati Firebase Service Account JSON fajl
   - Vidi: `KAKO_DOBITI_SERVICE_ACCOUNT.md` (ako postoji)
   - Ili: Firebase Console → Project Settings → Service Accounts → Generate New Private Key

2. **Node.js paketi**
   ```bash
   npm install firebase-admin pg dotenv
   ```

3. **PostgreSQL baza**
   - Baza mora biti kreirana (koristi `database_schema.sql`)
   - Connection string u `.env.local` ili `DATABASE_URL` environment variable

## 🚀 Korak 1: Eksport sa Firebase

### Opcija A: Koristi Service Account fajl

1. Stavi `firebase-service-account.json` u root direktorijum projekta
2. Pokreni:
   ```bash
   node scripts/export-firebase-data.js
   ```

### Opcija B: Koristi Environment Variable

1. Postavi environment variable:
   ```bash
   # Windows PowerShell
   $env:FIREBASE_SERVICE_ACCOUNT_KEY = '{"type":"service_account",...}'
   
   # Linux/Mac
   export FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
   ```

2. Ili koristi fajl path:
   ```bash
   export FIREBASE_SERVICE_ACCOUNT_PATH="./path/to/service-account.json"
   ```

3. Pokreni:
   ```bash
   node scripts/export-firebase-data.js
   ```

### Rezultat

Skripta će kreirati `exported-data/firebase-export.json` sa svim podacima:
- ✅ Korisnici (users)
- ✅ Uređaji (devices)
- ✅ Obračuni (obracuni) za svakog korisnika
- ✅ Sesije (sessions) za svakog korisnika
- ✅ Cjenovnik za svakog korisnika
- ✅ Subscriptions za svakog korisnika
- ✅ Storage fajlovi (fakture) - linkovi za download

## 🚀 Korak 2: Import u PostgreSQL

1. Provjeri da je PostgreSQL baza spremna:
   ```bash
   # Na serveru
   sudo -u postgres psql -d office_app -f database_schema.sql
   ```

2. Provjeri connection string u `.env.local`:
   ```env
   DB_USER=office_user
   DB_PASSWORD=Jasamkonj12_
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=office_app
   ```

3. Pokreni import:
   ```bash
   node scripts/import-to-postgresql.js
   ```

### Rezultat

Skripta će:
- ✅ Importovati sve korisnike (po email-u, bez duplikata)
- ✅ Importovati sve uređaje
- ✅ Importovati sesije, cjenovnik i obračune za svakog korisnika
- ⚠️  **Napomena**: Lozinke se ne mogu migrirati (korisnici će trebati reset lozinke)

## ⚠️ Važne napomene

### Lozinke

Firebase koristi drugačiji sistem lozinki. **Lozinke se ne mogu direktno migrirati**. Korisnici će trebati:
- Reset lozinke preko "Forgot Password" funkcionalnosti
- Ili admin može postaviti novu lozinku

### Storage fajlovi (Fakture)

Storage fajlovi se eksportuju kao signed URLs u JSON fajlu. Za potpunu migraciju:
1. Download-uj sve fajlove sa signed URLs
2. Upload-uj ih na novi storage sistem (npr. S3, lokalni server, itd.)
3. Update-uj reference u bazi podataka

### Backup

Uvijek napravi backup prije importa:
```bash
pg_dump -U office_user -d office_app > backup_before_import.sql
```

## 🔧 Troubleshooting

### "Cannot find Firebase Service Account"
- Provjeri da li postoji `firebase-service-account.json` u root direktorijumu
- Ili postavi `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable

### "Connection refused" pri importu
- Provjeri da li PostgreSQL radi: `sudo systemctl status postgresql`
- Provjeri connection string u `.env.local`
- Provjeri da li korisnik `office_user` ima pristup bazi

### "Duplicate key" greške
- Skripta koristi `ON CONFLICT DO NOTHING` - već postojeći podaci se preskaču
- Ovo je normalno ako pokrećeš import više puta

### "Invalid timestamp" greške
- Firebase Timestamp objekti se automatski konvertuju
- Ako i dalje ima problema, provjeri format datuma u eksportovanom JSON-u

## 📝 Sledeći koraci nakon importa

1. **Testiraj prijavu korisnika**
   - Korisnici će trebati reset lozinke
   - Implementiraj "Forgot Password" funkcionalnost ako već nije

2. **Migriraj Storage fajlove**
   - Download-uj fakture sa signed URLs
   - Upload-uj na novi storage sistem
   - Update-uj file references u aplikaciji

3. **Testiraj sve funkcionalnosti**
   - Dashboard
   - Obračuni
   - Arhiva
   - Cjenovnik
   - Profile

4. **Update frontend kod**
   - Zamijeni Firebase calls sa API calls
   - Testiraj sve stranice






