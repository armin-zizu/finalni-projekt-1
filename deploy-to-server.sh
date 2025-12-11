#!/bin/bash
# Deploy script za Hetzner server
# Pokreni na serveru: bash deploy-to-server.sh

set -e

echo "🚀 Starting deployment..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Are you in the project directory?"
    exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    exit 1
fi

echo -e "${GREEN}✅ Node.js version:$(node --version)${NC}"

# Install/update dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install

# Build the application
echo -e "${YELLOW}🔨 Building application...${NC}"
npm run build

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo -e "${YELLOW}⚠️  .env.local not found! Creating from template...${NC}"
    echo "DATABASE_URL=postgresql://office_user:Jasamkonj12_@localhost:5432/office_app" > .env.local
    echo "JWT_SECRET=your-secret-key-change-this-in-production" >> .env.local
    echo "NODE_ENV=production" >> .env.local
    echo -e "${YELLOW}⚠️  Please edit .env.local with correct values!${NC}"
fi

echo -e "${GREEN}✅ Build completed!${NC}"
echo ""
echo "To start the application:"
echo "  npm start              # Start in production mode"
echo "  pm2 start npm -- start # Or use PM2 for process management"
echo ""
echo "Or for development:"
echo "  npm run dev"

