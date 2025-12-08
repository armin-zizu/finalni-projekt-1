# Vercel Deployment - Provjera i Rješavanje Problema

## Push je završen ✅
Promjene su push-ovane na GitHub (`main` branch).

## Kako provjeriti Vercel deployment:

### 1. **Provjeri Vercel Dashboard**
   - Idi na https://vercel.com/dashboard
   - Pronađi projekat `office-app` ili `finalni-projekt-1`
   - Provjeri da li se deploymenti automatski trigeruju na `push` na `main` branch

### 2. **Ako deploymenti ne idu automatski:**
   
   **Opcija A: Ručno trigerovanje deploymenta**
   - Otvori Vercel dashboard
   - Klikni na projekat
   - Klikni "Redeploy" na zadnjem deploymentu
   - Ili klikni "Deploy" → "Deploy Latest Commit"

   **Opcija B: Provjeri GitHub integrаciju**
   - Otvori Vercel dashboard → Settings → Git
   - Provjeri da li je GitHub repo povezan
   - Provjeri da li je `main` branch podešen za automatski deployment
   - Provjeri da li su webhook-ovi aktivni

### 3. **Ako projekat nije povezan sa Vercel:**
   
   **Poveži projekat:**
   ```bash
   # Instaliraj Vercel CLI ako nije instaliran
   npm i -g vercel
   
   # Poveži projekat sa Vercel
   vercel
   
   # Ili poveži sa postojećim projektom
   vercel link
   ```

### 4. **Provjeri environment variables:**
   - Otvori Vercel dashboard → Settings → Environment Variables
   - Provjeri da li su sve Firebase Admin SDK varijable postavljene:
     - `FIREBASE_PROJECT_ID`
     - `FIREBASE_CLIENT_EMAIL`
     - `FIREBASE_PRIVATE_KEY`

### 5. **Provjeri build logove:**
   - Otvori zadnji deployment u Vercel dashboardu
   - Provjeri "Build Logs" da vidiš da li ima grešaka
   - Provjeri "Function Logs" za serverless funkcije

### 6. **Testiraj deployment:**
   - Nakon uspješnog deploymenta, provjeri:
     - `https://office-app-eight.vercel.app/` (production)
     - `https://office-app-git-main-*.vercel.app/` (preview)

## Trenutne promjene koje čekaju deployment:
- ✅ Fix Service Worker error (blokiranje update-a)
- ✅ Fix mobile chart rendering
- ✅ Usklađene box veličine
- ✅ Ispravljena logika filtriranja datuma

## Napomena:
Ako deploymenti ne idu automatski, možda je problem u:
1. **GitHub webhook** - nije postavljen ili je istekao
2. **Vercel plan** - možda je dosegnut limit za Hobby plan
3. **Build errors** - provjeri build logove za greške
4. **Environment variables** - možda nedostaju potrebne varijable

## Kontakt Vercel support:
Ako ništa od navedenog ne pomogne, kontaktiraj Vercel support ili provjeri status na https://vercel-status.com

