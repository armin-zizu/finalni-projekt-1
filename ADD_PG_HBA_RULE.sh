#!/bin/bash
# Skripta za dodavanje remote pristupa u pg_hba.conf

echo "Dodajem pravilo za remote pristup..."

# Dodaj pravilo na kraj fajla
echo "host    all             all             0.0.0.0/0               md5" | sudo tee -a /etc/postgresql/16/main/pg_hba.conf

echo "Pravilo dodano! Restartuj PostgreSQL:"
echo "sudo systemctl restart postgresql"

