# Rješavanje Firebase API Key Greške

## Problem
```
Firebase: Error (auth/api-key-not-valid.-please-pass-a-valid-api-key.)
```

## Rješenje

### 1. Provjeri `.env.local` fajl ✅
Fajl je već ažuriran sa ispravnim credentials iz projekta **"zadnji-projekt"**.

### 2. **VAŽNO: Restartuj Development Server**

Next.js ne učitava environment varijable dok se server ne restartuje!

```bash
# Zaustavi trenutni dev server (Ctrl+C)
# Zatim pokreni ponovo:
npm run dev
```

### 3. Provjeri da li se environment varijable učitavaju

Nakon restartovanja servera, otvori browser konzolu i provjeri da li vidiš:
```
Firebase Config Check: { hasApiKey: true, apiKeyPrefix: "AIzaSyB1PZ...", ... }
```

Ako vidiš `hasApiKey: false`, znači da se environment varijable ne učitavaju.

### 4. Ako i dalje ne radi

#### Provjeri `.env.local` format:
- **NE** smije biti razmaka oko `=`
- **NE** smije biti navodnika oko vrijednosti
- **MORA** biti u root direktoriju projekta (isti nivo kao `package.json`)

Primjer ispravnog formata:
```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyB1PZRZcpjrOvpwEWunbHiUstIUuYIE6k4
```

#### Provjeri da li `.env.local` postoji:
```bash
# Windows
dir .env.local

# Ili
type .env.local
```

#### Obriši `.next` cache i restartuj:
```bash
# Obriši Next.js cache
rm -rf .next
# Ili na Windows:
rmdir /s /q .next

# Restartuj dev server
npm run dev
```

### 5. Firebase Credentials (za referencu)

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyB1PZRZcpjrOvpwEWunbHiUstIUuYIE6k4
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=zadnji-projekt.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=zadnji-projekt
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=zadnji-projekt.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=917711656028
NEXT_PUBLIC_FIREBASE_APP_ID=1:917711656028:web:34b091221909d7f4ab0299
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-6V3P7P2FK3
```

### 6. Ako i dalje ne radi - Provjeri Firebase Console

1. Otvori: https://console.firebase.google.com/project/zadnji-projekt/settings/general
2. Idite na: **Project Settings** → **Your apps**
3. Provjeri da li je app aktivna
4. Ako treba, kreiraj novu web app i uzmi nove credentials

## Debug Logovi

U `firebase.ts` su dodani debug logovi koji će se prikazati u browser konzoli kada se učitava Firebase konfiguracija. Provjeri konzolu za detalje.

