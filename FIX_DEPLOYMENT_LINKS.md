# Fix Deployment Links - Production i Privremeni Link

## Problem:
1. ✅ Production link (`office-app-eight.vercel.app`) je alias na najnoviji deployment
2. ❌ Privremeni link ne radi na telefonu

## Rješenje:

### Za Production Link:
Production link bi trebao automatski pokazivati najnoviji deployment. Ako ne pokazuje najnovije promjene:

1. **Hard refresh na telefonu:**
   - Chrome: Otvori link → trostrelica (⋮) → Settings → Site Settings → Clear & Reset
   - Safari: Settings → Safari → Clear History and Website Data

2. **Dodaj cache-busting parametar:**
   ```
   https://office-app-eight.vercel.app/obracun?v=20250107
   ```
   Promijeni datum svaki put kada deploy-uješ.

### Za Privremeni Link:
Privremeni link (`office-7tgdhbu32-armins-projects-1226be8f.vercel.app`) možda ne radi zbog:
- Service Worker problema
- Cache problema
- SSL problema

**Rješenje:**
1. Očisti cache na telefonu
2. Pokušaj u Private/Incognito modu
3. ILI koristi production link umjesto privremenog

## Preporuka:

**Koristi production link** (`office-app-eight.vercel.app`) umjesto privremenog - on je stabilniji i automatski se ažurira.

## Workflow:

1. `npm run deploy` - deploy na production
2. Sačekaj 1-2 minute
3. Otvori `https://office-app-eight.vercel.app` na telefonu
4. Hard refresh ako ne vidiš promjene

