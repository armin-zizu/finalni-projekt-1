#!/bin/bash
# Dodaj listen_addresses na kraj postgresql.conf

echo "Provjeravam postgresql.conf..."

# Provjeri da li već postoji
if sudo grep -q "^listen_addresses" /etc/postgresql/16/main/postgresql.conf; then
    echo "listen_addresses već postoji, mijenjam ga..."
    sudo sed -i "s/^#*listen_addresses.*/listen_addresses = '*'/" /etc/postgresql/16/main/postgresql.conf
else
    echo "listen_addresses ne postoji, dodajem ga..."
    echo "" | sudo tee -a /etc/postgresql/16/main/postgresql.conf
    echo "# Added for remote connections" | sudo tee -a /etc/postgresql/16/main/postgresql.conf
    echo "listen_addresses = '*'" | sudo tee -a /etc/postgresql/16/main/postgresql.conf
fi

echo "Provjeravam izmjene..."
sudo grep "listen_addresses" /etc/postgresql/16/main/postgresql.conf

echo ""
echo "Restartuj PostgreSQL:"
echo "sudo service postgresql restart"

