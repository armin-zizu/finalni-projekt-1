# 🔐 Admin Panel - Postavljanje i Korištenje

## 📋 Šta je Admin Panel?

Admin Panel je posebna stranica gdje možeš upravljati svim korisnicima i pretplatama u aplikaciji. Omogućava ti:
- ✅ Pregled svih korisnika
- ✅ Aktivaciju/deaktivaciju pretplata
- ✅ Dodavanje uplata
- ✅ Pretraživanje korisnika po email-u, app name ili user ID

---

## 🚀 Kako Postaviti Admin Email

### Korak 1: Postavi Environment Varijablu

**Lokalno (.env.local):**
```env
NEXT_PUBLIC_ADMIN_EMAIL=tvoj-email@gmail.com
```

**Na Vercel-u:**
1. Otvori: https://vercel.com/dashboard
2. Odaberi projekt
3. Idi na **Settings** → **Environment Variables**
4. Dodaj novu varijablu:
   - **Name:** `NEXT_PUBLIC_ADMIN_EMAIL`
   - **Value:** `tvoj-email@gmail.com`
   - **Environment:** Production, Preview, Development
5. Klikni **Save**
6. **Redeploy** projekt (Settings → Deployments → Redeploy)

---

## 🔑 Kako Pristupiti Admin Panelu

1. **Prijavi se** sa admin email-om (email koji si postavio u `NEXT_PUBLIC_ADMIN_EMAIL`)
2. **Klikni na "Admin"** u bottom navigation baru (samo admin vidi ovaj link)
3. Ili direktno idi na: `/admin`

---

## ⚠️ Važno

- **Samo korisnik sa admin email-om** može pristupiti admin panelu
- Ako neko drugi pokuša pristupiti `/admin`, automatski će biti preusmjeren na `/dashboard`
- Admin email se provjerava na osnovu `auth.currentUser.email`

---

## 📊 Funkcionalnosti Admin Panela

### 1. Pregled Korisnika

Admin panel prikazuje tabelu sa svim korisnicima:
- **Email:** Email adresa korisnika
- **App Name:** Ime aplikacije koje je korisnik postavio
- **Status:** Aktivna/Neaktivna pretplata
- **Ističe:** Broj dana do isteka pretplate
- **Akcije:** Dugmad za upravljanje

### 2. Pretraživanje

Možeš pretraživati korisnike po:
- Email adresi
- App name
- User ID

### 3. Aktivacija/Deaktivacija Pretplate

**Aktiviraj:**
- Klikni na **"Aktiviraj"** dugme
- Pretplata će biti aktivirana sa `expiryDate` +30 dana od današnjeg datuma
- Banner će se sakriti

**Deaktiviraj:**
- Klikni na **"Deaktiviraj"** dugme
- Pretplata će biti deaktivirana
- Banner će se prikazati

### 4. Dodavanje Uplate

1. Klikni na **"Dodaj Uplatu"** dugme pored korisnika
2. Unesi:
   - **Iznos (KM):** 12, 24, 36, ili 72
   - **Period (mjeseci):** 1, 2, 3, ili 6
   - **Napomena (opcionalno):** Npr. "Bank Transfer - 3 mjeseci"
3. Klikni **"Dodaj Uplatu"**

**Šta se dešava:**
- Pretplata se automatski aktivira
- `lastPaymentDate` se postavlja na današnji datum
- `expiryDate` se postavlja na današnji datum + broj mjeseci
- Uplata se dodaje u `paymentHistory`
- Banner se sakriva

---

## 🎯 Primjer Korištenja

### Scenario: Korisnik je izvršio bank transfer

1. **Provjeri uplatu u banci:**
   - Reference: `MOJA-APLIKACIJA-3`
   - Iznos: 36 KM
   - Datum: 15.01.2024

2. **Pronađi korisnika u Admin Panelu:**
   - Otvori Admin Panel
   - Pretraži po "Moja Aplikacija" ili email-u
   - Pronađi korisnika u tabeli

3. **Dodaj uplatu:**
   - Klikni **"Dodaj Uplatu"**
   - Unesi:
     - Iznos: `36`
     - Period: `3 mjeseca`
     - Napomena: `Bank Transfer - 3 mjeseci`
   - Klikni **"Dodaj Uplatu"**

4. **Rezultat:**
   - ✅ Pretplata aktivirana
   - ✅ Banner sakriven
   - ✅ Korisnik može pristupiti svim stranicama
   - ✅ Pretplata traje do 15.04.2024

---

## 🔒 Sigurnost

- Admin provjera se vrši na **client-side** (email provjera)
- Za production, preporučujemo dodavanje **Firestore Security Rules** koje blokiraju pristup admin funkcionalnostima
- Možeš dodati **custom claims** u Firebase Auth za bolju sigurnost

---

## 🐛 Troubleshooting

### Problem: Ne vidim "Admin" link u sidebar-u

**Rješenje:**
1. Provjeri da li si prijavljen sa admin email-om
2. Provjeri da li je `NEXT_PUBLIC_ADMIN_EMAIL` postavljen ispravno
3. Osvježi stranicu (Ctrl+R ili Cmd+R)

### Problem: Ne mogu pristupiti `/admin` stranici

**Rješenje:**
1. Provjeri da li si prijavljen sa admin email-om
2. Provjeri da li je `NEXT_PUBLIC_ADMIN_EMAIL` postavljen ispravno
3. Provjeri console za greške

### Problem: Ne vidim korisnike u tabeli

**Rješenje:**
1. Provjeri da li postoje korisnici u Firestore (`users` kolekcija)
2. Provjeri da li imaš dozvole za čitanje Firestore podataka
3. Provjeri console za greške

---

## 📝 Napomene

- Admin panel koristi **client-side** provjeru (email)
- Za bolju sigurnost, preporučujemo dodavanje **server-side** provjere
- Admin panel automatski učitava sve korisnike pri otvaranju
- Promjene se automatski reflektiraju u aplikaciji korisnika

---

## 🎉 Gotovo!

Sada možeš upravljati svim pretplatama direktno iz aplikacije, bez potrebe za Firebase Console!

