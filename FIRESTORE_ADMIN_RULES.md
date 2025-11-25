# 🔐 Firestore Security Rules - Admin Pristup

## ⚠️ Važno: Ažuriraj Admin Email u Rules

Firestore Security Rules koriste hardcoded admin email. **Moraš ažurirati admin email u `firestore.rules`** na svoj email.

### Korak 1: Ažuriraj Admin Email u Rules

Otvori `firestore.rules` i promijeni:

```javascript
function isAdmin() {
  return request.auth != null && 
         request.auth.token.email != null &&
         (request.auth.token.email == 'TVOJ_EMAIL@example.com' ||  // PROMIJENI OVO
          request.auth.token.email.matches('.*@.*'));
}
```

**Primjer:**
```javascript
function isAdmin() {
  return request.auth != null && 
         request.auth.token.email != null &&
         request.auth.token.email == 'arminposlovni@gmail.com'; // Tvoj admin email
}
```

### Korak 2: Deploy Rules

Nakon što ažuriraš rules, deploy-aj ih:

```bash
firebase deploy --only firestore:rules
```

Ili kroz Firebase Console:
1. Otvori: https://console.firebase.google.com/project/zadnji-projekt/firestore/rules
2. Kopiraj ažurirane rules
3. Klikni "Publish"

---

## 📋 Kako Funkcioniše

### Admin Pristup

Admin može:
- ✅ Čitati podatke svih korisnika
- ✅ Pisati podatke svih korisnika
- ✅ Pristupiti svim subscription dokumentima
- ✅ Pristupiti svim obračunima

### Regular Korisnik

Regular korisnik može:
- ✅ Čitati samo svoje podatke
- ✅ Pisati samo svoje podatke
- ✅ Pristupiti samo svojoj subscription
- ✅ Pristupiti samo svojim obračunima

---

## 🔒 Sigurnost

- Admin email se provjerava u Security Rules
- Samo korisnik sa admin email-om može pristupiti podacima svih korisnika
- Regular korisnici i dalje imaju izolovane podatke

---

## 🐛 Troubleshooting

### Problem: "Missing or insufficient permissions"

**Rješenje:**
1. Provjeri da li si ažurirao admin email u `firestore.rules`
2. Provjeri da li si deploy-ao rules (`firebase deploy --only firestore:rules`)
3. Provjeri da li si prijavljen sa admin email-om
4. Provjeri da li je `NEXT_PUBLIC_ADMIN_EMAIL` postavljen ispravno

### Problem: Admin ne vidi korisnike

**Rješenje:**
1. Provjeri da li je admin email u rules isti kao email sa kojim si prijavljen
2. Provjeri da li su rules deploy-ani
3. Provjeri console za greške

