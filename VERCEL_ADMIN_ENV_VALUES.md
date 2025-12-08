# Environment Varijable za Vercel - Firebase Admin SDK

## Podatci za postavljanje na Vercel-u

Kopiraj i paste-uj ove vrijednosti u Vercel Dashboard:

### 1. FIREBASE_PROJECT_ID

**Key:** `FIREBASE_PROJECT_ID`  
**Value:** `zadnji-projekt`  
**Environments:** ✅ Production, ✅ Preview, ✅ Development

---

### 2. FIREBASE_CLIENT_EMAIL

**Key:** `FIREBASE_CLIENT_EMAIL`  
**Value:** `firebase-adminsdk-fbsvc@zadnji-projekt.iam.gserviceaccount.com`  
**Environments:** ✅ Production, ✅ Preview, ✅ Development

---

### 3. FIREBASE_PRIVATE_KEY

**Key:** `FIREBASE_PRIVATE_KEY`  
**Value:** (Kopiraj cijeli string ispod - uključujući BEGIN i END linije)

```
-----BEGIN PRIVATE KEY-----
MIIEuwIBADANBgkqhkiG9w0BAQEFAASCBKUwggShAgEAAoIBAQCPitkBtnWya8Kw
qFf+DGD0fTqzQnV7RRy8+WnTpv9ZjVHmpHdn10pk2kir8IHxawjLMcmYijZHwQ3j
av8YzhzdiVdehiJiSFyuAmTPvC4/b6+IruPQoW7fIWVTR4MV980PRlSKKPL3TwdD
IP3yVcjytSD3bHR6I9L4UgvctpE79TgnubQ/3YICocwbpvjskNnBYntFiF1iVIzI
QLBBmzTuRmxtElxGwBcemYJm8S8OaM/zIevNTW05NzAwSkadRZDsUFTRTA5atnFO
GtOUZIjy88pyPdiiw5NZd/eTVr00O5CnnDXVjXYbOPB3vYtGL+zCUr3NmTXxKvOB
n1GsIAdDAgMBAAECgf9HBcGvF0MlBNdP5qZNt9JBJl/k/P0kAQ43HTE/iAwlmHGY
V8gSQ8k2HXXXnSiuSvIO7T4nkOX1RZBES1dCRA6u4/BW1LIumZ9Bz0K827SxA+cr
ugepMuGo2t1HrMUvbsIHd2+yQeX1zSR1Z92UCjNjOOZsMJLGhvMxQBHzzba5SIjN
vrgcs2cjaOHyHCBvims6SaNAHlQbQzVHup61+vKc2qwx42PGjUx4/l9Yaoc9dhPB
X7IFOiOlxpzmknsxjEK4X4OgrEsZA5m8Q1FmJq+g6kLNXYz2AfGxF4X6JRP13YJh
8iBdvjGRw9Xd/1UpvqfBKXxZamDmFGyqKvBI7SECgYEAv/6LuBoqW0l3cxq7wxkb
33U4qCX1ShRT/2J2iofc2Ctg5+XLPpcQ6GcOpL8G58eLWfP+9KMEcIEIH/dsb/TY
Gase19baiFn4GpTlh4zyrFkCOasBGvp5WGf7UCH8FeJeBMuilt8zUIUMd+RP6tHK
GzcAudi1AN5Xv6oD3JA9yk0CgYEAv2U/Hh7JsHrkPgL0ftQhD6ZbRpVJ0i0k+BcY
fxw8W5AY0I46e1WHSPDjbnyNkLrCi8pZ+GO0dDcCEuWhG9jfv3iAgl3FOFGjU9yE
ApthhXe32huHevoGYUb42dRh8+g2Mm6XlOZynYt6eVG+vRlLPP+QLrZwNckkEKdA
o1oiv88CgYAFSbB1cJsMCpj0nZ7gP7fJzsOxteHsmWS62u5i4F0PwxoXKPgRED4R
+Iypsu0wwwkugA7clATSSGt93eWpq7er9U+TKEK6kKfJq6IqupIQdx8dkX0lThK7
gZmlWlpEDAkE3srqltkl9ZQjVTFySTbkyv4FIFfT30vRZpBWqc5Z3QKBgFdNkZrl
pE5R4CbBJlFr5aDD20K4+jFa0lAwCMaCVK3XbtpC5j435zvIVZWiTtjDt9YX+S4q
HLgeF14TTIftRzKJfuT4bOuhoYSxQ64EvlkpIL3mbMgVoC9jNkP2cq/VLlOWyqHq
9EEUzErmlMCg9wbd9CC6qzh9hWvrPrrEdLFVAoGBAKCcZhSOBbnrYp3iCYPrluoo
ci81wjmhGs0J3oqrw8kxW8A1+Dc7qaICl8CWzB1Hwea/nFvc0j+1GntlTSGDTzao
hBryPIAUlhoqtKKmi9Qxxx1C5f7IHaqEZh6rMNQZ0m347t/9PerMxitvrYbJV2wc
YsSpnyk0u1z8pfv2K2dT
-----END PRIVATE KEY-----
```

**IMPORTANT:** 
- Kopiraj **cijeli** string uključujući `-----BEGIN PRIVATE KEY-----` i `-----END PRIVATE KEY-----`
- Kada paste-uješ u Vercel, novi redovi će se automatski konvertovati u `\n` karaktere
- **Environments:** ✅ Production, ✅ Preview, ✅ Development

---

## Kako postaviti na Vercel-u

### Opcija 1: Preko Vercel Dashboard (Preporučeno)

1. Idi na: https://vercel.com/dashboard
2. Odaberi projekat: **finalni-projekt-1** (ili ime tvog projekta)
3. Klikni na: **Settings** → **Environment Variables**
4. Za svaku od tri varijable gore:
   - Klikni **"Add New"**
   - Unesi **Key** i **Value**
   - Odaberi **Production**, **Preview**, i **Development**
   - Klikni **"Save"**

5. **VAŽNO:** Nakon dodavanja svih varijabli:
   - Idi na **Deployments** tab
   - Klikni na tri tačke (⋮) pored posljednjeg deployment-a
   - Klikni **"Redeploy"**
   - Ili commit novi push na GitHub da trigger-uje novi deploy

### Opcija 2: Preko Vercel CLI

```bash
# Instaliraj Vercel CLI (ako nije instaliran)
npm i -g vercel

# Login u Vercel
vercel login

# Dodaj varijable za production
echo "zadnji-projekt" | vercel env add FIREBASE_PROJECT_ID production
echo "firebase-adminsdk-fbsvc@zadnji-projekt.iam.gserviceaccount.com" | vercel env add FIREBASE_CLIENT_EMAIL production
# Za private key, bolje koristi dashboard ili:
cat private_key.txt | vercel env add FIREBASE_PRIVATE_KEY production

# Ponovi za preview i development environment
echo "zadnji-projekt" | vercel env add FIREBASE_PROJECT_ID preview
echo "firebase-adminsdk-fbsvc@zadnji-projekt.iam.gserviceaccount.com" | vercel env add FIREBASE_CLIENT_EMAIL preview
# itd...

# Redeploy
vercel --prod
```

---

## Provjera

Nakon postavljanja:

1. ✅ Provjeri da li su sve tri varijable dodane u Vercel Dashboard
2. ✅ Provjeri da li su postavljene za Production, Preview, i Development
3. ✅ Redeploy projekat
4. ✅ Testiraj admin stranicu - trebalo bi da učitava korisnike bez greške

## Troubleshooting

Ako i dalje imaš greške:
- Provjeri Vercel build logs
- Provjeri da li je `FIREBASE_PRIVATE_KEY` ispravno formatiran (sa novim linijama)
- Provjeri da li je redeploy prošao uspješno


