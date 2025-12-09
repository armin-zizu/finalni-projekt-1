#!/bin/bash

# Server Setup Script za Office App
# Pokrenite ovaj script na serveru: bash setup-server.sh

echo "🚀 Starting Office App Server Setup..."

# Provjera da li je PostgreSQL instaliran
echo "📦 Checking PostgreSQL..."
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL nije instaliran. Instalirajte ga prvo:"
    echo "   sudo apt update"
    echo "   sudo apt install postgresql postgresql-contrib"
    exit 1
fi

echo "✅ PostgreSQL je instaliran"

# Provjera da li je Node.js instaliran
echo "📦 Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js nije instaliran. Instalirajte ga prvo:"
    echo "   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
    echo "   sudo apt-get install -y nodejs"
    exit 1
fi

echo "✅ Node.js $(node --version) je instaliran"

# Provjera npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm nije instaliran"
    exit 1
fi

echo "✅ npm $(npm --version) je instaliran"

# Kreiranje .env.local fajla ako ne postoji
if [ ! -f .env.local ]; then
    echo "📝 Creating .env.local file..."
    cat > .env.local << 'EOF'
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=office_app
DB_USER=office_user
DB_PASSWORD=change_this_password

# JWT Configuration
JWT_SECRET=change-this-to-a-random-secret-minimum-32-characters-long
JWT_EXPIRES_IN=7d

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000/api

# Environment
NODE_ENV=development

# File Upload Configuration
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
EOF
    echo "✅ .env.local kreiran - MOLIMO IZMJENITE PASSWORD I JWT_SECRET!"
else
    echo "✅ .env.local već postoji"
fi

# Instalacija npm paketa
echo "📦 Installing npm packages..."
npm install

echo ""
echo "✅ Setup završen!"
echo ""
echo "📋 Sljedeći koraci:"
echo "1. Otvorite .env.local i promijenite:"
echo "   - DB_PASSWORD (vaš PostgreSQL password)"
echo "   - JWT_SECRET (random string, minimalno 32 karaktera)"
echo ""
echo "2. Kreirajte bazu podataka:"
echo "   sudo -u postgres psql"
echo "   CREATE DATABASE office_app;"
echo "   CREATE USER office_user WITH ENCRYPTED PASSWORD 'your_password';"
echo "   GRANT ALL PRIVILEGES ON DATABASE office_app TO office_user;"
echo "   \\q"
echo ""
echo "3. Importujte database schema:"
echo "   psql -U office_user -d office_app -f database_schema.sql"
echo ""
echo "4. Testirajte konekciju:"
echo "   npm run dev"
echo "   curl http://localhost:3000/api/test-db"
echo ""


