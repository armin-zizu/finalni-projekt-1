# 💳 Payment Setup - PayPal + Bank Transfer

## PayPal Setup

### 1. Kreiraj PayPal Business Account

1. Otvori: https://www.paypal.com/business
2. Registruj se ili prijavi se
3. Verifikuj svoj business account

### 2. Uzmi API Credentials

1. Idi na: https://developer.paypal.com/dashboard
2. Klikni "Create App"
3. Odaberi "Merchant" ili "Personal"
4. Uzmi **Client ID** i **Secret**

### 3. Environment Varijable

Dodaj u `.env.local` i na Vercel:

```
# PayPal
PAYPAL_CLIENT_ID=your_client_id_here
PAYPAL_CLIENT_SECRET=your_client_secret_here
PAYPAL_MODE=sandbox  # ili "live" za production

# App URL
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app  # ili http://localhost:3000 za development

# Bank Account (za bank transfer)
NEXT_PUBLIC_BANK_ACCOUNT=XXX-XXX-XXXXXXX-XX  # Tvoj broj računa
```

### 4. Webhook Setup

1. Idi na: https://developer.paypal.com/dashboard/webhooks
2. Klikni "Create Webhook"
3. URL: `https://your-app.vercel.app/api/paypal-webhook`
4. Odaberi events:
   - `PAYMENT.CAPTURE.COMPLETED`
5. Kopiraj **Webhook ID** (ne treba ga dodati u env varijable, PayPal ga automatski šalje)

---

## Bank Transfer Setup

### 1. Dodaj Broj Računa

Dodaj svoj broj računa u environment varijable:

```
NEXT_PUBLIC_BANK_ACCOUNT=XXX-XXX-XXXXXXX-XX
```

### 2. Reference Broj

Reference broj se automatski generiše za svakog korisnika:
- Format: `REF-{USER_ID}-{MONTHS}`
- Primjer: `REF-ABC12345-3` (za 3 mjeseca)

### 3. Ručno Aktiviranje

Nakon što korisnik izvrši bank transfer:

1. Provjeri uplatu u banci
2. Pronađi korisnika po reference broju
3. Aktiviraj pretplatu u aplikaciji (možeš dodati admin panel kasnije)

---

## Testiranje

### PayPal Sandbox

1. Koristi PayPal Sandbox account za testiranje
2. Test kartice:
   - **Success**: `4032034814971234`
   - **Decline**: `4000000000000002`
   - Expiry: bilo koji budući datum
   - CVC: bilo koji 3-cifreni broj

### Bank Transfer

1. Korisnik dobije instrukcije sa reference brojem
2. Testiraj sa svojim računom
3. Provjeri da li se reference broj ispravno generiše

---

## Valuta

PayPal podržava BAM (Bosanska marka) u production modu. Za testiranje u sandbox modu, možemo koristiti EUR ili USD.

---

## Troubleshooting

### PayPal ne radi:
- Provjeri da li su Client ID i Secret ispravni
- Provjeri da li je PAYPAL_MODE postavljen na "sandbox" za testiranje
- Provjeri PayPal Developer Console za greške

### Bank Transfer:
- Provjeri da li je NEXT_PUBLIC_BANK_ACCOUNT postavljen
- Provjeri da li se reference broj ispravno generiše
- Provjeri da li korisnik koristi ispravan reference broj

