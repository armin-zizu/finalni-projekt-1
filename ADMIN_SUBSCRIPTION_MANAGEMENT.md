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

## 🎯 Kako Aktivirati Pretplatu Nakon Bank Transfer-a

### Korak 1: Provjeri Uplatu

1. Provjeri u banci da li je uplata stigla
2. Zabilježi **reference broj** (format: `{APP_NAME}-{MONTHS}`)
3. Zabilježi **iznos** i **datum**

### Korak 2: Pronađi Korisnika

**Metoda A: Po Reference Broju**
- Reference broj format: `{APP_NAME}-{MONTHS}`
- Primjer: `MOJA-APLIKACIJA-3` znači korisnik sa app name "Moja Aplikacija" i 3 mjeseca
- Pronađi korisnika u Firestore po `appName` polju

**Metoda B: Po Email-u**
- Ako znaš email korisnika, možeš ga pronaći u Authentication sekciji
- Zatim idi na Firestore → `users/{userId}`

### Korak 3: Aktiviraj Pretplatu

1. Otvori: `users/{userId}/subscription/info`
2. Ažuriraj dokument:

```javascript
{
  isActive: true,
  lastPaymentDate: Timestamp (danas),
  expiryDate: Timestamp (danas + broj mjeseci),
  graceEndDate: null,
  paymentHistory: [
    ...existingPayments,
    {
      date: Timestamp (danas),
      amount: 12 * brojMjeseci,
      note: "Bank Transfer - {brojMjeseci} mjeseci"
    }
  ]
}
```

**Primjer za 3 mjeseca:**
```javascript
{
  isActive: true,
  lastPaymentDate: Timestamp (2024-01-15),
  expiryDate: Timestamp (2024-04-15), // +3 mjeseca
  graceEndDate: null,
  paymentHistory: [
    {
      date: Timestamp (2024-01-15),
      amount: 36, // 12 * 3
      note: "Bank Transfer - 3 mjeseci"
    }
  ]
}
```

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
- App Name: "Moja Aplikacija"
- Period: 3 mjeseca

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

