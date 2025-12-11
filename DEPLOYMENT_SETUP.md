# 🚀 Automatski Deployment Setup

Ovaj dokument objašnjava kako postaviti automatski deployment na Hetzner server preko GitHub Actions.

## 📋 Preduslovi

1. GitHub repository sa kodom
2. Hetzner server sa SSH pristupom
3. Git repository na serveru (initializovan i povezan sa GitHub-om)

## 🔑 Korak 1: Generisanje SSH ključa (ako nemate)

Na serveru:

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions_deploy
cat ~/.ssh/github_actions_deploy.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/github_actions_deploy  # Kopirajte privatni ključ
```

## 🔐 Korak 2: Postavljanje GitHub Secrets

Idite na GitHub repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Dodajte sljedeće secrets:

1. **HETZNER_SSH_PRIVATE_KEY**
   - Vrijednost: Privatni SSH ključ (cijeli sadržaj, uključujući `-----BEGIN OPENSSH PRIVATE KEY-----` i `-----END OPENSSH PRIVATE KEY-----`)

2. **HETZNER_SERVER_IP**
   - Vrijednost: IP adresa servera (npr. `46.224.115.49`)

3. **HETZNER_SERVER_USER**
   - Vrijednost: SSH korisničko ime (npr. `armin`)

4. **HETZNER_APP_DIR** (opcionalno)
   - Vrijednost: Putanja do aplikacije na serveru (npr. `~/bar-app` ili `~/office-app`)
   - Ako nije postavljeno, workflow će probati obje putanje

## 🔧 Korak 3: Setup na serveru

### Opcija A: PM2 (preporučeno za production)

```bash
# Instaliraj PM2 globalno
npm install -g pm2

# Pokreni aplikaciju sa PM2
cd ~/bar-app  # ili ~/office-app
npm install
npm run build
pm2 start npm --name "office-app" -- start

# Spremi PM2 konfiguraciju
pm2 save
pm2 startup  # Slijedite instrukcije za auto-start na boot
```

### Opcija B: Systemd service

Kreirajte `/etc/systemd/system/office-app.service`:

```ini
[Unit]
Description=Office App Next.js
After=network.target

[Service]
Type=simple
User=armin
WorkingDirectory=/home/armin/bar-app
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Zatim:

```bash
sudo systemctl daemon-reload
sudo systemctl enable office-app
sudo systemctl start office-app
```

## ✅ Korak 4: Testiranje

1. Napravite commit i push na `main` branch:

```bash
git add .
git commit -m "Test deployment"
git push origin main
```

2. Idite na GitHub → **Actions** tab i provjerite da li workflow radi

3. Provjerite server:

```bash
ssh armin@46.224.115.49
pm2 status  # ili systemctl status office-app
```

## 🐛 Troubleshooting

### SSH connection failed
- Provjerite da li je SSH ključ pravilno kopiran u GitHub Secrets
- Provjerite da li je server IP tačan
- Provjerite firewall na serveru (port 22 mora biti otvoren)

### Permission denied
- Provjerite da li SSH ključ ima pravo pristupa
- Provjerite da li korisnik ima prava na folder aplikacije

### Build failed
- Provjerite da li postoje sve environment varijable u `.env.local` na serveru
- Provjerite da li postoje sve dependencies u `package.json`

### PM2 not restarting
- Provjerite da li je PM2 instaliran: `which pm2`
- Provjerite PM2 status: `pm2 list`
- Ručno restart: `pm2 restart office-app`

## 📝 Napomene

- Workflow se pokreće automatski na svaki push na `main` branch
- Možete ručno pokrenuti workflow iz GitHub Actions tab-a (workflow_dispatch)
- Ako koristite custom port ili path, ažurirajte workflow fajl

