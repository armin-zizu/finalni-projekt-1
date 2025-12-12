# Kako Postaviti PostgreSQL Lozinku

## Metoda 1: Postavljanje lozinke direktno u PostgreSQL

### Korak 1: Uđi u PostgreSQL kao postgres korisnik

```bash
sudo -u postgres psql
```

Ovo će te uvesti u PostgreSQL shell (vidiš prompt: `postgres=#`)

### Korak 2: Postavi lozinku za postgres korisnika

U PostgreSQL shell-u, unesi sljedeću komandu (zamijeni `nova_lozinka_ovdje` sa željenom lozinkom):

```sql
ALTER USER postgres PASSWORD 'nova_lozinka_ovdje';
```

**Primjer:**
```sql
ALTER USER postgres PASSWORD 'moja_jaka_lozinka_123';
```

### Korak 3: Izlaz iz PostgreSQL

```sql
\q
```

Ili jednostavno pritisni `Ctrl+D`

---

## Metoda 2: Postavljanje lozinke iz command line-a (bez ulaska u shell)

```bash
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'nova_lozinka_ovdje';"
```

**Primjer:**
```bash
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'moja_jaka_lozinka_123';"
```

---

## Korak 4: Testiraj konekciju sa novom lozinkom

```bash
psql -U postgres -d office_app -c "SELECT NOW();"
```

Ovo će zatražiti lozinku - unesi novu lozinku koju si postavio.

---

## Korak 5: Dodaj DATABASE_URL u .env.local

```bash
cd ~/bar-app
nano .env.local
```

Dodaj ili uredi sljedeće (zamijeni `nova_lozinka_ovdje` sa lozinkom koju si postavio):

```env
DATABASE_URL=postgresql://postgres:nova_lozinka_ovdje@localhost:5432/office_app
JWT_SECRET=neki-secret-key-minimum-32-characters-123456789
NODE_ENV=production
PORT=3001
```

**Primjer:**
```env
DATABASE_URL=postgresql://postgres:moja_jaka_lozinka_123@localhost:5432/office_app
JWT_SECRET=my-super-secret-jwt-key-change-this-123456789
NODE_ENV=production
PORT=3001
```

**Važno:** Ako lozinka sadrži specijalne karaktere (npr. `@`, `#`, `$`, `%`, `&`, `*`), moraš ih URL-encodeovati:
- `@` → `%40`
- `#` → `%23`
- `$` → `%24`
- `%` → `%25`
- `&` → `%26`
- `*` → `%2A`

Ali bolje je koristiti lozinku bez specijalnih karaktera za jednostavnost.

### Spremi fajl:
- U `nano` editoru: Pritisni `Ctrl+O` (za save), zatim `Enter`, zatim `Ctrl+X` (za izlaz)

---

## Korak 6: Restartuj PM2 da učita novu lozinku

```bash
cd ~/bar-app
pm2 restart office-app --update-env
pm2 logs office-app --lines 30
```

---

## Pregled cijelog procesa (jedna po jedna komanda):

```bash
# 1. Postavi lozinku u PostgreSQL
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'moja_lozinka_123';"

# 2. Testiraj konekciju (opciono)
psql -U postgres -d office_app -c "SELECT NOW();"

# 3. Otvori .env.local za uređivanje
cd ~/bar-app
nano .env.local

# 4. Dodaj/uredi DATABASE_URL (vidi primjer gore)
# Spremi: Ctrl+O, Enter, Ctrl+X

# 5. Restartuj PM2
pm2 restart office-app --update-env

# 6. Provjeri logove
pm2 logs office-app --lines 30
```

---

## Ako zaboraviš lozinku:

Ako zaboraviš lozinku, možeš je resetovati tako što ćeš ponovo postaviti:

```bash
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'nova_lozinka';"
```

Ili ako imaš pristup serveru kao root, možeš ući bez lozinke:

```bash
sudo -u postgres psql
```

Zatim postavi novu lozinku:
```sql
ALTER USER postgres PASSWORD 'nova_lozinka';
\q
```

---

## Sigurnost:

- **NIKAD** nemoj commitovati `.env.local` u Git
- Koristi jaku lozinku (minimalno 12 karaktera, kombinacija slova, brojeva)
- Ne dijele lozinku javno

