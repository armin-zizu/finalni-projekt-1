#!/bin/bash
# Kreiraj .env.local fajl direktno preko komande
# Na serveru pokreni: bash CREATE_ENV_FILE.sh

# Provjeri da li JWT_SECRET treba generirati
if [ -z "$1" ]; then
    echo "Generating JWT_SECRET..."
    JWT_SECRET=$(openssl rand -base64 32)
else
    JWT_SECRET="$1"
fi

cat > .env.local << EOF
DATABASE_URL=postgresql://office_user:Jasamkonj12_@localhost:5432/office_app
JWT_SECRET=$JWT_SECRET
NODE_ENV=production
EOF

echo "✅ .env.local created!"
echo "JWT_SECRET: $JWT_SECRET"
echo ""
echo "To edit later: nano .env.local"

