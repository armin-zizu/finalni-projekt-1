# 📋 Instrukcije za Firebase Service Account i GitHub Push

## 1️⃣ Push na GitHub

### Opcija A: GitHub Desktop (NAJLAKŠE)
1. Otvori **GitHub Desktop**
2. Otvori repozitorij **"finalni-projekt"**
3. U lijevom panelu vidiš sve promjene
4. Unesi commit poruku: `Ažuriran Firebase projekat na zadnji-projekt`
5. Klikni **"Commit to main"**
6. Klikni **"Push origin"**

### Opcija B: Terminal
```bash
git push --set-upstream origin main
```
*(Ako traži autentifikaciju, koristi Personal Access Token umjesto lozinke)*

---

## 2️⃣ Firebase Service Account Secret

### Korak 1: Kreiraj Service Account u Firebase

1. **Otvori Firebase Console:**
   - Idi na: https://console.firebase.google.com
   - **Prijavi se** sa svojim Google računom

2. **Odaberi projekat:**
   - Klikni na **"finalni-projekt"** (Display Name)
   - Ili traži **"zadnji-projekt"** (Project ID)

3. **Otvori Project Settings:**
   - Klikni na **zupčanik (⚙️)** u gornjem lijevom uglu
   - Klikni **"Project settings"**

4. **Idi na Service Accounts tab:**
   - Klikni na tab **"Service accounts"** (gore)
   - Vidiš sekciju **"Firebase Admin SDK"**

5. **Generiraj novi private key:**
   - Klikni na dugme **"Generate new private key"**
   - U dijalogu klikni **"Generate key"**
   - **Preuzme se JSON fajl** (npr. `zadnji-projekt-xxxxx.json`)
   - **SAČUVAJ OVAJ FAJL** - nećeš ga moći ponovo preuzeti!

---

### Korak 2: Dodaj Secret u GitHub

1. **Otvori GitHub repozitorij:**
   - Idi na: https://github.com/arminzizu/finalni-projekt
   - **Prijavi se** ako nisi

2. **Otvori Settings:**
   - Klikni na tab **"Settings"** (gore desno u repozitoriju)

3. **Otvori Secrets:**
   - U lijevom meniju klikni **"Secrets and variables"**
   - Klikni **"Actions"**

4. **Dodaj novi secret:**
   - Klikni na dugme **"New repository secret"** (desno gore)

5. **Unesi podatke:**
   - **Name:** `FIREBASE_SERVICE_ACCOUNT_ZADNJI_PROJEKT`
     *(MORA biti tačno ovako, bez razmaka!)*
   - **Secret:** 
     - Otvori preuzeti JSON fajl (npr. `zadnji-projekt-xxxxx.json`)
     - **Kopiraj CIJELI sadržaj** (Ctrl+A, Ctrl+C)
     - **Zalijepi** u polje "Secret" (Ctrl+V)
   
6. **Spremi:**
   - Klikni **"Add secret"**

---

## 3️⃣ Provjeri da li radi

1. **Push-uj kod na GitHub** (ako još nisi)
2. **Otvori GitHub repozitorij → tab "Actions"**
3. **Trebao bi se pokrenuti workflow:**
   - "Deploy to Firebase Hosting on merge"
   - Status će biti: 🟡 "In progress" ili ✅ "Success"

4. **Ako vidiš grešku:**
   - Provjeri da li si dodao secret sa tačnim imenom
   - Provjeri da li je JSON fajl ispravno kopiran (cijeli sadržaj)

---

## ✅ Sve je spremno!

Nakon što dodaš secret i push-uješ kod:
- **Automatski deploy** će se pokrenuti na svaki push na `main` branch
- **Preview deploy** će se pokrenuti na svaki Pull Request
- **Firebase Hosting** će biti ažuriran automatski

---

## 🔗 Korisni linkovi:

- **Firebase Console:** https://console.firebase.google.com
- **GitHub Repozitorij:** https://github.com/arminzizu/finalni-projekt
- **GitHub Actions:** https://github.com/arminzizu/finalni-projekt/actions

