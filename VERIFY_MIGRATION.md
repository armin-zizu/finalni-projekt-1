# Provjera migracije - sljedeći koraci

## ✅ Migracija je uspješno završena!

Sve kolone su dodane:
- ✅ password_hash
- ✅ role
- ✅ is_owner
- ✅ permissions
- ✅ updated_at

## 🔍 Provjeri strukturu tabele

Dok si još u psql (office_app=#), pokreni:

```sql
\d users
```

Ili:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;
```

To će ti pokazati sve kolone u tabeli.

## 🚪 Izađi iz psql

```sql
\q
```

Ili samo:
```
exit
```

## 🏠 Vrati se lokalno

Na serveru:
```bash
exit
```

## 🔄 Restartuj Next.js server lokalno

Na lokalnom računaru:
1. Zaustavi server ako je pokrenut (`Ctrl+C`)
2. Pokreni: `npm run dev`

## ✅ Testiraj login

Otvori aplikaciju u browseru i pokušaj se prijaviti!

