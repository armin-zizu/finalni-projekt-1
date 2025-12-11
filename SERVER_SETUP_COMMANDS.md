# Server Setup Commands

## ✅ Već instalirano:
- Node.js v18.19.1
- npm 9.2.0
- git 2.43.0
- PM2 6.0.14

## 📋 Sljedeći koraci:

### Opcija 1: Klonirati sa GitHub-a (preporučeno)

```bash
# Kreiraj folder
mkdir -p ~/bar-app
cd ~/bar-app

# Kloniraj repo (zamijeni sa svojim GitHub URL-om)
git clone https://github.com/tvoj-username/office-app.git .

# Ili ako već imaš repo, samo pull:
git pull origin main
```

### Opcija 2: Kopirati lokalno (rsync ili scp)

Sa lokalnog računara:
```bash
# Kopiraj cijeli projekat na server
rsync -avz --exclude 'node_modules' --exclude '.next' ./ root@46.224.115.49:~/bar-app/

# Ili koristi scp:
scp -r . root@46.224.115.49:~/bar-app/
```

## Nakon što imaš kod na serveru:

### 1. Postavi environment varijable

```bash
cd ~/bar-app
nano .env.local
```

Dodaj:
```env
DATABASE_URL=postgresql://office_user:Jasamkonj12_@localhost:5432/office_app
JWT_SECRET=tvoj-siguran-random-secret-key-min-32-karaktera
NODE_ENV=production
```

### 2. Instaliraj dependencies i build

```bash
npm install
npm run build
```

### 3. Pokreni sa PM2

```bash
pm2 start npm --name "office-app" -- start
pm2 save
pm2 startup  # Za auto-start nakon restart servera
```

### 4. Provjeri status

```bash
pm2 status
pm2 logs office-app
```

## Alternativa: Development mode

Ako želiš raditi u development modu (bez build-a):
```bash
pm2 start npm --name "office-app-dev" -- run dev
```

