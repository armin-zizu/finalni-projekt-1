# Manifest.json 401 Error Fix

## Problem:
Browser pokušava učitati `manifest.json` sa Vercel URL-a (`https://office-app-git-main-armins-projects-1226be8f.vercel.app/manifest.json`) umjesto sa Firebase Hosting URL-a, što rezultira 401 greškom.

## Uzrok:
- Browser cache je sačuvao stari Vercel URL
- Service Worker cache možda sadrži stari URL
- Aplikacija je možda ranije bila deploy-ovana na Vercel

## Rješenje:

### 1. Obriši browser cache:
- **Chrome:** Settings → Privacy → Clear browsing data → Cached images and files
- **Safari:** Settings → Safari → Clear History and Website Data

### 2. Obriši Service Worker:
- Otvori Developer Tools → Application → Service Workers
- Klikni "Unregister" za trenutni Service Worker
- Osvježi stranicu

### 3. Ponovo instaliraj aplikaciju:
- Obriši PWA aplikaciju sa telefona
- Otvori aplikaciju u browseru: https://zadnji-projekt.web.app
- Instaliraj aplikaciju ponovo

## Šta je urađeno:

1. **Ažurirana Service Worker verzija** na `v1.0.2` - forsira refresh cache-a
2. **Dodan `mobile-web-app-capable` meta tag** - zamjena za deprecated `apple-mobile-web-app-capable`
3. **Manifest.json koristi relativne putanje** - `/manifest.json` umjesto apsolutnih URL-ova

## Napomene:

- Greška 401 znači "Unauthorized" - Vercel URL je privatan ili zahtijeva autentifikaciju
- Ova greška ne utiče na funkcionalnost aplikacije, ali može uzrokovati probleme sa PWA instalacijom
- Nakon brisanja cache-a i ponovne instalacije, aplikacija će koristiti ispravan Firebase Hosting URL


