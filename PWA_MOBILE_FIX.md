# PWA Mobile Install Fix

## Problem:
Na mobilnom uređaju se prikazuje samo "učitavanje" i nema opcije za instalaciju aplikacije.

## Rješenje:
Dodana je podrška za iOS i Android instalaciju sa jasnim uputstvima.

## Šta je urađeno:

1. **iOS Detekcija** - Automatska detekcija iOS uređaja
2. **iOS Install Prompt** - Prikazuje se uputstvo za instalaciju na iOS (jer iOS Safari ne podržava automatski prompt)
3. **Android Install Prompt** - Automatski prompt za Android Chrome
4. **Poboljšan Manifest** - Dodano `prefer_related_applications: false`
5. **Apple Touch Icons** - Dodane različite veličine ikona za iOS

## Kako instalirati:

### Android (Chrome):
1. Otvori aplikaciju u Chrome browseru
2. Prijavi se u aplikaciju
3. Pojavit će se automatski prompt "Instaliraj aplikaciju"
4. Klikni "Instaliraj"

**Alternativno:**
- Klikni na meni (3 tačke) → "Dodaj na početni ekran"

### iOS (Safari):
1. Otvori aplikaciju u Safari browseru
2. Prijavi se u aplikaciju
3. Nakon 3 sekunde pojavit će se uputstvo za instalaciju
4. Slijedi korake:
   - **Korak 1:** Klikni na **Share** dugme ↗️ (dolje u Safari browseru)
   - **Korak 2:** Izaberi **"Dodaj na početni ekran"**
   - **Korak 3:** Potvrdi instalaciju

## Troubleshooting:

### Ako se prompt ne prikazuje na Android:
- Provjeri da li koristiš Chrome browser
- Provjeri da li je aplikacija dostupna preko HTTPS
- Provjeri da li je Service Worker registriran (Developer Tools → Application → Service Workers)

### Ako se prompt ne prikazuje na iOS:
- Provjeri da li koristiš Safari browser (ne Chrome na iOS)
- Provjeri da li je aplikacija dostupna preko HTTPS
- Provjeri da li je manifest.json dostupan

### Ako se prikazuje samo "učitavanje":
- Provjeri konzolu za greške (Developer Tools → Console)
- Provjeri da li je Service Worker registriran
- Provjeri da li su svi fajlovi deploy-ovani (manifest.json, sw.js, ikone)

## Testiranje:

1. **Build i deploy:**
   ```bash
   npm run build
   firebase deploy --only hosting
   ```

2. **Test na Android:**
   - Otvori Chrome na Android telefonu
   - Idi na: https://zadnji-projekt.web.app
   - Provjeri da li se prikazuje install prompt

3. **Test na iOS:**
   - Otvori Safari na iPhone-u
   - Idi na: https://zadnji-projekt.web.app
   - Provjeri da li se prikazuje iOS install uputstvo

## Napomene:

- **iOS Safari:** Ne podržava automatski install prompt, korisnik mora ručno dodati preko Share dugmeta
- **Android Chrome:** Podržava automatski install prompt (`beforeinstallprompt` event)
- **Service Worker:** Mora biti registriran da bi PWA radila
- **HTTPS:** PWA zahtijeva HTTPS (Firebase Hosting automatski koristi HTTPS)


