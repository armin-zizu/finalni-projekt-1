# 🚀 Sljedeći Koraci - Finalni Projekt

## ✅ Što je već urađeno:

1. ✅ Firebase projekat postavljen na **"zadnji-projekt"**
2. ✅ Aplikacija build-ovana (`npm run build`)
3. ✅ Aplikacija deploy-ovana na Firebase Hosting
4. ✅ GitHub workflows kreirani
5. ✅ Firestore pravila ažurirana (per-user data isolation)

---

## 📋 Što trebaš uraditi:

### 1️⃣ Provjeri da li aplikacija radi (2 min)

**Otvori u browseru:**
- **URL:** https://zadnji-projekt.web.app
- **Provjeri:**
  - ✅ Login stranica se učitava
  - ✅ Možeš se prijaviti
  - ✅ Aplikacija radi normalno

---

### 2️⃣ Dodaj Firebase Service Account u GitHub (5 min)

**Ako još NISI dodao:**

1. **Firebase Console:**
   - https://console.firebase.google.com/project/zadnji-projekt/settings/serviceaccounts/adminsdk
   - Klikni **"Generate new private key"**
   - Preuzmi JSON fajl

2. **GitHub:**
   - https://github.com/arminzizu/finalni-projekt/settings/secrets/actions
   - Klikni **"New repository secret"**
   - **Name:** `FIREBASE_SERVICE_ACCOUNT_ZADNJI_PROJEKT`
   - **Value:** Cijeli sadržaj JSON fajla
   - Klikni **"Add secret"**

**Zašto ovo treba:**
- Omogućava automatski deploy na svaki push na GitHub
- Ne moraš ručno deploy-ovati svaki put

---

### 3️⃣ Provjeri GitHub Actions (2 min)

**Nakon što dodaš Service Account:**

1. **Push-uj kod na GitHub** (ako još nisi)
2. **Otvori:** https://github.com/arminzizu/finalni-projekt/actions
3. **Provjeri:**
   - ✅ Workflow se pokreće automatski
   - ✅ Status: "Success" (zeleno) ili "In progress" (žuto)

**Ako vidiš grešku:**
- Provjeri da li si dodao Service Account secret
- Provjeri da li je ime secret-a tačno: `FIREBASE_SERVICE_ACCOUNT_ZADNJI_PROJEKT`

---

### 4️⃣ Poveži Custom Domenu (15-30 min)

**Ako IMAŠ domenu:**

1. **Firebase Console:**
   - https://console.firebase.google.com/project/zadnji-projekt/hosting
   - Klikni **"Add custom domain"** (ili **"Connect domain"**)
   - Unesi svoju domenu (npr. "mojkafic.com")
   - Klikni **"Continue"**

2. **Dodaj DNS zapise:**
   - Firebase će ti dati **A Record** i **AAAA Record** (ili **CNAME**)
   - Otvori DNS upravljanje u registraru (gdje si kupio domenu)
   - Dodaj zapise kako Firebase kaže

3. **Sačekaj verifikaciju:**
   - Firebase automatski verificira domenu (5-60 min)
   - SSL certifikat se kreira automatski (10-60 min)
   - Dobit ćeš email kada je spremno

**Ako NEMAŠ domenu:**

1. **Registriraj domenu:**
   - **Namecheap:** https://www.namecheap.com/ (~$10-15/godina)
   - **Google Domains:** https://domains.google/ (~$12/godina)
   - **Cloudflare:** https://www.cloudflare.com/products/registrar/ (~$8/godina)

2. **Zatim slijedi korake iznad**

---

## 🎯 Checklist:

- [ ] Aplikacija radi na https://zadnji-projekt.web.app
- [ ] Firebase Service Account dodan u GitHub Secrets
- [ ] GitHub Actions rade (automatski deploy)
- [ ] Custom domena povezana (opcionalno)

---

## 📊 Status Aplikacije:

- **Firebase Hosting URL:** https://zadnji-projekt.web.app
- **Firebase Console:** https://console.firebase.google.com/project/zadnji-projekt/overview
- **GitHub Repozitorij:** https://github.com/arminzizu/finalni-projekt
- **GitHub Actions:** https://github.com/arminzizu/finalni-projekt/actions

---

## 🔐 Važno:

1. **Firebase credentials** moraju biti u `.env.local`:
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID=zadnji-projekt`
   - Ostale Firebase varijable (API Key, Auth Domain, itd.)

2. **GitHub Secret** mora biti dodan za automatski deploy

3. **Firestore pravila** su postavljena za per-user data isolation

---

## 🆘 Ako imaš problema:

1. **Aplikacija se ne učitava:**
   - Provjeri Firebase credentials u `.env.local`
   - Provjeri da li je build uspješan (`npm run build`)

2. **GitHub Actions ne rade:**
   - Provjeri da li si dodao Service Account secret
   - Provjeri da li je ime secret-a tačno

3. **Domena se ne povezuje:**
   - Provjeri DNS zapise u registraru
   - Sačekaj 24-48 sati za propagaciju
   - Koristi: https://dnschecker.org/ za provjeru

---

## 🎉 Gotovo!

Ako si sve uradio:
- ✅ Aplikacija je online
- ✅ Automatski deploy radi
- ✅ Svaki korisnik ima svoju arhivu
- ✅ Custom domena povezana (ako si je dodao)

**Srećno! 🚀**

