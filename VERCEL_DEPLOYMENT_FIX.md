# 🔧 Vercel Deployment & Cache Problem - Rješenje

## 📋 Problemi koje rješavamo:

1. **Branch deployment radi na laptopu ali ne na telefonu** - cache problem
2. **Production deployment (`office-app-eight.vercel.app`) ne pokazuje nove promjene**

---

## ✅ Rješenja koja su implementirana:

### 1. **Cache Control Headers** (`vercel.json`)
- Dodani su header-i koji sprječavaju agresivno cache-iranje
- HTML stranice se ne cache-uju (`must-revalidate`)
- Static fajlovi (`_next/static`) se cache-uju (performanse)

### 2. **Agresivno Cache Clearing**
- Service Worker se uklanja **ODMAH** pri učitavanju (ne čeka load event)
- Svi cache-ovi se brišu automatski
- Inline script u `<head>` tagu pokreće cleanup prije nego što se React učita

### 3. **Cache Busting Meta Tagovi**
- `Cache-Control: no-cache, no-store, must-revalidate`
- `Pragma: no-cache`
- `Expires: 0`

---

## 🔄 Kako ažurirati Production Deployment:

### **Problem:** `office-app-eight.vercel.app` ne pokazuje nove promjene

**Razlog:** 
- Branch deployment (`office-app-git-main-...`) je **preview deployment**
- Production deployment (`office-app-eight.vercel.app`) se ažurira samo kad se:
  - Merge-uje u `main` branch, ILI
  - Ručno redeploy-uje

### **Rješenje:**

#### **Opcija 1: Automatski (preporučeno)**
1. Push-uj promjene na `main` branch:
   ```bash
   git add .
   git commit -m "Fix cache problems"
   git push origin main
   ```
2. Vercel će automatski redeploy-ovati production

#### **Opcija 2: Ručno Redeploy**
1. Idite na [Vercel Dashboard](https://vercel.com/dashboard)
2. Otvorite projekat
3. Kliknite na **"Deployments"** tab
4. Pronađite najnoviji deployment (sa novim promjenama)
5. Kliknite **"..."** → **"Promote to Production"**

#### **Opcija 3: Preko Vercel CLI**
```bash
vercel --prod
```

---

## 📱 Rješavanje Cache Problema na Mobilnom Uređaju:

### **Ako aplikacija i dalje ne radi na telefonu:**

#### **1. Obriši Browser Cache na Telefonu:**

**Chrome (Android):**
1. Otvori Chrome
2. Menu (3 tačkice) → Settings
3. Privacy and security → Clear browsing data
4. Odaberi "Cached images and files"
5. Klikni "Clear data"

**Safari (iOS):**
1. Settings → Safari
2. Clear History and Website Data
3. Potvrdi

#### **2. Hard Reload na Mobilnom:**
- **Android Chrome:** Drži refresh dugme → "Hard reload"
- **iOS Safari:** Drži refresh dugme → "Request Desktop Site" → vrati nazad

#### **3. Provjeri Service Worker (Developer Tools):**
Ako imaš pristup Developer Tools na telefonu:
1. Chrome: `chrome://serviceworker-internals/`
2. Provjeri da li postoji registriran Service Worker
3. Ako postoji, klikni "Unregister"

#### **4. Test sa Incognito Mode:**
- Otvori link u incognito/private mode
- Ako radi u incognito, znači da je problem u cache-u

#### **5. Provjeri Console za Greške:**
- Otvori Developer Tools (Remote Debugging)
- Provjeri Console za greške
- Provjeri Network tab da li se fajlovi učitavaju

---

## 🎯 Provjera da li su promjene primijenjene:

### **Na Laptopu:**
1. Otvori Developer Tools (F12)
2. Network tab → enable "Disable cache"
3. Hard reload (Ctrl+Shift+R ili Cmd+Shift+R)
4. Provjeri Console - trebao bi vidjeti:
   ```
   ✅ Service Worker uklonjen (inline script)
   ✅ Cache obrisan (inline script): ...
   ```

### **Na Telefonu:**
1. Obriši cache (gore navedeno)
2. Otvori aplikaciju
3. Ako imaš pristup console (remote debugging):
   - Trebao bi vidjeti iste poruke kao na laptopu

---

## 📝 Dodatne Napomene:

### **Branch vs Production Deployment:**

- **Branch Deployment:** 
  - URL: `office-app-git-main-armins-projects-...vercel.app`
  - Automatski se kreira za svaki commit
  - Koristi se za preview/testiranje
  - **Nije** production URL

- **Production Deployment:**
  - URL: `office-app-eight.vercel.app` (ili custom domain)
  - Ažurira se samo kad se merge-uje u `main` ili ručno
  - **Ovo je** production URL koji korisnici trebaju koristiti

### **Preporuka:**

1. **Uvijek koristi production URL** (`office-app-eight.vercel.app`) za finalnu aplikaciju
2. Branch deployment koristi samo za testiranje prije merge-a u `main`
3. Nakon push-a na `main`, provjeri da li se production deployment ažurirao

---

## 🚀 Sljedeći Koraci:

1. ✅ Commit-uj promjene (`vercel.json` i `layout.tsx`)
2. ✅ Push-uj na `main` branch
3. ✅ Provjeri da li se production deployment ažurirao
4. ✅ Testiraj na telefonu (nakon što obrišeš cache)

---

## ⚠️ Ako problem i dalje postoji:

1. Provjeri Vercel Deployment logs za greške
2. Provjeri Console na telefonu (remote debugging)
3. Provjeri Network tab da li se fajlovi učitavaju
4. Provjeri da li su environment varijable postavljene na Vercel-u

---

**Kreirano:** ${new Date().toLocaleDateString('bs-BA')}

