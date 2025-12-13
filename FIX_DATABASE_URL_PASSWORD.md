# Popravka Database URL - Lozinka Problem

## Problem:
`DATABASE_URL=postgresql://office_user:Jasamkonj12_@localhost:5432/office_app`

Greška: `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string`

## Rješenje:

### Opcija 1: URL-encode lozinku (Preporučeno)

Ako lozinka sadrži specijalne karaktere (`_`, `@`, `#`, `$`, `%`, `&`, `*`, itd.), moraju biti URL-encodovani.

Za `Jasamkonj12_`:
- `_` može biti problem, ali obično nije
- Provjeri da li `office_user` postoji i ima tačnu lozinku

**Testiraj da li `office_user` može se povezati:**
```bash
psql -U office_user -d office_app -c "SELECT NOW();"
```

### Opcija 2: Koristi `postgres` user umjesto `office_user`

Ako `postgres` user radi (kao što si provjerio), promijeni `DATABASE_URL`:

```bash
cd ~/bar-app
nano .env.local
```

Promijeni:
```env
DATABASE_URL=postgresql://postgres:POSTGRES_LOZINKA_OVDJE@localhost:5432/office_app
```

### Opcija 3: Provjeri da li PM2 učitava .env.local

PM2 automatski NE učitava `.env.local` fajl. Treba koristiti `--update-env` ili `dotenv` package.

**Provjeri output logove da vidiš šta se loguje:**

```bash
pm2 logs office-app --out --lines 50 | grep -i "database\|initializing"
```

Trebao bi vidjeti:
```
Database environment check: {
  hasDATABASE_URL: true,
  DATABASE_URL_length: 67,
  ...
}
Initializing database pool: {
  hasDATABASE_URL: true,
  safeConnectionString: 'postgresql://office_user:****@localhost:5432/office_app'
}
```

Ako vidiš `hasDATABASE_URL: false`, PM2 ne učitava `.env.local`.

---

## Rješenje: Koristi `postgres` user (Najlakše)

Pošto si provjerio da `postgres` user radi:

```bash
cd ~/bar-app
nano .env.local
```

**Promijeni `DATABASE_URL` liniju na:**

```env
DATABASE_URL=postgresql://postgres:POSTGRES_LOZINKA@localhost:5432/office_app
```

**Zamijeni `POSTGRES_LOZINKA` sa stvarnom lozinkom za `postgres` user.**

Ako ne znaš lozinku za `postgres`, postavi je:
```bash
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'nova_lozinka';"
```

---

## Provjera Nakon Promjene:

```bash
cd ~/bar-app
# Restartuj PM2
pm2 restart office-app --update-env

# Provjeri logove
pm2 logs office-app --lines 30 --nostream | grep -i "database\|initializing\|hasDATABASE_URL"
```

Trebao bi vidjeti:
- `hasDATABASE_URL: true`
- `safeConnectionString: 'postgresql://postgres:****@localhost:5432/office_app'`
- Nema `SASL: SCRAM-SERVER-FIRST-MESSAGE` greške

