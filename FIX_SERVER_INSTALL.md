# Fix npm install na serveru

## Problem
`dataconnect-generated` folder nedostaje - to je Firebase dependency koji više nije potreban.

## ✅ Rješenje

**Na serveru pokreni:**

```bash
# 1. Povuci najnovije promjene sa GitHub-a
cd ~/bar-app
git pull origin main

# 2. Instaliraj dependencies (sada bi trebalo raditi)
npm install

# 3. Kreiraj .env.local (ako još nisi)
JWT_SECRET=$(openssl rand -base64 32)

cat > .env.local << EOF
DATABASE_URL=postgresql://office_user:Jasamkonj12_@localhost:5432/office_app
JWT_SECRET=$JWT_SECRET
NODE_ENV=production
EOF

# 4. Build aplikacije
npm run build

# 5. Pokreni sa PM2
pm2 start npm --name "office-app" -- start
pm2 save
```

## Alternativa (ako git pull ne radi):

```bash
# Privremeno - kreiraj prazan folder dok ne pull-uješ
mkdir -p src/dataconnect-generated
echo '{"name":"@dataconnect/generated","version":"1.0.0"}' > src/dataconnect-generated/package.json
npm install
```

Ali bolje je koristiti `git pull` jer sam uklonio dependency!

