# 🔗 Povezivanje Domene s Firebase Hostingom - Kratak Vodič

## ✅ Što već imaš:
- ✅ Firebase projekat postoji
- ✅ `firebase.json` konfigurisan
- ✅ Aplikacija spremna za deploy

---

## 📝 KORAK PO KORAK:

### KORAK 1: Provjeri Firebase Projekat (2 min)

1. **Otvori Firebase Console**: https://console.firebase.google.com/
2. **Odaberi projekat**: "kafic-narudzbe" (ili tvoj projekat)
3. **Idi na Hosting** u lijevom meniju
4. **Provjeri status**: 
   - Ako vidiš URL tipa `https://kafic-narudzbe.web.app` → aplikacija je deploy-ovana ✅
   - Ako vidiš "Get started" → trebaš deploy-ovati (KORAK 2)

---

### KORAK 2: Deploy Aplikacije (5 min)

**Ako aplikacija NIJE deploy-ovana:**

```bash
# 1. Build aplikacije
npm run build

# 2. Provjeri da li si prijavljen u Firebase
firebase login

# 3. Deploy na Firebase Hosting
firebase deploy --only hosting
```

**Nakon deploy-a:**
- Vidićeš URL: `https://kafic-narudzbe.web.app`
- Otvori URL i provjeri da aplikacija radi

---

### KORAK 3: Registracija Domene (10-15 min)

**Ako NEMAŠ domenu:**

1. **Odaberi registrar**:
   - **Namecheap** (preporučeno): https://www.namecheap.com/
   - **Google Domains**: https://domains.google/
   - **Cloudflare**: https://www.cloudflare.com/products/registrar/

2. **Registriraj domenu**:
   - Pretraži željenu domenu (npr. "mojkafic.com")
   - Kupi domenu (~$10-15/godina za .com)
   - Sačekaj aktivaciju (24-48 sati)

---

### KORAK 4: Povezivanje Domene s Firebase (10 min)

1. **U Firebase Console**:
   - Idi na **Hosting** → **Add custom domain** (ili **Connect domain**)
   - Unesi svoju domenu (npr. "mojkafic.com")
   - Klikni **Continue**

2. **Firebase će ti dati DNS zapise**:
   - **A Record** (IPv4): `151.101.1.195` (ili slično)
   - **AAAA Record** (IPv6): `2a04:4e42::323` (ili slično)
   - **ILI CNAME**: `kafic-narudzbe.web.app`

3. **Dodaj DNS zapise u registraru**:
   - Otvori DNS upravljanje u registraru
   - Dodaj **A Record**:
     - **Type**: A
     - **Host/Name**: `@` (ili ostavi prazno)
     - **Value/IP**: Unesi IPv4 adresu iz Firebase-a
     - **TTL**: `3600` ili "Automatic"
   - Dodaj **AAAA Record** (opcionalno):
     - **Type**: AAAA
     - **Host/Name**: `@`
     - **Value/IP**: Unesi IPv6 adresu iz Firebase-a
     - **TTL**: `3600`

4. **Sačekaj verifikaciju**:
   - Firebase automatski verificira domenu (5-60 min)
   - Status će se promijeniti iz "Pending" → "Connected"
   - Dobit ćeš email kada je spremno

5. **SSL Certifikat**:
   - Firebase automatski kreira SSL certifikat (10-60 min)
   - Status: "Provisioning" → "Active"

---

### KORAK 5: Provjera (2 min)

1. **Otvori domenu**: `https://mojkafic.com`
2. **Provjeri SSL**: Treba biti 🔒 (lock ikona)
3. **Provjeri da aplikacija radi**: Login stranica se treba učitati

---

## 🎯 Brzi Checklist:

- [ ] Firebase projekat postoji
- [ ] Aplikacija deploy-ovana na Firebase Hosting
- [ ] Domenu registrirana
- [ ] DNS zapisi dodani u registraru
- [ ] Firebase verificirao domenu
- [ ] SSL certifikat aktivan
- [ ] Aplikacija radi na custom domeni

---

## ⚠️ Važne Napomene:

1. **DNS propagacija**: Može potrajati 24-48 sati (obično je brže, 5-60 min)
2. **SSL certifikat**: Automatski se kreira, ne trebaš ništa raditi
3. **Firebase Hosting**: Besplatan do limita (10 GB storage, 360 MB/dan)
4. **Custom domain**: Besplatna opcija u Firebase Hosting-u

---

## 🆘 Troubleshooting:

### Problem: DNS zapisi se ne ažuriraju
- Sačekaj 24-48 sati
- Provjeri da su zapisi tačni
- Koristi: https://dnschecker.org/ za provjeru

### Problem: Domena se ne verificira
- Provjeri da su DNS zapisi tačni
- Sačekaj do 24 sata
- Kontaktiraj Firebase support

### Problem: SSL se ne aktivira
- Provjeri da je domena verificirana
- Sačekaj do 60 minuta
- Kontaktiraj Firebase support

---

## 📞 Potrebna Pomoc?

- **Firebase Console**: https://console.firebase.google.com/
- **Firebase Support**: https://firebase.google.com/support
- **DNS Checker**: https://dnschecker.org/

---

**Srećno! 🚀**

