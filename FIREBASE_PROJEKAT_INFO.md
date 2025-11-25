# Firebase Projekat Informacije

## Trenutno aktivni projekat:

**Project ID:** `zadnji-projekt`  
**Display Name:** `finalni-projekt`  
**Project Number:** `917711656028`  
**Status:** ✅ AKTIVAN (current)

## Firebase Console Link:

👉 **https://console.firebase.google.com/project/zadnji-projekt/overview**

## Tvoji Firebase projekti:

1. **kafic-narudzbe**
   - Project ID: `kafic-narudzbe`
   - Project Number: `281367901324`

2. **office-app**
   - Project ID: `office-app-71d3c`
   - Project Number: `400593585937`

3. **OfficeApp**
   - Project ID: `officeapp-f9868`
   - Project Number: `48869379565`

4. **finalni-projekt** ⭐ TRENUTNO AKTIVAN
   - Project ID: `zadnji-projekt`
   - Project Number: `917711656028`
   - Console: https://console.firebase.google.com/project/zadnji-projekt/overview

## Kako provjeriti koji projekat koristiš:

### 1. U kodu:
- `.firebaserc` fajl sadrži: `"default": "zadnji-projekt"`
- Environment varijable (`.env.local`) sadrže Firebase konfiguraciju za ovaj projekat

### 2. U terminalu:
```bash
firebase use
# Output: zadnji-projekt
```

### 3. U Firebase Console:
- Otvori: https://console.firebase.google.com/project/zadnji-projekt/overview
- Provjeri da li vidiš svoje podatke (korisnike, Firestore, itd.)

## Firebase servisi koje koristiš:

1. **Firebase Authentication**
   - Email/Password autentifikacija
   - Korisnici se čuvaju u ovom projektu

2. **Cloud Firestore**
   - Baza podataka
   - Struktura: `users/{userId}/obracuni`, `users/{userId}/subscription`, itd.

3. **Firebase Hosting** (opcionalno)
   - Možeš deploy-ovati aplikaciju ovdje

## Kako promijeniti projekat (ako treba):

```bash
# Lista svih projekata
firebase projects:list

# Promijeni aktivni projekat
firebase use zadnji-projekt  # ili bilo koji drugi Project ID

# Provjeri trenutni projekat
firebase use
```

## Važno:

- **Trenutno koristiš:** `zadnji-projekt` (finalni-projekt)
- **Svi podaci** (korisnici, obračuni, pretplate) su u ovom projektu
- **Environment varijable** u `.env.local` moraju odgovarati ovom projektu

