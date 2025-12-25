#!/bin/bash

# ============================================
# Quick Recovery Script - Admin Device Approval
# ============================================
# Ova skripta automatski odobrava sve uređaje za admin korisnika
#
# Usage: ./scripts/quick-recovery.sh
# ILI: bash scripts/quick-recovery.sh
# ============================================

# Boje za output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# PostgreSQL konfiguracija (podesite prema vašim podacima)
DB_HOST="${DB_HOST:-46.224.115.49}"
DB_USER="${DB_USER:-office_user}"
DB_NAME="${DB_NAME:-office_app}"
ADMIN_EMAIL="${ADMIN_EMAIL:-gitara.zizu@gmail.com}"

echo -e "${YELLOW}🔐 Recovery Script - Admin Device Approval${NC}"
echo "=========================================="
echo "Database: $DB_NAME"
echo "Admin Email: $ADMIN_EMAIL"
echo "=========================================="
echo ""

# Provjeri da li je psql instaliran
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ psql nije instaliran!${NC}"
    echo "Molimo instalirajte PostgreSQL client:"
    echo "  Ubuntu/Debian: sudo apt-get install postgresql-client"
    echo "  macOS: brew install postgresql"
    echo "  Windows: Instalirajte PostgreSQL sa https://www.postgresql.org/download/"
    exit 1
fi

# Traži lozinku (ne prikazuje je)
echo -n "Unesite lozinku za bazu podataka: "
read -s DB_PASSWORD
echo ""
echo ""

# Pokušaj konekcije
echo -e "${YELLOW}🔄 Povezivanje na bazu podataka...${NC}"

PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c "
SELECT 1;
" > /dev/null 2>&1

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Neuspješna konekcija na bazu podataka!${NC}"
    echo "Provjerite:"
    echo "  - Host: $DB_HOST"
    echo "  - Username: $DB_USER"
    echo "  - Database: $DB_NAME"
    echo "  - Lozinka"
    exit 1
fi

echo -e "${GREEN}✅ Uspješna konekcija na bazu podataka${NC}"
echo ""

# Izvrši SQL komande
echo -e "${YELLOW}🔄 Odobravanje uređaja...${NC}"

PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" <<EOF
BEGIN;

-- Postavi is_owner i role za admin korisnika
UPDATE users
SET is_owner = TRUE,
    role = 'vlasnik',
    updated_at = NOW()
WHERE LOWER(email) = LOWER('$ADMIN_EMAIL');

-- Odobri sve uređaje
UPDATE devices
SET status = 'approved',
    role = 'vlasnik',
    is_blocked = FALSE,
    permissions = '{
        "dashboard": true,
        "obracun": true,
        "arhiva": true,
        "cjenovnik": true,
        "profit": true,
        "profile": true,
        "admin": true
    }'::jsonb,
    updated_at = NOW()
WHERE user_id = (SELECT id FROM users WHERE LOWER(email) = LOWER('$ADMIN_EMAIL'))
  AND (
      status IS NULL OR
      status != 'approved' OR
      role IS NULL OR
      role != 'vlasnik' OR
      is_blocked = TRUE
  );

COMMIT;

-- Prikaži rezultate
\echo ''
\echo '✅ Rezultati:'
\echo ''

SELECT 
    d.device_id,
    d.device_name,
    d.status,
    d.role,
    d.is_blocked
FROM devices d
INNER JOIN users u ON d.user_id = u.id
WHERE LOWER(u.email) = LOWER('$ADMIN_EMAIL')
ORDER BY d.created_at DESC;
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Uspješno završeno!${NC}"
    echo -e "${GREEN}Sada se možete prijaviti u aplikaciju sa bilo kojeg uređaja.${NC}"
else
    echo -e "${RED}❌ Greška pri izvršavanju SQL komandi!${NC}"
    exit 1
fi

