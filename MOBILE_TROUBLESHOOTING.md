# Mobile Troubleshooting - Branch Deployment Link ne radi

## Problem:
Branch deployment link (`https://office-app-git-main-armins-projects-1226be8f.vercel.app/obracun`) ne radi na telefonu.

## Mogući uzroci i rješenja:

### 1. **Service Worker Cache**
**Problem**: Stari Service Worker blokira učitavanje
**Rješenje**:
- Otvori Chrome na telefonu
- Settings → Site Settings → All Sites
- Pronađi `vercel.app` domain
- Klikni "Clear & Reset"
- ILI:
- Chrome → Settings → Privacy → Clear browsing data
- Odaberi "Cached images and files" i "Cookies"
- Clear data

### 2. **Browser Cache**
**Problem**: Browser ima stari cache
**Rješenje**:
- Hard refresh: Chrome (Android) - trostrelica → "Clear data"
- Safari (iOS) - Settings → Safari → Clear History and Website Data
- ILI otvori link u Private/Incognito modu

### 3. **HTTPS/SSL Problem**
**Problem**: SSL certifikat problem
**Rješenje**:
- Provjeri da li link ima `https://` (ne `http://`)
- Provjeri da li browser prikazuje SSL grešku
- Ako ima, klikni "Advanced" → "Proceed anyway"

### 4. **Network Problem**
**Problem**: WiFi ili mobilna mreža blokira
**Rješenje**:
- Pokušaj sa drugim WiFi-om
- Pokušaj sa mobilnim podacima
- Provjeri da li VPN blokira

### 5. **Browser Problem**
**Problem**: Browser bug ili stara verzija
**Rješenje**:
- Ažuriraj Chrome/Safari
- Pokušaj sa drugim browserom (Chrome umjesto Safari, ili obrnuto)
- Reinstaliraj browser

### 6. **JavaScript Disabled**
**Problem**: JavaScript je onemogućen
**Rješenje**:
- Chrome: Settings → Site Settings → JavaScript → Allowed
- Safari: Settings → Safari → Advanced → JavaScript → ON

### 7. **Console Errors**
**Provjera**:
1. Otvori Chrome DevTools na telefonu:
   - Chrome → Menu (3 tačke) → More tools → Remote debugging
   - ILI koristi Chrome na desktopu → chrome://inspect
2. Provjeri Console za greške
3. Provjeri Network tab za failed requests

### 8. **Vercel Deployment Status**
**Provjera**:
1. Otvori Vercel Dashboard
2. Provjeri status deploymenta
3. Provjeri Build Logs za greške
4. Provjeri da li je deployment "Ready"

## Quick Fix - Hard Refresh na Mobilnom:

### Android/Chrome:
1. Otvori link
2. Klikni na adresnu traku
3. Klikni "Clear data" ili "Forget site"
4. Upiši link ponovo

### iOS/Safari:
1. Settings → Safari
2. Clear History and Website Data
3. Otvori link ponovo

## Debug Steps:

1. **Provjeri da li link radi na desktopu**
   - Ako radi, problem je specifičan za mobilni

2. **Provjeri Console na telefonu**
   - Chrome: chrome://inspect (sa desktopa)
   - Safari: Develop menu (sa Mac-a)

3. **Provjeri Network requests**
   - Vidjeti da li se stranica učitava
   - Provjeri HTTP status kodove (200, 404, 500, etc.)

4. **Provjeri da li je Service Worker problem**
   - Console će pokazati Service Worker greške
   - Provjeri Application tab u DevTools

## Ako ništa ne pomaže:

1. **Pokušaj production link** (`office-app-eight.vercel.app`)
2. **Provjeri Vercel status**: https://vercel-status.com
3. **Provjeri da li deployment ima greške** u Vercel Dashboard
4. **Kontaktiraj Vercel support** ako deployment ima greške

## Napomena:

Dodao sam poboljšani cache clearing u kod koji bi trebao automatski riješiti većinu problema sa Service Worker-om i cache-om. Promjene će biti dostupne nakon deploymenta.

