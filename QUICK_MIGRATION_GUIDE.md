# Brza migracija - SSH koraci

## ✅ Korak 1: Završeno! 
Fajl je već kopiran na server.

## 🔄 Korak 2: Poveži se na server

Otvori novi PowerShell prozor i pokreni:

```bash
ssh root@46.224.115.49
```

Unesi password kada te pita.

## 🔄 Korak 3: Na serveru, pokreni migraciju

Nakon što si se povezao na server (vidjet ćeš prompt kao `root@server:~#`), pokreni:

```bash
psql -U postgres -d office_app -f ~/migrate-users-table.sql
```

Ako pita za password, unesi password za `postgres` korisnika.

**Alternativno, ako ne znaš postgres password:**
```bash
sudo -u postgres psql -d office_app -f ~/migrate-users-table.sql
```

## ✅ Korak 4: Provjeri da li je uspjelo

Nakon što migracija završi, provjeri strukturu tabele:

```bash
psql -U postgres -d office_app -c "\d users"
```

Trebao bi vidjeti kolone uključujući `password_hash`, `role`, `is_owner`, itd.

## 🔄 Korak 5: Vrati se lokalno

Izađi sa servera:
```bash
exit
```

Onda restartuj Next.js server lokalno i testiraj login!

