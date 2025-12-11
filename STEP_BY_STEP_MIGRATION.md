# Korak-po-korak migracija baze podataka

## Problem
Tabela `users` nema potrebne kolone: `password_hash`, `role`, `is_owner`, `permissions`, `updated_at`.

## Rješenje: SSH pristup serveru

### Korak 1: Poveži se na server preko SSH

Otvori PowerShell ili Command Prompt i pokreni:

```bash
ssh root@46.224.115.49
```

Ili ako koristiš drugog korisnika:
```bash
ssh username@46.224.115.49
```

**Ako pita za password:** Unesi password za server.

---

### Korak 2: Navigiraj do projekta (ako je već tamo)

Ako već imaš projekt na serveru u folderu `bar-app`, idi tamo:

```bash
cd ~/bar-app
```

Ili gdje god se nalazi tvoj projekt.

---

### Korak 3: Kopiraj SQL fajl na server (ako već nije tamo)

**Opcija A:** Ako već imaš projekat na serveru sa ovim fajlom, preskoči na Korak 4.

**Opcija B:** Kopiraj fajl sa lokalnog računara na server:

Na lokalnom računaru (u novom terminalu, ne na serveru):
```bash
scp migrate-users-table.sql root@46.224.115.49:~/migrate-users-table.sql
```

---

### Korak 4: Pokreni migraciju kao PostgreSQL superuser

Na serveru, pokreni:

```bash
psql -U postgres -d office_app -f migrate-users-table.sql
```

Ako pita za password za `postgres` korisnika, unesi ga.

**Alternativno:** Ako ne znaš password za `postgres`, pokušaj:

```bash
sudo -u postgres psql -d office_app -f migrate-users-table.sql
```

Ili ako imaš drugog korisnika sa superuser pravima:
```bash
psql -U your_admin_user -d office_app -f migrate-users-table.sql
```

---

### Korak 5: Provjeri rezultat

Nakon što migracija završi, provjeri da li je uspjela:

```bash
psql -U postgres -d office_app -c "\d users"
```

Ili:

```bash
psql -U postgres -d office_app -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position;"
```

Trebalo bi vidjeti kolone: `id`, `email`, `password_hash`, `role`, `is_owner`, `permissions`, `updated_at`, itd.

---

### Korak 6: Vrati se lokalno i restartuj server

Nakon što si završio na serveru:

1. Izađi sa servera: `exit`
2. Na lokalnom računaru, restartuj Next.js dev server:
   - Zaustavi trenutni (`Ctrl+C` ako je pokrenut)
   - Pokreni ponovo: `npm run dev`
3. Pokušaj login ponovo

---

## Troubleshooting

### Problem: "command not found: psql"
**Rješenje:** PostgreSQL nije instaliran ili nije u PATH-u.
- Ubuntu/Debian: `sudo apt-get install postgresql-client`
- CentOS/RHEL: `sudo yum install postgresql`

### Problem: "permission denied for database"
**Rješenje:** Koristi superuser (`postgres`) ili dodaj prava korisniku:
```sql
GRANT ALL PRIVILEGES ON DATABASE office_app TO office_user;
ALTER USER office_user WITH SUPERUSER;  -- samo ako je potrebno
```

### Problem: "could not connect to server"
**Rješenje:** Provjeri da li je PostgreSQL server pokrenut:
```bash
sudo systemctl status postgresql
```

