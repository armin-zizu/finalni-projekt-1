# Kako dobiti Firebase Service Account Key

Ovaj fajl objašnjava kako dobiti Firebase Service Account JSON fajl potreban za eksport podataka.

## 📋 Koraci

### 1. Otvori Firebase Console

Idi na: https://console.firebase.google.com/

### 2. Odaberi projekt

Odaberi projekt koji se koristi na Vercel produkciji.

### 3. Project Settings

1. Klikni na **⚙️ Project Settings** (ili Settings → Project settings)
2. Otvori tab **"Service accounts"**

### 4. Generate New Private Key

1. U sekciji "Firebase Admin SDK" klikni na **"Generate new private key"**
2. Potvrdi dijalog (klikni "Generate key")
3. Browser će automatski download-ovati JSON fajl

### 5. Sačuvaj fajl

- **Ime fajla**: `firebase-service-account.json`
- **Lokacija**: Root direktorijum projekta (isti folder gdje je `package.json`)
- ⚠️  **VAŽNO**: Ovaj fajl NE COMMITAJ u git (već je u `.gitignore`)

### 6. Alternativa: Environment Variable

Umjesto fajla, možeš postaviti environment variable sa JSON sadržajem:

**Windows PowerShell:**
```powershell
$json = Get-Content firebase-service-account.json -Raw
$env:FIREBASE_SERVICE_ACCOUNT_KEY = $json
```

**Linux/Mac:**
```bash
export FIREBASE_SERVICE_ACCOUNT_KEY=$(cat firebase-service-account.json)
```

## ✅ Provjera

Nakon što si postavio fajl ili environment variable, pokreni:

```bash
npm run export:firebase
```

Ako sve radi, videćeš:
```
📦 Eksportujem: users
   ✅ Eksportovano X dokumenata
```

## 🔒 Bezbednost

- **NIKADA** ne commitaj `firebase-service-account.json` u git
- Fajl je već dodat u `.gitignore`
- Ako slučajno commit-uješ, odmah:
  1. Obriši fajl iz git-a
  2. Regeneriši novi key u Firebase Console
  3. Stari key postaje nevažeći

## 📝 Napomena

Service Account key daje **potpuni pristup** Firebase projektu:
- Može čitati i pisati sve podatke
- Može brisati podatke
- Koristi ga SAMO za migraciju podataka
- Nakon migracije, možeš ga obrisati ili deaktivirati






