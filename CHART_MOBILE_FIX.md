# Chart Mobile Fix

## Problem:
Chart-ovi se prikazuju na webu i laptopu u app-u, ali ne prikazuju se na telefonu u app-u nakon što se sačuva obračun.

## Rješenje:
Ažuriran Service Worker da koristi network-first strategiju za JavaScript i CSS fajlove, što osigurava da se chart biblioteke (Recharts) pravilno učitavaju na mobilnom uređaju.

## Šta je urađeno:

1. **Service Worker Update** (`public/sw.js`):
   - Ažurirana cache verzija na `v1.0.1` da forsira refresh
   - Dodana network-first strategija za Next.js JavaScript bundle-ove
   - Dodana network-first strategija za CSS fajlove
   - Chart biblioteke (Recharts) se sada učitavaju iz mreže prvo, a zatim se cache-uju

2. **Error Handling** (`src/app/dashboard/page.tsx` i `src/app/profit/page.tsx`):
   - Dodana provjera da li `chartData` ima podatke prije renderovanja
   - Dodana poruka "Nema podataka za prikaz" ako nema podataka
   - Dodana provjera za `selectedArtiklData` u profit stranici

## Kako deploy-ovati:

1. **Build i deploy:**
   ```bash
   npm run build
   firebase deploy --only hosting
   ```

2. **Ili push na GitHub:**
   ```bash
   git add .
   git commit -m "Fix chart rendering on mobile PWA"
   git push
   ```

## Kako testirati:

1. **Deploy promjene** (build i deploy ili push na GitHub)

2. **Na telefonu:**
   - Otvori PWA aplikaciju
   - Osvježi aplikaciju (pull down to refresh ili zatvori i otvori ponovo)
   - Sačuvaj obračun
   - Provjeri da li se chart prikazuje u Dashboard i Profit stranicama

3. **Ako se i dalje ne prikazuje:**
   - Otvori Developer Tools na telefonu (Chrome Remote Debugging)
   - Provjeri konzolu za greške
   - Provjeri da li se Service Worker ažurirao (Application → Service Workers)
   - Probaj obrisati cache i ponovo instalirati aplikaciju

## Troubleshooting:

### Ako se chart i dalje ne prikazuje:
1. **Obriši Service Worker cache:**
   - Otvori Developer Tools → Application → Service Workers
   - Klikni "Unregister" za trenutni Service Worker
   - Osvježi stranicu

2. **Obriši browser cache:**
   - Chrome: Settings → Privacy → Clear browsing data → Cached images and files
   - Safari: Settings → Safari → Clear History and Website Data

3. **Ponovo instaliraj aplikaciju:**
   - Obriši aplikaciju sa telefona
   - Otvori aplikaciju u browseru
   - Instaliraj ponovo

### Ako se prikazuje "Nema podataka za prikaz":
- Provjeri da li su obračuni pravilno sačuvani u Firestore
- Provjeri da li se podaci učitavaju iz Firestore (provjeri konzolu)
- Provjeri da li filter nije previše restriktivan

## Napomene:

- **Service Worker Cache:** Ažurirana verzija (`v1.0.1`) će automatski obrisati stare cache-ove
- **Network-First:** JavaScript i CSS fajlovi se sada učitavaju iz mreže prvo, što osigurava da se chart biblioteke pravilno učitavaju
- **Offline Support:** Ako nema interneta, aplikacija će koristiti cache-ovane verzije


