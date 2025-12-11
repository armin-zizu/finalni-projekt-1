# 🚀 Konekcija Lokalnog Cursor-a na Server Bazu

## Opcija 1: Koristi Remote Server Bazu (Najjednostavnije!)

### Korak 1: Omogući Remote Pristup PostgreSQL-u na Serveru

Na serveru, uredi PostgreSQL konfiguraciju:

```bash
# SSH na server
ssh armin@46.224.115.49

# Uredi pg_hba.conf
sudo nano /etc/postgresql/16/main/pg_hba.conf
# Ili možda: sudo nano /etc/postgresql/15/main/pg_hba.conf
```

**Dodaj ove linije (za IPv4):**
```
host    all             all             0.0.0.0/0               md5
```

**Ili samo za tvoju IP adresu (sigurnije):**
```
host    all             all             TvojaIPAdresa/32       md5
```

**Uredi postgresql.conf:**
```bash
sudo nano /etc/postgresql/16/main/postgresql.conf
```

**Pronađi i promijeni:**
```
listen_addresses = '*'  # Umjesto 'localhost'
```

**Restart PostgreSQL:**
```bash
sudo systemctl restart postgresql
```

**Provjeri firewall:**
```bash
sudo ufw allow 5432/tcp
sudo ufw status
```

### Korak 2: Podesi .env.local Lokalno

U `.env.local` u Cursor-u (na tvom laptopu):

```env
# Remote Server Database
DB_HOST=46.224.115.49
DB_PORT=5432
DB_NAME=office_app
DB_USER=office_user
DB_PASSWORD=Jasamkonj12_
JWT_SECRET=your_jwt_secret_here_minimum_32_characters_long
NODE_ENV=development
```

### Korak 3: Pokreni Lokalno

```powershell
npm run dev
```

**Otvori:** `http://localhost:3000`

## Opcija 2: Rad na Serveru Direktno (Još Jednostavnije!)

Ako ne želiš da otvaraš PostgreSQL za remote pristup, možeš jednostavno raditi na serveru:

### Workflow:

1. **Radiš lokalno u Cursoru** (bilo koji kod, bez baze)
2. **Testiraš na serveru:**
   ```bash
   git add .
   git commit -m "Promjene"
   git push origin main
   ```
3. **Na serveru:**
   ```bash
   git pull origin main
   npm run dev -- --hostname 0.0.0.0
   ```
4. **Gledaš live:** `http://46.224.115.49:3000`

**Ili koristi GitHub Actions** za automatski deployment!

## Preporuka

**Za development:** Opcija 1 (remote baza) - brže, sve radi lokalno  
**Za testiranje:** Opcija 2 (push na server) - sigurnije, testiraš na produkciji

