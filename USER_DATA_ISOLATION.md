# 🔒 Izolacija Podataka po Korisniku

## 📋 Pregled

Svaki korisnik ima **potpuno izolovanu bazu podataka** u Firestore. Podaci se ne miješaju između korisnika.

---

## 🗂️ Struktura Podataka u Firestore

```
users/
  └── {userId}/
      ├── email: string
      ├── appName: string
      ├── cjenovnik: ArtiklCijena[]
      ├── createdAt: Timestamp
      ├── lastSignIn: Timestamp
      │
      ├── obracuni/
      │   └── {datum}/
      │       ├── datum: string
      │       ├── artikli: ArhiviraniArtikal[]
      │       ├── rashodi: Rashod[]
      │       ├── prihodi: Prihod[]
      │       └── ...
      │
      └── subscription/
          └── info/
              ├── isActive: boolean
              ├── monthlyPrice: number
              ├── expiryDate: Timestamp
              ├── paymentHistory: Payment[]
              └── ...
```

---

## 🔐 Sigurnost

### Firestore Security Rules

Svi podaci su zaštićeni Firestore Security Rules:

```javascript
match /users/{userId} {
  // Korisnik može pristupiti samo svojim podacima
  allow read, write: if request.auth != null && request.auth.uid == userId;
  
  match /obracuni/{obracunId} {
    allow read, write: if request.auth != null && request.auth.uid == userId;
  }
  
  match /subscription/{subscriptionId} {
    allow read, write: if request.auth != null && request.auth.uid == userId;
  }
}
```

**Rezultat:**
- ✅ Korisnik **ne može** pristupiti podacima drugih korisnika
- ✅ Korisnik **ne može** čitati ili mijenjati tuđe podatke
- ✅ Svaki korisnik vidi **samo svoje podatke**

---

## 🚀 Automatska Inicijalizacija Novog Korisnika

Kada se kreira novi korisnik (registracija), automatski se kreira:

### 1. Glavni User Dokument
```javascript
users/{userId}/
  - email: "korisnik@example.com"
  - appName: "Moja Aplikacija"
  - cjenovnik: [default artikli]
  - createdAt: Timestamp
  - lastSignIn: Timestamp
```

### 2. Subscription Dokument
```javascript
users/{userId}/subscription/info/
  - isActive: true
  - monthlyPrice: 12
  - trialEndDate: Timestamp (danas + 15 dana)
  - paymentHistory: []
```

### 3. Default Cjenovnik
Novi korisnik dobija default cjenovnik sa 4 artikla:
- Kafa
- Čaj
- Vodka
- Rakija

---

## 💾 localStorage Izolacija

Svi podaci u `localStorage` su također izolovani po korisniku:

### User-Specific Keys:
- `arhivaObracuna_${userId}` - Arhiva obračuna
- `cjenovnik_${userId}` - Cjenovnik
- `appName_${userId}` - Ime aplikacije

**Primjer:**
- Korisnik A (userId: `abc123`): `arhivaObracuna_abc123`
- Korisnik B (userId: `xyz789`): `arhivaObracuna_xyz789`

**Rezultat:**
- ✅ Korisnik A ne vidi podatke korisnika B
- ✅ Ako se korisnik A odjavi i korisnik B prijavi, korisnik B vidi samo svoje podatke

---

## 📊 Kako Funkcioniše

### 1. Registracija Novog Korisnika

```javascript
// 1. Kreira se Firebase Auth korisnik
const user = await createUserWithEmailAndPassword(auth, email, password);

// 2. Automatski se kreira Firestore struktura
await initializeUser(user.uid, user.email);
```

**Šta se kreira:**
- ✅ `users/{userId}` dokument
- ✅ `users/{userId}/subscription/info` dokument
- ✅ Default cjenovnik
- ✅ Trial period (15 dana)

### 2. Spremanje Obračuna

```javascript
// Obračun se čuva pod user-specific putanjom
const docRef = doc(db, "users", userId, "obracuni", datumString);
await setDoc(docRef, obracunData);
```

**Rezultat:**
- ✅ Obračun se čuva samo za tog korisnika
- ✅ Drugi korisnici ne mogu vidjeti ovaj obračun

### 3. Učitavanje Podataka

```javascript
// Učitaj obračune samo za trenutnog korisnika
const obracuniRef = collection(db, "users", userId, "obracuni");
const snapshot = await getDocs(obracuniRef);
```

**Rezultat:**
- ✅ Učitavaju se samo obračuni trenutnog korisnika
- ✅ Drugi korisnici ne mogu pristupiti ovim podacima

---

## 🔄 Migracija Starih Korisnika

Ako postoje stari korisnici koji nemaju strukturu u Firestore:

### Automatska Migracija

Kada se korisnik prijavi, provjerava se da li postoji u Firestore:

```javascript
const userDoc = await getDoc(doc(db, "users", userId));

if (!userDoc.exists()) {
  // Automatski kreiraj strukturu
  await initializeUser(userId, user.email);
}
```

**Rezultat:**
- ✅ Stari korisnici automatski dobijaju strukturu pri sljedećoj prijavi
- ✅ Ne gube postojeće podatke iz localStorage

---

## ✅ Provjera Izolacije

### Test Scenarij:

1. **Kreiraj Korisnika A:**
   - Email: `korisnikA@test.com`
   - Dodaj obračun za danas

2. **Kreiraj Korisnika B:**
   - Email: `korisnikB@test.com`
   - Dodaj obračun za danas

3. **Prijavi se kao Korisnik A:**
   - ✅ Vidi samo svoje obračune
   - ✅ Ne vidi obračune Korisnika B

4. **Prijavi se kao Korisnik B:**
   - ✅ Vidi samo svoje obračune
   - ✅ Ne vidi obračune Korisnika A

---

## 🎯 Zaključak

- ✅ **Svaki korisnik ima svoju izolovanu bazu podataka**
- ✅ **Podaci se ne miješaju između korisnika**
- ✅ **Automatska inicijalizacija pri registraciji**
- ✅ **Sigurnost kroz Firestore Security Rules**
- ✅ **User-specific localStorage keys**

---

## 📝 Napomene

- Ako korisnik nema strukturu u Firestore, automatski se kreira pri prijavi
- Stari korisnici se automatski migriraju pri sljedećoj prijavi
- Svi podaci su zaštićeni Firestore Security Rules

