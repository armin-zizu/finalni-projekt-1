# Provjera Server Environment Variables

Na serveru treba provjeriti da li `.env.local` postoji i da li su environment variables pravilno postavljene.

## Komande za provjeru na serveru:

```bash
# Idi u folder aplikacije
cd ~/bar-app

# Provjeri da li postoji .env.local
ls -la .env.local

# Provjeri sadržaj .env.local (pazi, sadrži osjetljive podatke!)
cat .env.local

# Provjeri da li PM2 vidi environment variables
pm2 env 0
```

## Potrebne environment variables:

```env
DATABASE_URL=postgresql://postgres:PASSWORD@localhost:5432/office_app
JWT_SECRET=your-secret-key-here
NODE_ENV=production
PORT=3001
```

## Ako .env.local ne postoji ili nije postavljen:

1. Kreiraj `.env.local`:
```bash
cd ~/bar-app
nano .env.local
```

2. Dodaj potrebne varijable (vidi gore)

3. Restartuj PM2 da učita nove environment variables:
```bash
pm2 restart office-app --update-env
```

## Ako DATABASE_URL nije postavljen:

Trebamo ga postaviti. Za lokalnu PostgreSQL bazu na serveru:
```bash
# Format: postgresql://username:password@host:port/database
DATABASE_URL=postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/office_app
```

## Provjera da li PostgreSQL radi:

```bash
# Provjeri status PostgreSQL servisa
sudo systemctl status postgresql

# Provjeri da li možemo se povezati
sudo -u postgres psql -d office_app -c "SELECT NOW();"
```

