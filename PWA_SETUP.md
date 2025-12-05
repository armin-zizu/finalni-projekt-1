# PWA (Progressive Web App) Setup

## Šta je implementirano:

### 1. **Service Worker** (`public/sw.js`)
- Automatsko cache-ovanje resursa
- Offline podrška
- Automatsko ažuriranje kada je dostupna nova verzija
- Background sync za ažuriranja

### 2. **Web App Manifest** (`public/manifest.json`)
- Konfiguracija za instalaciju aplikacije
- Ikone za različite veličine
- Theme color i background color
- Display mode: standalone

### 3. **PWA Update Prompt Komponenta** (`src/app/components/PWAUpdatePrompt.tsx`)
- Automatska detekcija novih verzija
- Notifikacija korisniku kada je dostupna nova verzija
- Gumb za ažuriranje aplikacije
- Gumb za instalaciju aplikacije (ako nije instalirana)

### 4. **Ikone** (`public/icon-*.svg`)
- SVG ikone za različite veličine (72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512)
- Placeholder ikone sa "OA" tekstom
- **NAPOMENA:** Možeš zamijeniti ove ikone pravim ikonama aplikacije

## Kako radi:

### Automatsko ažuriranje:
1. Kada push-uješ na GitHub, aplikacija se automatski deploy-uje na Firebase Hosting
2. Service Worker detektuje novu verziju
3. Korisnik dobija notifikaciju "Dostupna je nova verzija!"
4. Korisnik klikne "Ažuriraj" → aplikacija se osvježava i učitava novu verziju

### Instalacija aplikacije:
1. Korisnik otvori aplikaciju u browseru
2. Browser prikaže prompt za instalaciju (na Android/Chrome)
3. Korisnik klikne "Instaliraj" → aplikacija se instalira na telefon
4. Aplikacija se može otvoriti kao standalone aplikacija (bez browsera)

## Kako testirati:

### Lokalno:
1. Pokreni `npm run dev`
2. Otvori aplikaciju u browseru
3. Otvori Developer Tools → Application → Service Workers
4. Provjeri da li je Service Worker registriran

### Na produkciji:
1. Push-uj na GitHub
2. Aplikacija se automatski deploy-uje
3. Otvori aplikaciju na telefonu
4. Instaliraj aplikaciju (ako se prikaže prompt)
5. Testiraj ažuriranje: napravi promjenu, push-uj, i provjeri da li se prikazuje notifikacija

## Kako zamijeniti ikone:

1. Kreiraj ikone u različitim veličinama (72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512)
2. Konvertuj u PNG format (ili koristi SVG)
3. Zamijeni fajlove u `public/` folderu:
   - `icon-72x72.png` (ili `.svg`)
   - `icon-96x96.png`
   - itd.
4. Ažuriraj `public/manifest.json` ako koristiš PNG umjesto SVG

## Troubleshooting:

### Service Worker se ne registruje:
- Provjeri da li je aplikacija dostupna preko HTTPS (ili localhost)
- Provjeri konzolu za greške
- Provjeri da li je `sw.js` dostupan na `/sw.js`

### Ažuriranja se ne prikazuju:
- Provjeri da li je Service Worker aktivan
- Provjeri da li se `sw.js` fajl mijenja pri svakom deploy-u
- Provjeri konzolu za greške

### Aplikacija se ne može instalirati:
- Provjeri da li je manifest.json validan
- Provjeri da li su ikone dostupne
- Provjeri da li aplikacija radi preko HTTPS

## Napomene:

- **Service Worker verzija:** Ažuriraj `CACHE_VERSION` u `public/sw.js` kada želiš forsirati ažuriranje cache-a
- **Ikone:** Trenutno su placeholder ikone. Zamijeni ih pravim ikonama aplikacije za bolji UX
- **Offline podrška:** Service Worker cache-uje osnovne stranice, ali Firebase zahtjevi se ne cache-uju (uvijek se fetch-uju iz mreže)

