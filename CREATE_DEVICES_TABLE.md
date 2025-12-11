# Kreiranje devices tabele

## Problem
Tabela `devices` ne postoji u bazi podataka, što uzrokuje 500 grešku pri pokušaju pristupa uređajima.

## Rješenje

Kreiraj `devices` tabelu na serveru.

### Korak 1: Kopiraj SQL fajl na server

Na lokalnom računaru:
```bash
scp create-devices-table.sql root@46.224.115.49:~/
```

### Korak 2: Poveži se na server

```bash
ssh root@46.224.115.49
```

### Korak 3: Pokreni SQL skriptu

Na serveru:
```bash
sudo -u postgres psql -d office_app -f ~/create-devices-table.sql
```

Ili direktno u psql:
```bash
sudo -u postgres psql -d office_app
```

Zatim kopiraj i pokreni sadržaj `create-devices-table.sql`.

### Korak 4: Provjeri rezultat

```sql
\d devices
```

Ili:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'devices' 
ORDER BY ordinal_position;
```

### Korak 5: Vrati se lokalno i testiraj

1. Izađi sa servera: `exit`
2. Restartuj Next.js server (ako je potrebno)
3. Pokušaj login ponovo

Nakon toga bi trebalo raditi bez grešaka!

