# Firebase Hosting - Povezivanje domene - Korak po Korak

## 📋 Preduvjeti

- ✅ Firebase projekat već postoji
- ✅ Aplikacija je već na Firebase-u ili ćeš je deploy-ovati
- ✅ Imaš domenu (ili ćeš je registrirati)

---

## KORAK 1: Provjeri Firebase Hosting Status

### 1.1. Otvori Firebase Console
1. Idi na: https://console.firebase.google.com/
2. Odaberi svoj projekat (npr. "kafic-narudzbe")

### 1.2. Provjeri Hosting
1. U lijevom meniju klikni na **"Hosting"**
2. Ako vidiš poruku "Get started", klikni na to i prati upute
3. Ako već imaš deploy-ovano, vidićeš URL tipa: `https://kafic-narudzbe.web.app`

---

## KORAK 2: Deploy Aplikacije na Firebase Hosting (ako već nije)

### 2.1. Build Aplikacije
```bash
npm run build
```

Ovo će kreirati `out/` folder sa statičkim fajlovima.

### 2.2. Deploy na Firebase
```bash
firebase deploy --only hosting
```

**NAPOMENA**: Ako nisi prijavljen, prvo pokreni:
```bash
firebase login
```

### 2.3. Provjeri Deploy
- Nakon deploy-a, vidićeš URL tipa: `https://kafic-narudzbe.web.app`
- Otvori taj URL u browseru i provjeri da aplikacija radi

---

## KORAK 3: Registracija Domene (ako nemaš)

### 3.1. Odaberi Registrar
Preporučeni:
- **Namecheap** (https://www.namecheap.com/)
- **Google Domains** (https://domains.google/)
- **Cloudflare Registrar** (https://www.cloudflare.com/products/registrar/)

### 3.2. Registriraj Domenu
1. Idi na odabrani registrar
2. Pretraži željenu domenu (npr. "mojkafic.com")
3. Dodaj u korpu i kupi
4. Cijena: ~$10-15/godina za .com domenu

### 3.3. Sačekaj Aktivaciju
- Domenu obično treba 24-48 sati da se aktivira
- Dobit ćeš email kada je domena spremna

---

## KORAK 4: Povezivanje Domene s Firebase Hostingom

### 4.1. Otvori Firebase Console
1. Idi na: https://console.firebase.google.com/
2. Odaberi svoj projekat
3. Klikni na **"Hosting"** u lijevom meniju

### 4.2. Dodaj Custom Domain
1. Klikni na **"Add custom domain"** ili **"Connect domain"**
2. Unesi svoju domenu (npr. "mojkafic.com")
3. Klikni **"Continue"**

### 4.3. Firebase će ti dati DNS zapise
Firebase će ti pokazati **2 tipa zapisa**:

#### Tip A: A Record (IPv4)
```
Type: A
Name: @
Value: 151.101.1.195
TTL: 3600
```

#### Tip B: AAAA Record (IPv6) - Opcionalno
```
Type: AAAA
Name: @
Value: 2a04:4e42::323
TTL: 3600
```

**ILI** ako Firebase traži CNAME:
```
Type: CNAME
Name: @
Value: kafic-narudzbe.web.app
TTL: 3600
```

---

## KORAK 5: Postavljanje DNS Zapisa u Registraru

### 5.1. Otvori DNS Upravljanje u Registraru

#### Za Namecheap:
1. Idi na: https://ap.www.namecheap.com/domains/list/
2. Klikni na **"Manage"** pored svoje domene
3. Idi na **"Advanced DNS"** tab

#### Za Google Domains:
1. Idi na: https://domains.google.com/registrar
2. Klikni na svoju domenu
3. Idi na **"DNS"** sekciju

#### Za Cloudflare:
1. Idi na: https://dash.cloudflare.com/
2. Odaberi svoju domenu
3. Idi na **"DNS"** tab

### 5.2. Dodaj DNS Zapise

**VAŽNO**: Firebase će ti reći koje zapise trebaš dodati. Obično su to:

#### Opcija A: A Record (ako Firebase traži)
1. Klikni **"Add new record"**
2. Odaberi tip: **A**
3. **Host/Name**: `@` ili ostavi prazno (za root domenu)
4. **Value/IP**: Unesi IPv4 adresu koju je Firebase dao (npr. `151.101.1.195`)
5. **TTL**: `3600` ili "Automatic"
6. Klikni **"Save"**

#### Opcija B: CNAME (ako Firebase traži)
1. Klikni **"Add new record"**
2. Odaberi tip: **CNAME**
3. **Host/Name**: `@` ili ostavi prazno
4. **Value/Target**: Unesi Firebase hosting URL (npr. `kafic-narudzbe.web.app`)
5. **TTL**: `3600` ili "Automatic"
6. Klikni **"Save"**

### 5.3. Dodaj WWW Subdomenu (Opcionalno)
Ako želiš da `www.mojkafic.com` također radi:

1. Dodaj novi CNAME zapis:
   - **Type**: CNAME
   - **Host/Name**: `www`
   - **Value/Target**: `kafic-narudzbe.web.app` (ili ono što Firebase kaže)
   - **TTL**: `3600`

---

## KORAK 6: Verifikacija u Firebase-u

### 6.1. Vrati se u Firebase Console
1. Idi na **Hosting** sekciju
2. Vidićeš status domene: **"Pending"** ili **"Verifying"**

### 6.2. Firebase će automatski provjeriti DNS zapise
- Ovo može potrajati **5-60 minuta** (ponekad i do 24 sata)
- Firebase će ti poslati email kada je domena verificirana

### 6.3. Provjeri Status
- Status će se promijeniti iz **"Pending"** u **"Connected"**
- Vidićeš zelenu kvačicu kada je sve spremno

---

## KORAK 7: SSL Certifikat (Automatski)

### 7.1. Firebase automatski kreira SSL certifikat
- Nakon verifikacije domene, Firebase automatski kreira SSL certifikat
- Ovo može potrajati **10-60 minuta**

### 7.2. Provjeri SSL Status
- U Firebase Console → Hosting → Custom domains
- Vidićeš status SSL-a: **"Provisioning"** → **"Active"**

---

## KORAK 8: Provjera da Sve Radi

### 8.1. Otvori Svoju Domenu
1. Otvori browser
2. Idi na: `https://mojkafic.com` (tvoja domena)
3. Provjeri da aplikacija radi

### 8.2. Provjeri SSL
- Provjeri da vidiš **"🔒"** (lock ikona) u browseru
- URL treba biti `https://` (ne `http://`)

### 8.3. Provjeri WWW (ako si dodao)
- Otvori: `https://www.mojkafic.com`
- Trebalo bi također raditi

---

## KORAK 9: Redirect WWW na Root (Opcionalno)

Ako želiš da `www.mojkafic.com` automatski preusmjeri na `mojkafic.com`:

1. U Firebase Console → Hosting
2. Klikni na **"Add custom domain"**
3. Dodaj `www.mojkafic.com`
4. Firebase će automatski postaviti redirect

---

## 🔧 Troubleshooting

### Problem: DNS zapisi se ne ažuriraju
**Rješenje**:
- Sačekaj 24-48 sati (DNS propagacija može potrajati)
- Provjeri da si unio tačne vrijednosti
- Provjeri da nemaš duplikate zapisa

### Problem: Domena se ne verificira
**Rješenje**:
- Provjeri da su DNS zapisi tačni
- Provjeri da nemaš greške u tipografiji
- Sačekaj do 24 sata

### Problem: SSL se ne aktivira
**Rješenje**:
- Provjeri da je domena verificirana
- Sačekaj do 60 minuta
- Kontaktiraj Firebase support ako problem traje

### Problem: Aplikacija se ne učitava
**Rješenje**:
- Provjeri da si deploy-ovao aplikaciju: `firebase deploy --only hosting`
- Provjeri da `out/` folder postoji
- Provjeri Firebase Console → Hosting → Deploy history

---

## 📝 Sažetak Koraka

1. ✅ **Deploy aplikacije**: `npm run build` → `firebase deploy --only hosting`
2. ✅ **Registriraj domenu** (ako nemaš)
3. ✅ **Dodaj custom domain u Firebase**: Hosting → Add custom domain
4. ✅ **Dodaj DNS zapise u registraru** (A ili CNAME)
5. ✅ **Sačekaj verifikaciju** (5-60 min)
6. ✅ **Sačekaj SSL** (10-60 min)
7. ✅ **Provjeri da radi**: Otvori domenu u browseru

---

## 💡 Važne Napomene

- **DNS propagacija** može potrajati 24-48 sati (obično je brže)
- **SSL certifikat** se automatski kreira, ne trebaš ništa raditi
- **Firebase Hosting** je besplatan do limita (10 GB storage, 360 MB/dan)
- **Custom domain** je besplatna opcija u Firebase Hosting-u

---

## 🆘 Potrebna Pomoc?

Ako imaš problema:
1. Provjeri Firebase Console → Hosting → Custom domains (vidi status)
2. Provjeri DNS zapise koristeći: https://dnschecker.org/
3. Kontaktiraj Firebase support: https://firebase.google.com/support

---

## ✅ Checklist

- [ ] Aplikacija je deploy-ovana na Firebase Hosting
- [ ] Domenu sam registrirao (ili već imam)
- [ ] Dodao sam custom domain u Firebase
- [ ] Dodao sam DNS zapise u registraru
- [ ] Firebase je verificirao domenu
- [ ] SSL certifikat je aktivan
- [ ] Aplikacija radi na custom domeni
- [ ] WWW subdomena radi (opcionalno)

---

**Srećno! 🚀**

