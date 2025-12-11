# PowerShell script to connect to PostgreSQL via SSH
# Run this script or follow these commands manually

Write-Host "`n🔐 Korak 1: Povezivanje na server preko SSH`n" -ForegroundColor Cyan
Write-Host "Komanda: ssh root@46.224.115.49`n" -ForegroundColor Yellow
Write-Host "Unesi password kada te pita!`n" -ForegroundColor White

# Uncomment the line below to actually run SSH (or run manually in PowerShell)
# ssh root@46.224.115.49

Write-Host "`n" -ForegroundColor Cyan
Write-Host "✅ Nakon što si se povezao na server, nastavi sa:`n" -ForegroundColor Green
Write-Host "Korak 2: sudo -u postgres psql -d office_app`n" -ForegroundColor Yellow
Write-Host "Korak 3: Pokreni SQL komande iz create-devices-simple.sql`n" -ForegroundColor Yellow

