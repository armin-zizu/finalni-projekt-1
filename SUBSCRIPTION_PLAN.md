# 📋 Plan za Subscription Sistem

## 🎯 Šta trebamo implementirati?

### 1. **Trial Period (15 dana)**
- Automatski se aktivira kada se korisnik registruje
- 15 dana od datuma registracije
- Korisnik ima pun pristup aplikaciji tokom trial perioda

### 2. **Grace Period (7 dana)**
- Aktivira se nakon što pretplata istekne
- 7 dana nakon isteka pretplate
- Korisnik i dalje ima pristup, ali vidi upozorenja

### 3. **Subscription Status**
- **Trial**: Korisnik je u trial periodu
- **Active**: Pretplata je aktivna i plaćena
- **Grace**: Pretplata je istekla, ali korisnik je u grace periodu
- **Expired**: Grace period je istekao, pristup blokiran

### 4. **Payment System**
- Mjesečna pretplata (npr. 50 KM/mjesec)
- Mogućnost dodavanja uplata
- Historija uplata
- Automatsko produžavanje pretplate na osnovu uplate

### 5. **Access Control**
- Blokada pristupa svim stranicama osim `/profile` kada je pretplata istekla
- Banner sa upozorenjima na vrhu stranice
- Različite boje za različite statuse (zeleno/žuto/crveno)

---

## 🔥 Šta treba u Firebase?

### **NIŠTA!** ✅

Sve možemo kodirati unutar programa. Firebase samo treba:

1. **Firestore Database** - već imamo ✅
2. **Firestore Security Rules** - trebamo ažurirati (već imamo osnovne pravila)
3. **Firebase Authentication** - već imamo ✅

### Firestore Struktura

Podaci će se čuvati u:
```
users/{userId}/subscription/info
```

**Struktura dokumenta:**
```javascript
{
  isActive: boolean,              // Da li je pretplata aktivna
  monthlyPrice: number,           // Mjesečna cijena (npr. 50)
  lastPaymentDate: Timestamp,     // Datum posljednje uplate
  expiryDate: Timestamp,          // Datum isteka pretplate
  trialEndDate: Timestamp,        // Datum isteka trial perioda
  graceEndDate: Timestamp,        // Datum isteka grace perioda
  paymentHistory: [               // Historija uplata
    {
      date: Timestamp,
      amount: number,
      note: string (opcionalno)
    }
  ],
  createdAt: Timestamp,           // Datum kreiranja pretplate
  updatedAt: Timestamp            // Datum posljednje izmjene
}
```

---

## 📁 Šta trebamo kodirati?

### 1. **SubscriptionContext** (`src/app/context/SubscriptionContext.tsx`)
- Upravljanje subscription statusom
- Logika za trial/grace period
- Funkcije za dodavanje uplata
- Real-time listener za promjene

### 2. **SubscriptionBanner** (`src/app/components/SubscriptionBanner.tsx`)
- Banner na vrhu stranice
- Različite boje za različite statuse
- Call-to-action dugmad

### 3. **SubscriptionGuard** (`src/app/components/SubscriptionGuard.tsx`)
- Blokada pristupa stranicama
- Dozvoljava pristup samo `/profile` kada je pretplata istekla

### 4. **Profile Page Updates** (`src/app/profile/page.tsx`)
- Sekcija za subscription status
- Forma za dodavanje uplata
- Historija uplata
- Uređivanje mjesečne cijene (admin)

### 5. **Layout Updates** (`src/app/layout.tsx`)
- Integracija SubscriptionProvider
- Prikaz SubscriptionBanner
- Integracija SubscriptionGuard

---

## 🔐 Firestore Security Rules

Trebamo ažurirati `firestore.rules`:

```javascript
rules_version='2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      // Korisnik može čitati i pisati svoje podatke
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // Subscription podkolekcija
      match /subscription/{subscriptionId} {
        // Korisnik može čitati i pisati svoju pretplatu
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
      
      // Obračuni podkolekcija
      match /obracuni/{obracunId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

---

## 🎨 UI/UX Elementi

### Banner Boje:
- **Trial (aktivno)**: Plava (`#dbeafe`) - "Trial period: X dana preostalo"
- **Trial (uskoro istekne < 3 dana)**: Žuta (`#fef3c7`) - "Trial period ističe za X dana!"
- **Active (aktivno)**: Zelena (`#dcfce7`) - "Pretplata aktivna"
- **Active (uskoro istekne < 7 dana)**: Žuta (`#fef3c7`) - "Pretplata ističe za X dana"
- **Grace Period**: Crvena (`#fee2e2`) - "Pretplata je istekla! Grace period: X dana"
- **Expired**: Crvena (`#fee2e2`) - "Pretplata nije aktivna"

### Profile Page:
- Status kartica sa bojom
- Forma za dodavanje uplate
- Tabela sa historijom uplata
- Uređivanje mjesečne cijene (opcionalno)

---

## 🔄 Logika

### Trial Period:
1. Kada se korisnik registruje → kreira se subscription dokument
2. `trialEndDate` = `userCreatedAt + 15 dana`
3. `isActive` = `true` tokom trial perioda

### Grace Period:
1. Kada pretplata istekne → `isActive` = `false`
2. `graceEndDate` = `expiryDate + 7 dana`
3. Korisnik i dalje ima pristup tokom grace perioda

### Dodavanje Uplate:
1. Korisnik unosi iznos uplate
2. Ažurira se `lastPaymentDate` = `now`
3. Ažurira se `expiryDate` = `now + 30 dana`
4. Ažurira se `isActive` = `true`
5. Dodaje se u `paymentHistory`

### Access Control:
- Ako `isActive === true` → Pristup dozvoljen
- Ako `isTrial === true` → Pristup dozvoljen
- Ako `isGracePeriod === true` → Pristup dozvoljen
- Ako sve navedeno `false` → Pristup blokiran (osim `/profile`)

---

## ✅ Checklist

### Firebase Setup:
- [ ] Ažurirati Firestore Security Rules
- [ ] Provjeriti da li su pravila deploy-ovana

### Kod:
- [ ] Kreirati SubscriptionContext
- [ ] Kreirati SubscriptionBanner
- [ ] Kreirati SubscriptionGuard
- [ ] Ažurirati Profile Page
- [ ] Ažurirati Layout
- [ ] Testirati trial period
- [ ] Testirati grace period
- [ ] Testirati dodavanje uplata
- [ ] Testirati access control

---

## 🚀 Sljedeći Koraci

1. **Diskutujmo plan** - da li sve odgovara?
2. **Ažuriramo Firestore Rules** - prvo pravila
3. **Kreiramo SubscriptionContext** - osnovna logika
4. **Kreiramo komponente** - Banner i Guard
5. **Ažuriramo Profile Page** - UI za subscription
6. **Testiramo** - sve funkcionalnosti

---

## ✅ Odluke

1. **Mjesečna cijena**: ✅ Admin (korisnik) će postaviti cijenu programa - mogućnost uređivanja u Profile Page
2. **Payment Gateway**: ✅ Ručno dodavanje uplata (bez payment gateway-a)
3. **Email Notifikacije**: ❌ Ne treba
4. **Admin Panel**: ✅ Treba admin panel za upravljanje pretplatama (možemo dodati kasnije)

