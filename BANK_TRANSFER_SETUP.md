# 🏦 Bank Transfer Setup

## Najjednostavniji način plaćanja

Bank Transfer je najjednostavniji i najlakši način plaćanja - nema provizije i nema potrebe za treće strane.

---

## Setup

### 1. Dodaj Broj Računa

Dodaj svoj broj računa u environment varijable:

**U `.env.local` (za development):**
```
NEXT_PUBLIC_BANK_ACCOUNT=XXX-XXX-XXXXXXX-XX
```

**Na Vercel-u (za production):**
1. Idi na: Settings → Environment Variables
2. Dodaj: `NEXT_PUBLIC_BANK_ACCOUNT` = `XXX-XXX-XXXXXXX-XX`
3. Redeploy projekat

---

## Kako funkcioniše

### 1. Korisnik odabere period
- Korisnik odabere period pretplate (1, 2, 3 ili 6 mjeseci)
- Automatski se izračuna ukupna cijena (12 KM × broj mjeseci)

### 2. Korisnik vidi instrukcije
- **Broj računa**: Tvoj broj računa
- **Reference broj**: Jedinstven za svakog korisnika (format: `REF-{USER_ID}-{MONTHS}`)
- **Iznos**: Ukupna cijena za odabrani period
- **Svrha plaćanja**: "Pretplata - X mjeseci"

### 3. Korisnik izvrši transfer
- Korisnik ide u banku ili koristi online banking
- Unese sve podatke sa instrukcija
- Izvrši transfer

### 4. Aktivacija pretplate
- Ti provjeriš uplatu u banci
- Pronađeš korisnika po reference broju
- Aktiviraš pretplatu u aplikaciji (ručno ili kroz admin panel)

---

## Reference Broj

Reference broj se automatski generiše za svakog korisnika:
- **Format**: `REF-{USER_ID}-{MONTHS}`
- **Primjer**: `REF-ABC12345-3` (za 3 mjeseca)
- **Jedinstven**: Svaki korisnik ima svoj reference broj za svaki period

---

## Ručno Aktiviranje Pretplate

Nakon što korisnik izvrši bank transfer:

1. **Provjeri uplatu u banci**
   - Provjeri da li je uplata stigla
   - Zabilježi reference broj

2. **Pronađi korisnika**
   - Reference broj sadrži korisnički ID
   - Format: `REF-{USER_ID}-{MONTHS}`

3. **Aktiviraj pretplatu**
   - Otvori aplikaciju
   - Idi na korisnički profil (ili admin panel)
   - Aktiviraj pretplatu za odabrani period

---

## Automatizacija (Opcionalno)

Možeš automatizovati proces:

1. **Email Notifikacije**
   - Kada korisnik zatraži bank transfer, pošalji mu email sa instrukcijama
   - Kada aktiviraš pretplatu, pošalji mu potvrdu

2. **Bank API** (ako tvoja banka podržava)
   - Automatska provjera uplata
   - Automatska aktivacija pretplate

3. **Admin Panel**
   - Lista svih zahtjeva za bank transfer
   - Mogućnost aktivacije pretplate direktno iz panela

---

## Prednosti

✅ **Nema provizije** - direktan transfer na tvoj račun  
✅ **Popularno u BiH** - korisnici su navikli na bankovne transfere  
✅ **Jednostavno** - nema potrebe za treće strane  
✅ **Sigurno** - direktan transfer između računa  

---

## Mane

❌ **Ručno procesiranje** - moraš provjeravati uplate  
❌ **Sporije** - 1-3 dana za transfer  
❌ **Nije automatsko** - moraš aktivirati pretplatu ručno  

---

## Primjer Reference Broja

Ako korisnik ima ID `Qkql1GLaDmMvZyWBPtWXMzEj7j43` i odabere 3 mjeseca:
- Reference broj: `REF-QKQL1GLA-3`

---

## Troubleshooting

### Reference broj se ne prikazuje:
- Provjeri da li je korisnik prijavljen
- Provjeri da li je `auth.currentUser` dostupan

### Broj računa se ne prikazuje:
- Provjeri da li je `NEXT_PUBLIC_BANK_ACCOUNT` postavljen u environment varijablama
- Provjeri da li je projekat redeploy-ovan nakon dodavanja varijable


