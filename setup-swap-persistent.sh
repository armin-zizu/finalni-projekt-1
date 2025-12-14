#!/bin/bash

# Skripta za kreiranje i postavljanje persistent swap fajla

echo "=== Kreiranje Persistent Swap Fajla ==="

# Provjeri da li swap već postoji
if swapon --show | grep -q /swapfile; then
    echo "✅ Swap fajl već postoji i aktiviran je"
    swapon --show
else
    echo "📦 Kreiranje 2GB swap fajla..."
    
    # Kreiraj swap fajl (2GB)
    sudo fallocate -l 2G /swapfile
    
    # Postavi dozvole
    sudo chmod 600 /swapfile
    
    # Formatiraj kao swap
    sudo mkswap /swapfile
    
    # Aktiviraj swap
    sudo swapon /swapfile
    
    echo "✅ Swap fajl kreiran i aktiviran"
fi

# Provjeri da li je već u /etc/fstab
if grep -q "/swapfile" /etc/fstab; then
    echo "✅ Swap je već dodan u /etc/fstab"
else
    echo "📝 Dodavanje swap-a u /etc/fstab..."
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo "✅ Swap dodan u /etc/fstab"
fi

# Provjeri status
echo ""
echo "=== Trenutno stanje ==="
echo "Memorija:"
free -h
echo ""
echo "Aktivni swap:"
swapon --show
echo ""
echo "Provjera /etc/fstab:"
grep swapfile /etc/fstab || echo "Swap nije u /etc/fstab"

echo ""
echo "✅ Gotovo! Swap će se automatski aktivirati nakon restart-a servera."

