#!/bin/bash
# Quick deploy script - pokreni na serveru
# Korak po korak deploy

set -e

APP_DIR="$HOME/bar-app"
REPO_URL=""  # Dodaj svoj GitHub URL ovdje

echo "🚀 Starting deployment..."

# Check if directory exists
if [ -d "$APP_DIR" ]; then
    echo "📁 Directory exists, pulling latest changes..."
    cd "$APP_DIR"
    git pull origin main || git pull origin master
else
    echo "📁 Creating directory and cloning..."
    mkdir -p "$APP_DIR"
    cd "$APP_DIR"
    
    if [ -z "$REPO_URL" ]; then
        echo "⚠️  REPO_URL not set! Using current directory..."
        echo "Please copy files manually or set REPO_URL in script"
    else
        git clone "$REPO_URL" .
    fi
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check .env.local
if [ ! -f ".env.local" ]; then
    echo "⚠️  Creating .env.local..."
    cat > .env.local << EOF
DATABASE_URL=postgresql://office_user:Jasamkonj12_@localhost:5432/office_app
JWT_SECRET=$(openssl rand -base64 32)
NODE_ENV=production
EOF
    echo "✅ .env.local created! Please review and update if needed."
fi

# Build
echo "🔨 Building application..."
npm run build

echo "✅ Build completed!"
echo ""
echo "To start the application:"
echo "  pm2 start npm --name 'office-app' -- start"
echo "  pm2 save"
echo ""
echo "Or for development:"
echo "  pm2 start npm --name 'office-app-dev' -- run dev"

