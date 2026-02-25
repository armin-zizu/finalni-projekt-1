# ============================================
# Quick Recovery Script - Admin Device Approval (PowerShell)
# ============================================
# Ova skripta automatski odobrava sve uređaje za admin korisnika
#
# Usage: .\scripts\quick-recovery.ps1
# ============================================

# PostgreSQL konfiguracija
$DB_HOST = if ($env:DB_HOST) { $env:DB_HOST } else { "localhost" }
$DB_USER = if ($env:DB_USER) { $env:DB_USER } else { "office_user" }
$DB_NAME = if ($env:DB_NAME) { $env:DB_NAME } else { "office_app" }
$ADMIN_EMAIL = if ($env:ADMIN_EMAIL) { $env:ADMIN_EMAIL } else { "gitara.zizu@gmail.com" }

Write-Host "🔐 Recovery Script - Admin Device Approval" -ForegroundColor Yellow
Write-Host "=========================================="
Write-Host "Database: $DB_NAME"
Write-Host "Admin Email: $ADMIN_EMAIL"
Write-Host "=========================================="
Write-Host ""

# Provjeri da li je psql instaliran
try {
    $null = Get-Command psql -ErrorAction Stop
} catch {
    Write-Host "❌ psql nije instaliran!" -ForegroundColor Red
    Write-Host "Molimo instalirajte PostgreSQL client:"
    Write-Host "  Windows: Instalirajte PostgreSQL sa https://www.postgresql.org/download/"
    Write-Host "  ILI koristite: winget install PostgreSQL.PostgreSQL"
    exit 1
}

# Traži lozinku
$securePassword = Read-Host "Unesite lozinku za bazu podataka" -AsSecureString
$DB_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
)
$env:PGPASSWORD = $DB_PASSWORD

Write-Host ""
Write-Host "🔄 Povezivanje na bazu podataka..." -ForegroundColor Yellow

# Test konekcije
$testQuery = "SELECT 1;"
try {
    $null = psql -h $DB_HOST -U $DB_USER -d $DB_NAME -t -c $testQuery 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Connection failed"
    }
    Write-Host "✅ Uspješna konekcija na bazu podataka" -ForegroundColor Green
} catch {
    Write-Host "❌ Neuspješna konekcija na bazu podataka!" -ForegroundColor Red
    Write-Host "Provjerite:"
    Write-Host "  - Host: $DB_HOST"
    Write-Host "  - Username: $DB_USER"
    Write-Host "  - Database: $DB_NAME"
    Write-Host "  - Lozinka"
    exit 1
}

Write-Host ""
Write-Host "🔄 Odobravanje uređaja..." -ForegroundColor Yellow

# SQL komande
$sqlScript = @"
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
"@

# Pokreni SQL
$sqlScript | psql -h $DB_HOST -U $DB_USER -d $DB_NAME

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Uspješno završeno!" -ForegroundColor Green
    Write-Host "Sada se možete prijaviti u aplikaciju sa bilo kojeg uređaja." -ForegroundColor Green
} else {
    Write-Host "❌ Greška pri izvršavanju SQL komandi!" -ForegroundColor Red
    exit 1
}

# Očisti lozinku iz memorije
$DB_PASSWORD = $null
$env:PGPASSWORD = $null

