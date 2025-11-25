# 🔧 Upravljanje Pretplatama - Admin Vodič

## 📍 Gdje možeš upravljati pretplatama?

### **Opcija 1: Firebase Console** (Najlakše) ✅

#### 1. Otvori Firebase Console

👉 **https://console.firebase.google.com/project/zadnji-projekt/firestore/databases/-default-/data**

#### 2. Pronađi Korisnika

1. U Firestore Database, idi na: `users` → `{userId}`
2. Pronađi korisnika po email-u ili user ID-u

#### 3. Ažuriraj Subscription

1. Idi na: `users/{userId}/subscription/info`
2. Klikni na dokument `info`
3. Ažuriraj polja:

**Za aktivaciju pretplate:**
```javascript
{
  isActive: true,
  expiryDate: Timestamp (datum u budućnosti),
  lastPaymentDate: Timestamp (danas),
  graceEndDate: null
}
```

**Za deaktivaciju pretplate:**
```javascript
{
  isActive: false,
  expiryDate: Timestamp (prošli datum),
  graceEndDate: null
}
```

**Za produžavanje pretplate:**
```javascript
{
  isActive: true,
  expiryDate: Timestamp (novi datum - npr. +30 dana),
  lastPaymentDate: Timestamp (danas)
}
```

---

### **Opcija 2: Direktno u Firestore** (Programski)

Možeš koristiti Firebase Admin SDK ili Firebase Console da direktno ažuriraš pretplate.

---

## 🎯 Kako Aktivirati Pretplatu Nakon Bank Transfer-a - DETALJNO UPUTSTVO

### 📋 Korak 1: Provjeri Uplatu u Banci

1. **Otvori bankovni račun** (online banking ili aplikacija)
2. **Pronađi primljenu uplatu** sa sljedećim podacima:
   - **Iznos:** 12 KM, 24 KM, 36 KM, ili 72 KM (zavisno od perioda)
   - **Reference broj:** Format `{APP_NAME}-{MONTHS}` (npr. `MOJA-APLIKACIJA-3`)
   - **Datum uplate:** Zabilježi tačan datum
   - **Račun primaoca:** Provjeri da li je to tvoj račun (`NEXT_PUBLIC_BANK_ACCOUNT`)

3. **Zabilježi podatke:**
   ```
   Reference: MOJA-APLIKACIJA-3
   Iznos: 36 KM
   Datum: 15.01.2024
   Period: 3 mjeseca (iz reference broja)
   ```

---

### 🔍 Korak 2: Pronađi Korisnika u Firebase Console

#### **Metoda A: Po Reference Broju (Preporučeno)**

1. **Otvori Firebase Console:**
   👉 https://console.firebase.google.com/project/zadnji-projekt/firestore/databases/-default-/data

2. **Idi na Firestore Database:**
   - U lijevom meniju klikni na **"Firestore Database"**
   - Klikni na kolekciju **`users`**

3. **Pronađi korisnika:**
   - Reference broj format: `{APP_NAME}-{MONTHS}`
   - Primjer: `MOJA-APLIKACIJA-3` znači:
     - App Name: **"Moja Aplikacija"** (bez razmaka, uppercase u reference)
     - Period: **3 mjeseca**

4. **Kako pretraživati:**
   - U Firebase Console, klikni na **"Filter"** ili **"Add filter"**
   - Polje: `appName`
   - Operator: `==` (jednako)
   - Vrijednost: `Moja Aplikacija` (sa razmacima, kako je korisnik unio)
   - Klikni **"Apply"**

5. **Ako ne možeš pronaći:**
   - Reference broj koristi uppercase bez razmaka: `MOJA-APLIKACIJA`
   - Ali u bazi je sačuvano sa razmacima: `Moja Aplikacija`
   - Probaj pretraživati po dijelu imena (npr. samo "Moja")

#### **Metoda B: Po Email-u**

1. **Otvori Authentication:**
   - U lijevom meniju klikni na **"Authentication"**
   - Klikni na **"Users"** tab
   - Pronađi korisnika po email-u

2. **Kopiraj User ID:**
   - Klikni na korisnika
   - Kopiraj **User UID** (npr. `Qkql1GLaDmMvZyWBPtWXMzEj7j43`)

3. **Idi na Firestore:**
   - Otvori **Firestore Database**
   - Idi na `users` → `{userId}` (koristi kopirani UID)

---

### ✅ Korak 3: Aktiviraj Pretplatu u Firebase Console

1. **Otvori subscription dokument:**
   - U `users/{userId}` klikni na **`subscription`** (subcollection)
   - Klikni na dokument **`info`**

2. **Ažuriraj dokument:**
   - Klikni na **"Edit document"** (ikonica olovke)
   - Ažuriraj sljedeća polja:

#### **Polja koja treba ažurirati:**

**a) `isActive`:**
- Tip: `boolean`
- Vrijednost: `true` ✅

**b) `lastPaymentDate`:**
- Tip: `timestamp`
- Vrijednost: Datum uplate (npr. `2024-01-15 10:30:00`)
- Kako dodati: Klikni na polje → Odaberi "timestamp" → Unesi datum

**c) `expiryDate`:**
- Tip: `timestamp`
- Vrijednost: Datum uplate + broj mjeseci
- Primjer: Ako je uplata 15.01.2024 za 3 mjeseca → `2024-04-15 10:30:00`
- **Kalkulacija:**
  - 1 mjesec: +1 mjesec
  - 2 mjeseca: +2 mjeseca
  - 3 mjeseca: +3 mjeseca
  - 6 mjeseci: +6 mjeseci

**d) `graceEndDate`:**
- Tip: `null`
- Vrijednost: `null` (ili obriši polje)

**e) `paymentHistory`:**
- Tip: `array`
- Vrijednost: Dodaj novi element u array:
  ```javascript
  {
    date: Timestamp (datum uplate),
    amount: 12 * brojMjeseci, // npr. 36 za 3 mjeseca
    note: "Bank Transfer - {brojMjeseci} mjeseci"
  }
  ```
- **Kako dodati:**
  1. Pronađi `paymentHistory` array
  2. Klikni na **"Add field"** ili **"+"** unutar array-a
  3. Dodaj novi objekt sa poljima:
     - `date`: timestamp (datum uplate)
     - `amount`: number (iznos, npr. 36)
     - `note`: string (npr. "Bank Transfer - 3 mjeseci")

**f) `monthlyPrice`:**
- Tip: `number`
- Vrijednost: `12` (fiksno, ne mijenjaj)

3. **Spremi promjene:**
   - Klikni **"Update"** ili **"Save"**

---

### 📝 Primjer: Aktivacija Pretplate za 3 Mjeseca

**Podaci iz banke:**
```
Reference: MOJA-APLIKACIJA-3
Iznos: 36 KM
Datum: 15.01.2024 14:30
Period: 3 mjeseca
```

**Koraci u Firebase Console:**

1. **Pronađi korisnika:**
   - Firestore → `users` → Filter: `appName == "Moja Aplikacija"`

2. **Otvori subscription:**
   - `users/{userId}/subscription/info`

3. **Ažuriraj dokument:**
   ```javascript
   {
     isActive: true,
     lastPaymentDate: Timestamp (2024-01-15 14:30:00),
     expiryDate: Timestamp (2024-04-15 14:30:00), // +3 mjeseca
     graceEndDate: null,
     monthlyPrice: 12,
     paymentHistory: [
       // ... postojeće uplate (ako ih ima) ...
       {
         date: Timestamp (2024-01-15 14:30:00),
         amount: 36,
         note: "Bank Transfer - 3 mjeseci"
       }
     ]
   }
   ```

4. **Rezultat:**
   - ✅ Banner se **neće prikazivati** (pretplata aktivna)
   - ✅ Korisnik može pristupiti **svim stranicama**
   - ✅ Pretplata traje do **15.04.2024**

---

### 🎯 Brzi Checklist za Aktivaciju

- [ ] Provjerio uplatu u banci
- [ ] Zabilježio reference broj, iznos i datum
- [ ] Pronašao korisnika u Firebase Console
- [ ] Otvorio `users/{userId}/subscription/info`
- [ ] Postavio `isActive: true`
- [ ] Postavio `lastPaymentDate` (datum uplate)
- [ ] Postavio `expiryDate` (datum uplate + broj mjeseci)
- [ ] Postavio `graceEndDate: null`
- [ ] Dodao uplatu u `paymentHistory` array
- [ ] Spremio promjene
- [ ] Provjerio da li se banner sakrio (osvježi stranicu korisnika)

---

## 🚫 Kako Deaktivirati Pretplatu (Sakriti Banner)

### Metoda 1: Postavi `isActive: false`

```javascript
{
  isActive: false,
  expiryDate: Timestamp (prošli datum),
  graceEndDate: null
}
```

### Metoda 2: Postavi `expiryDate` u prošlosti

```javascript
{
  expiryDate: Timestamp (2020-01-01), // Prošli datum
  graceEndDate: null
}
```

**Rezultat:**
- Banner će se prikazati (crveni - pretplata nije aktivna)
- Korisnik neće moći pristupiti stranicama osim `/profile`

---

## ✅ Kako Aktivirati Pretplatu (Sakriti Banner)

### Postavi `isActive: true` i `expiryDate` u budućnosti

```javascript
{
  isActive: true,
  expiryDate: Timestamp (2024-12-31), // Budući datum
  graceEndDate: null
}
```

**Rezultat:**
- Banner se **neće prikazivati** (pretplata je aktivna i ima više od 7 dana)
- Korisnik može pristupiti svim stranicama

---

## 📊 Statusi Pretplate i Banner

| Status | `isActive` | `expiryDate` | Banner | Pristup |
|--------|-----------|--------------|--------|---------|
| **Aktivna** | `true` | Budući (>7 dana) | ❌ Ne prikazuje se | ✅ Svi pristup |
| **Aktivna (uskoro istekne)** | `true` | Budući (≤7 dana) | ⚠️ Žuti/Plavi | ✅ Svi pristup |
| **Trial** | `true` | - | 🎉 Plavi | ✅ Svi pristup |
| **Grace Period** | `false` | Prošli | ⚠️ Crveni | ✅ Svi pristup |
| **Neaktivna** | `false` | Prošli | ⚠️ Crveni | ❌ Samo `/profile` |

---

## 🔍 Kako Pronaći Korisnika po Reference Broju

### Reference Broj Format:
```
{APP_NAME}-{MONTHS}
```

**Primjer:**
- Reference: `MOJA-APLIKACIJA-3`
- App Name: "Moja Aplikacija" (korisnik ga postavlja u profilu)
- Period: 3 mjeseca

**Važno:** Reference broj se automatski mijenja kada korisnik promijeni ime aplikacije!

### Koraci:

1. **U Firebase Console:**
   - Idi na Firestore Database
   - Klikni na `users` kolekciju
   - Pretraži po `appName` polju (možeš koristiti filter)
   - Pronađi korisnika sa `appName: "Moja Aplikacija"`

2. **Ako ne možeš pronaći:**
   - Možeš koristiti Firebase Console search
   - Ili provjeri sve korisnike i traži po `appName`

---

## 💡 Brzi Način: Lista Svih Korisnika

### U Firebase Console:

1. Otvori: **Firestore Database**
2. Klikni na `users` kolekciju
3. Vidiš listu svih korisnika
4. Klikni na korisnika da vidiš njegove podatke
5. Idi na `subscription/info` da vidiš/uredi pretplatu

---

## 🎨 Automatsko Upravljanje (Budućnost)

Možeš dodati **Admin Panel** u aplikaciji gdje možeš:
- Vidjeti sve korisnike
- Pretraživati po reference broju
- Aktivirati/deaktivirati pretplate
- Dodavati uplate
- Vidjeti historiju uplata

Ali za sada, **Firebase Console je najlakši način**.

---

## 📝 Primjer: Aktivacija Pretplate za 3 Mjeseca

1. **Provjeri uplatu u banci:**
   - Reference: `MOJA-APLIKACIJA-3`
   - Iznos: 36 KM
   - Datum: 15.01.2024

2. **Pronađi korisnika:**
   - Firebase Console → Firestore → `users`
   - Pronađi korisnika sa `appName: "Moja Aplikacija"`

3. **Aktiviraj pretplatu:**
   - Idi na `subscription/info`
   - Ažuriraj:
     ```javascript
     {
       isActive: true,
       lastPaymentDate: Timestamp (2024-01-15),
       expiryDate: Timestamp (2024-04-15), // +3 mjeseca
       graceEndDate: null,
       paymentHistory: [
         {
           date: Timestamp (2024-01-15),
           amount: 36,
           note: "Bank Transfer - 3 mjeseci"
         }
       ]
     }
     ```

4. **Rezultat:**
   - Banner se neće prikazivati
   - Korisnik može pristupiti svim stranicama
   - Pretplata traje do 15.04.2024

---

## ⚠️ Važno

- **Banner se automatski sakriva** kada je `isActive: true` i `expiryDate` je više od 7 dana u budućnosti
- **Banner se prikazuje** kada je pretplata neaktivna, u trial periodu, ili ističe uskoro
- **Korisnik može pristupiti `/profile`** uvijek, bez obzira na status pretplate

