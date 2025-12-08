# Kako dobiti Firebase Service Account JSON fajl

## Korak po korak uputstvo

### 1. Otvori Firebase Console

Idi na: **https://console.firebase.google.com/project/zadnji-projekt/settings/serviceaccounts/adminsdk**

Ili:
1. Otvori: https://console.firebase.google.com
2. Odaberi projekat: **zadnji-projekt**
3. Klikni na ⚙️ **Settings** (ikonu zupčanika) u gornjem lijevom uglu
4. U meniju sa lijeve strane klikni **Project settings**
5. Klikni na tab **Service accounts** (druga opcija na vrhu)

### 2. Generiši novi Private Key

Na stranici "Service accounts" ćeš vidjeti:
- Sekciju **"Firebase Admin SDK"**
- Opciju **"Generate new private key"** (plavi button)

**Klikni na "Generate new private key"**

### 3. Potvrdi generisanje

Pojaviće se pop-up prozor sa upozorenjem:
- Poruka: "Are you sure you want to generate a new private key?"
- **VAŽNO**: Ovaj korak će generisati novi key - stari key će prestati da radi!

Klikni **"Generate key"** u pop-up prozoru.

### 4. Preuzmi JSON fajl

Nakon što klikneš "Generate key":
- Automatski će se preuzeti JSON fajl
- Ime fajla će biti nešto poput: `zadnji-projekt-firebase-adminsdk-xxxxx-xxxxx.json`
- Fajl će se preuzeti u tvoj **Downloads** folder

### 5. Otvori JSON fajl

1. Otvori preuzeti JSON fajl u bilo kojem text editoru (Notepad++, VS Code, Notepad, itd.)
2. Trebao bi izgledati ovako:

```json
{
  "type": "service_account",
  "project_id": "zadnji-projekt",
  "private_key_id": "xxxxx",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@zadnji-projekt.iam.gserviceaccount.com",
  "client_id": "xxxxx",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40zadnji-projekt.iam.gserviceaccount.com"
}
```

### 6. Kopiraj potrebne vrijednosti

Iz JSON fajla trebaš kopirati **3 vrijednosti**:

1. **`project_id`** - obično `"zadnji-projekt"`
2. **`client_email`** - nešto poput `"firebase-adminsdk-xxxxx@zadnji-projekt.iam.gserviceaccount.com"`
3. **`private_key`** - cijeli string koji počinje sa `"-----BEGIN PRIVATE KEY-----"` i završava sa `"-----END PRIVATE KEY-----\n"`

**VAŽNO za `private_key`:**
- Kopiraj **cijeli** string uključujući:
  - `"-----BEGIN PRIVATE KEY-----\n"` (početak)
  - Srednji dio (dugačak string karaktera)
  - `\n-----END PRIVATE KEY-----\n"` (kraj)
- Moraju biti sačuvani `\n` karakteri (ili stvarne nove linije)

### 7. Share-uj podatke

Kada dobiješ ove 3 vrijednosti, možeš ih:
1. Kopirati ovdje u chat (možeš zamaskirati dijelove `private_key` ako želiš)
2. Ili ih direktno dodati u `.env.local` fajl
3. Ili ih dodati preko Vercel Dashboard-a

## Direktni link

**Klikni ovdje za direktan pristup:**
👉 https://console.firebase.google.com/project/zadnji-projekt/settings/serviceaccounts/adminsdk

## Screenshot opcije

Ako ne možeš pronaći, evo šta tražiš:
- U Firebase Console, u meniju: **⚙️ Settings** → **Project settings** → **Service accounts** tab
- Plavi button sa tekstom: **"Generate new private key"**

## Sigurnost

⚠️ **VAŽNO**: 
- Ovaj JSON fajl sadrži **osjetljive podatke**!
- Ne share-uj ga javno
- Ne commit-uj ga u git
- Čuvaj ga sigurno
- Ako ga slučajno share-uješ, možeš generisati novi key u Firebase Console


