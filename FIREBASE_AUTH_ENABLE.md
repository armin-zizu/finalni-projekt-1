# Omogućavanje Email/Password Autentifikacije u Firebase

## Problem
```
Firebase: Error (auth/configuration-not-found)
Status: 400 (Bad Request)
```

Ova greška se javlja kada **Email/Password autentifikacija nije omogućena** u Firebase Console.

## Rješenje

### 1. Otvori Firebase Console

👉 **https://console.firebase.google.com/project/zadnji-projekt/authentication/providers**

### 2. Omogući Email/Password Sign-in Method

1. U lijevom meniju klikni na **"Authentication"**
2. Klikni na tab **"Sign-in method"** (ili **"Načini prijave"**)
3. Pronađi **"Email/Password"** u listi
4. Klikni na **"Email/Password"**
5. Uključi **"Enable"** (ili **"Omogući"**)
6. Opcionalno: Uključi **"Email link (passwordless sign-in)"** ako želiš
7. Klikni **"Save"** (ili **"Spremi"**)

### 3. Provjeri da li je omogućeno

Nakon što omogućiš Email/Password, trebao bi vidjeti:
- ✅ **Status**: Enabled (Omogućeno)
- ✅ **Email/Password**: Enabled

### 4. Restartuj Development Server

Nakon omogućavanja autentifikacije:

```bash
# Zaustavi dev server (Ctrl+C)
# Restartuj
npm run dev
```

### 5. Pokušaj se prijaviti ponovo

Sada bi trebalo raditi! 🎉

## Alternativno: Provjeri preko Firebase CLI

```bash
# Provjeri autentifikacijske metode
firebase auth:export users.json --project zadnji-projekt
```

## Troubleshooting

### Ako i dalje ne radi:

1. **Provjeri da li je projekat ispravan:**
   - Project ID: `zadnji-projekt`
   - Firebase Console: https://console.firebase.google.com/project/zadnji-projekt

2. **Provjeri API key ograničenja:**
   - Idi na: **Project Settings** → **General** → **Your apps**
   - Provjeri da li API key ima ograničenja

3. **Provjeri da li je korisnik kreiran:**
   - Idi na: **Authentication** → **Users**
   - Provjeri da li postoji korisnik sa email-om `gitara.zizu@GMAIL.COM`

4. **Ako korisnik ne postoji, kreiraj ga:**
   - Idi na: **Authentication** → **Users** → **Add user**
   - Unesi email i password
   - Klikni **"Add user"**

## Firebase Console Linkovi

- **Authentication Settings**: https://console.firebase.google.com/project/zadnji-projekt/authentication/providers
- **Users List**: https://console.firebase.google.com/project/zadnji-projekt/authentication/users
- **Project Settings**: https://console.firebase.google.com/project/zadnji-projekt/settings/general

