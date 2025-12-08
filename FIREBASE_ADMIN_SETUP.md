# Firebase Admin SDK Setup za Vercel

## Problem
API route `/api/list-users` koristi Firebase Admin SDK koji zahtijeva dodatne environment varijable koje nisu postavljene na Vercel-u.

## Rješenje

### 1. Dobij Service Account Credentials iz Firebase Console

1. Otvori Firebase Console: https://console.firebase.google.com/project/zadnji-projekt/settings/serviceaccounts/adminsdk
2. Klikni na **"Generate New Private Key"**
3. Klikni **"Generate Key"** u pop-up prozoru
4. Preuzmi JSON fajl (npr. `zadnji-projekt-firebase-adminsdk-xxxxx.json`)

### 2. Izvuci Podatke iz JSON Fajla

Otvori preuzeti JSON fajl i uzmi sljedeće vrijednosti:

```json
{
  "type": "service_account",
  "project_id": "zadnji-projekt",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@zadnji-projekt.iam.gserviceaccount.com",
  ...
}
```

Potrebne vrijednosti:
- **FIREBASE_PROJECT_ID**: `zadnji-projekt` (ili `project_id` iz JSON-a)
- **FIREBASE_CLIENT_EMAIL**: `client_email` iz JSON-a
- **FIREBASE_PRIVATE_KEY**: `private_key` iz JSON-a (cijeli string sa `\n` karakterima)

### 3. Dodaj Environment Varijable na Vercel-u

#### Opcija A: Preko Vercel Dashboard-a (Preporučeno)

1. Otvori: https://vercel.com/dashboard
2. Odaberi projekat: **finalni-projekt-1** (ili ime tvog projekta)
3. Idi na: **Settings** → **Environment Variables**
4. Dodaj sljedeće varijable (za **Production**, **Preview**, i **Development**):

   **Varijabla 1:**
   - **Key**: `FIREBASE_PROJECT_ID`
   - **Value**: `zadnji-projekt`
   - **Environments**: ✅ Production, ✅ Preview, ✅ Development

   **Varijabla 2:**
   - **Key**: `FIREBASE_CLIENT_EMAIL`
   - **Value**: `firebase-adminsdk-xxxxx@zadnji-projekt.iam.gserviceaccount.com` (iz JSON fajla)
   - **Environments**: ✅ Production, ✅ Preview, ✅ Development

   **Varijabla 3:**
   - **Key**: `FIREBASE_PRIVATE_KEY`
   - **Value**: Cijeli `private_key` string iz JSON fajla (uključujući `-----BEGIN PRIVATE KEY-----` i `-----END PRIVATE KEY-----`)
   - **IMPORTANT**: Kada kopiraš private key, osiguraj se da su `\n` karakteri sačuvani (ili ih zamijeni sa stvarnim novim linijama)
   - **Environments**: ✅ Production, ✅ Preview, ✅ Development

5. **VAŽNO**: Nakon dodavanja varijabli, klikni **"Redeploy"** na projekat da se promjene primijene.

#### Opcija B: Preko Vercel CLI

```bash
# Instaliraj Vercel CLI (ako nije instaliran)
npm i -g vercel

# Login u Vercel
vercel login

# Dodaj environment varijable
vercel env add FIREBASE_PROJECT_ID production
# Unesite: zadnji-projekt

vercel env add FIREBASE_CLIENT_EMAIL production
# Unesite: firebase-adminsdk-xxxxx@zadnji-projekt.iam.gserviceaccount.com

vercel env add FIREBASE_PRIVATE_KEY production
# Unesite: -----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
# (ili paste-uj cijeli private key string)

# Redeploy projekat
vercel --prod
```

### 4. Dodaj u Lokalni .env.local (za lokalni razvoj)

Dodaj sljedeće u `.env.local` fajl u root folderu projekta:

```env
FIREBASE_PROJECT_ID=zadnji-projekt
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@zadnji-projekt.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**VAŽNO**: 
- `FIREBASE_PRIVATE_KEY` mora biti u navodnicima i sa `\n` karakterima
- Ne commit-uj `.env.local` u git (već je u `.gitignore`)

### 5. Provjera

Nakon postavljanja environment varijabli:

1. **Vercel**: Provjeri da li je redeploy prošao uspješno
2. **Lokalno**: Restartuj development server (`npm run dev`)
3. **Test**: Prijavite se kao admin i provjerite da li `/admin` stranica učitava korisnike bez greške

## Firebase Projekat Informacije

- **Project ID**: `zadnji-projekt`
- **Firebase Console**: https://console.firebase.google.com/project/zadnji-projekt/overview
- **Service Accounts**: https://console.firebase.google.com/project/zadnji-projekt/settings/serviceaccounts/adminsdk

## Troubleshooting

Ako i dalje imate probleme:

1. Provjeri da li su sve tri varijable dodane na Vercel-u
2. Provjeri da li je redeploy prošao uspješno
3. Provjeri Vercel build logs za greške
4. Provjeri da li je `FIREBASE_PRIVATE_KEY` ispravno formatiran (sa `\n` karakterima)
5. Provjeri da li Service Account ima potrebne dozvole u Firebase Console

