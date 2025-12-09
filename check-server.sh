#!/bin/bash

# Server Health Check Script
# Pokrenite: bash check-server.sh

echo "🔍 Office App Server Health Check"
echo "=================================="
echo ""

# 1. Provjera PostgreSQL
echo "1️⃣  Checking PostgreSQL..."
if systemctl is-active --quiet postgresql; then
    echo "   ✅ PostgreSQL service je aktivan"
else
    echo "   ❌ PostgreSQL service nije aktivan"
    echo "   💡 Pokrenite: sudo systemctl start postgresql"
fi

# 2. Provjera da li baza postoji
echo ""
echo "2️⃣  Checking database..."
if command -v psql &> /dev/null; then
    DB_EXISTS=$(psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='office_app'" 2>/dev/null)
    if [ "$DB_EXISTS" = "1" ]; then
        echo "   ✅ Database 'office_app' postoji"
    else
        echo "   ❌ Database 'office_app' ne postoji"
        echo "   💡 Kreirajte: sudo -u postgres psql -c \"CREATE DATABASE office_app;\""
    fi
else
    echo "   ⚠️  psql nije dostupan"
fi

# 3. Provjera .env.local
echo ""
echo "3️⃣  Checking environment file..."
if [ -f .env.local ]; then
    echo "   ✅ .env.local postoji"
    
    # Provjera da li su kritične varijable postavljene
    if grep -q "change_this_password" .env.local; then
        echo "   ⚠️  DB_PASSWORD još nije promijenjen!"
    fi
    if grep -q "change-this-to-a-random-secret" .env.local; then
        echo "   ⚠️  JWT_SECRET još nije promijenjen!"
    fi
else
    echo "   ❌ .env.local ne postoji"
    echo "   💡 Pokrenite: bash setup-server.sh"
fi

# 4. Provjera node_modules
echo ""
echo "4️⃣  Checking dependencies..."
if [ -d "node_modules" ]; then
    echo "   ✅ node_modules postoji"
else
    echo "   ❌ node_modules ne postoji"
    echo "   💡 Pokrenite: npm install"
fi

# 5. Provjera database_schema.sql
echo ""
echo "5️⃣  Checking database schema file..."
if [ -f "database_schema.sql" ]; then
    echo "   ✅ database_schema.sql postoji"
else
    echo "   ❌ database_schema.sql ne postoji"
fi

# 6. Provjera porta 3000
echo ""
echo "6️⃣  Checking port 3000..."
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "   ⚠️  Port 3000 je već u upotrebi"
    echo "   💡 Možda je aplikacija već pokrenuta"
else
    echo "   ✅ Port 3000 je slobodan"
fi

echo ""
echo "=================================="
echo "✅ Health check završen!"
echo ""


