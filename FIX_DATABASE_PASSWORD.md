# Popravka Database Connection - Missing Password

## Problem:
```
'SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string'
Connection string: 'postgresql://postgres:@localhost:5432/office_app'
```

Connection string nema lozinku za PostgreSQL.

## Rješenje:

### 1. Pronađi PostgreSQL lozinku:

```bash
# Provjeri da li postoji .env.local
cd ~/bar-app
cat .env.local

# Ili provjeri PostgreSQL konfiguraciju
sudo -u postgres psql -c "\password postgres"
# Ovo će zatražiti novu lozinku, ali možemo provjeriti postojeću
```

### 2. Ako ne znaš lozinku, postavi novu:

```bash
# Uđi u PostgreSQL kao postgres user
sudo -u postgres psql

# U PostgreSQL shell-u:
ALTER USER postgres PASSWORD 'nova_lozinka_ovdje';
\q
```

### 3. Postavi DATABASE_URL u .env.local:

```bash
cd ~/bar-app
nano .env.local
```

Dodaj ili uredi:
```env
DATABASE_URL=postgresql://postgres:NOVA_LOZINKA_OVDJE@localhost:5432/office_app
JWT_SECRET=neki-secret-key-ovdje-minimum-32-characters
NODE_ENV=production
PORT=3001
```

**Primjer (zamijeni NOVA_LOZINKA_OVDJE sa stvarnom lozinkom):**
```env
DATABASE_URL=postgresql://postgres:mypassword123@localhost:5432/office_app
JWT_SECRET=my-super-secret-jwt-key-change-this-in-production-12345
NODE_ENV=production
PORT=3001
```

### 4. Provjeri da li možemo se povezati sa novom lozinkom:

```bash
# Testiraj konekciju
psql "postgresql://postgres:NOVA_LOZINKA_OVDJE@localhost:5432/office_app" -c "SELECT NOW();"
```

### 5. Restartuj PM2 da učita nove environment variables:

```bash
cd ~/bar-app
pm2 restart office-app --update-env
pm2 logs office-app --lines 30
```

## Očekivani output u logovima:

Nakon restarta, trebao bi vidjeti:
```
Initializing database pool: {
  hasDATABASE_URL: true,
  host: 'localhost',
  useSSL: true,
  safeConnectionString: 'postgresql://postgres:****@localhost:5432/office_app'
}
```

Umjesto:
```
hasDATABASE_URL: false,
safeConnectionString: 'postgresql://postgres:@localhost:5432/office_app'
```

## Ako još uvijek ne radi:

Provjeri da li PostgreSQL zahtijeva autentifikaciju:

```bash
# Provjeri pg_hba.conf
sudo cat /etc/postgresql/*/main/pg_hba.conf | grep -v "^#"
```

Ako vidiš `local all postgres peer` ili `md5`, to je OK. Ako vidiš `trust`, PostgreSQL ne zahtijeva lozinku za localhost konekcije, ali node.js pg driver ipak traži lozinku u connection string-u.

