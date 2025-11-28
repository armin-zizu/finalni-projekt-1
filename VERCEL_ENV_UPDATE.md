# Ažuriranje Firebase Environment Varijabli na Vercel-u

## Problem
API kod ne radi jer su environment varijable postavljene za obrisani Firebase projekat.

## Rješenje

### 1. Lokalno (.env.local) ✅
Fajl `.env.local` je već ažuriran sa ispravnim credentials iz projekta **"zadnji-projekt"**.

### 2. Vercel Environment Varijable

Trebate ažurirati environment varijable na Vercel-u:

#### Opcija A: Preko Vercel Dashboard-a (Preporučeno)

1. Otvorite: https://vercel.com/dashboard
2. Odaberite projekat: **finalni-projekt-1** (ili ime vašeg projekta)
3. Idite na: **Settings** → **Environment Variables**
4. Ažurirajte sljedeće varijable:

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyB1PZRZcpjrOvpwEWunbHiUstIUuYIE6k4
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=zadnji-projekt.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=zadnji-projekt
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=zadnji-projekt.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=917711656028
NEXT_PUBLIC_FIREBASE_APP_ID=1:917711656028:web:34b091221909d7f4ab0299
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-6V3P7P2FK3
```

5. **VAŽNO**: Nakon dodavanja/ažuriranja varijabli, kliknite **"Redeploy"** na projekat da se promjene primijene.

#### Opcija B: Preko Vercel CLI

```bash
# Instaliraj Vercel CLI (ako nije instaliran)
npm i -g vercel

# Login u Vercel
vercel login

# Dodaj environment varijable
vercel env add NEXT_PUBLIC_FIREBASE_API_KEY production
# Unesite: AIzaSyB1PZRZcpjrOvpwEWunbHiUstIUuYIE6k4

vercel env add NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN production
# Unesite: zadnji-projekt.firebaseapp.com

vercel env add NEXT_PUBLIC_FIREBASE_PROJECT_ID production
# Unesite: zadnji-projekt

vercel env add NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET production
# Unesite: zadnji-projekt.firebasestorage.app

vercel env add NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID production
# Unesite: 917711656028

vercel env add NEXT_PUBLIC_FIREBASE_APP_ID production
# Unesite: 1:917711656028:web:34b091221909d7f4ab0299

vercel env add NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID production
# Unesite: G-6V3P7P2FK3

# Redeploy projekat
vercel --prod
```

## Firebase Projekat Informacije

- **Project ID**: `zadnji-projekt`
- **Display Name**: `finalni-projekt`
- **Project Number**: `917711656028`
- **Firebase Console**: https://console.firebase.google.com/project/zadnji-projekt/overview

## Provjera

Nakon ažuriranja environment varijabli:

1. **Lokalno**: Restartujte development server (`npm run dev`)
2. **Vercel**: Provjerite da li je redeploy prošao uspješno
3. **Test**: Prijavite se u aplikaciju i provjerite da li radi autentifikacija i Firestore

## Troubleshooting

Ako i dalje imate probleme:

1. Provjerite da li su sve varijable dodane u Vercel-u
2. Provjerite da li je redeploy prošao uspješno
3. Provjerite Vercel build logs za greške
4. Provjerite Firebase Console da li su pravila (Firestore Rules) ispravna


