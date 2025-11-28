# ⚠️ HITNO: Ažuriraj Environment Varijable na Vercel-u!

## Problem
Aplikacija koristi **STARI API key** iz obrisanog Firebase projekta:
- ❌ Stari (neispravan): `AIzaSyAj0So6ODm7uJzQPshWwKt4jquMtKe2gNM`
- ✅ Novi (ispravan): `AIzaSyB1PZRZcpjrOvpwEWunbHiUstIUuYIE6k4`

## Rješenje - HITNO!

### 1. Otvori Vercel Dashboard

👉 **https://vercel.com/dashboard**

### 2. Odaberi Projekat

Klikni na projekat: **finalni-projekt-1** (ili ime tvog projekta)

### 3. Idi na Environment Variables

1. Klikni na **"Settings"** (Postavke)
2. Klikni na **"Environment Variables"** u lijevom meniju

### 4. Obriši Stare Varijable

Pronađi i **OBRIŠI** sve varijable koje počinju sa `NEXT_PUBLIC_FIREBASE_`:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`

### 5. Dodaj Nove Varijable

Klikni **"Add New"** i dodaj sljedeće varijable (za **Production**, **Preview**, i **Development**):

#### Varijabla 1:
- **Key**: `NEXT_PUBLIC_FIREBASE_API_KEY`
- **Value**: `AIzaSyB1PZRZcpjrOvpwEWunbHiUstIUuYIE6k4`
- **Environment**: ✅ Production, ✅ Preview, ✅ Development

#### Varijabla 2:
- **Key**: `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- **Value**: `zadnji-projekt.firebaseapp.com`
- **Environment**: ✅ Production, ✅ Preview, ✅ Development

#### Varijabla 3:
- **Key**: `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- **Value**: `zadnji-projekt`
- **Environment**: ✅ Production, ✅ Preview, ✅ Development

#### Varijabla 4:
- **Key**: `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- **Value**: `zadnji-projekt.firebasestorage.app`
- **Environment**: ✅ Production, ✅ Preview, ✅ Development

#### Varijabla 5:
- **Key**: `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- **Value**: `917711656028`
- **Environment**: ✅ Production, ✅ Preview, ✅ Development

#### Varijabla 6:
- **Key**: `NEXT_PUBLIC_FIREBASE_APP_ID`
- **Value**: `1:917711656028:web:34b091221909d7f4ab0299`
- **Environment**: ✅ Production, ✅ Preview, ✅ Development

#### Varijabla 7:
- **Key**: `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`
- **Value**: `G-6V3P7P2FK3`
- **Environment**: ✅ Production, ✅ Preview, ✅ Development

### 6. **VAŽNO: Redeploy Projekat!**

Nakon dodavanja varijabli:

1. Idi na **"Deployments"** tab
2. Pronađi najnoviji deployment
3. Klikni na **"..."** (tri tačke)
4. Klikni **"Redeploy"**
5. Potvrdi redeploy

**ILI**

1. Idi na **"Settings"** → **"General"**
2. Scroll dole do **"Redeploy"** sekcije
3. Klikni **"Redeploy"**

### 7. Provjeri da li radi

Nakon redeploy-a (obično traje 1-2 minuta):

1. Otvori aplikaciju na Vercel URL-u
2. Otvori Browser Console (F12)
3. Provjeri da li vidiš: `Firebase Config Check: { isCorrectApiKey: true, ... }`
4. Pokušaj se registrirati/prijaviti

## Brza Provjera

Nakon redeploy-a, u browser konzoli trebao bi vidjeti:
```
Firebase Config Check: {
  apiKeyPrefix: "AIzaSyB1PZRZcpjrOvpwEWunbHiUstIUuYIE6k4...",
  isCorrectApiKey: true,
  ...
}
```

Ako vidiš `isOldApiKey: true`, znači da environment varijable još nisu ažurirane.

## Firebase Projekat

- **Project ID**: `zadnji-projekt`
- **Display Name**: `finalni-projekt`
- **Firebase Console**: https://console.firebase.google.com/project/zadnji-projekt/overview

## Troubleshooting

Ako i dalje ne radi nakon redeploy-a:

1. Provjeri da li su sve varijable dodane (7 varijabli)
2. Provjeri da li su dodane za sve environment-e (Production, Preview, Development)
3. Provjeri Vercel build logs da li ima grešaka
4. Provjeri da li je redeploy prošao uspješno
5. Očisti browser cache i pokušaj ponovo


