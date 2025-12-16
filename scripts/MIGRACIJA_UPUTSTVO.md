# Uputstvo za migraciju kolone 'datum' u tabeli 'obracuni'

## Problem
Trenutno kolona `datum` je tipa `date` (YYYY-MM-DD format), ali aplikacija koristi format `DD.MM.YYYY`. 
Migracija menja tip kolone u `text` kako bi se mogao čuvati datum u formatu `DD.MM.YYYY`.

## Rešenje

### Opcija 1: Preko psql komandne linije (preporučeno)

1. Povežite se na PostgreSQL server kao administrator:
```bash
psql -h 46.224.115.49 -U postgres -d office_app
```
(Ili koristite vaš username ako niste postgres)

2. Pokrenite SQL skriptu:
```bash
\i scripts/migrate-datum-to-text-admin.sql
```

ILI direktno:
```bash
psql -h 46.224.115.49 -U postgres -d office_app -f scripts/migrate-datum-to-text-admin.sql
```

### Opcija 2: Kopiraj i nalepi SQL direktno u psql

1. Otvori fajl `scripts/migrate-datum-to-text-admin.sql`
2. Kopiraj ceo sadržaj
3. Poveži se na bazu: `psql -h 46.224.115.49 -U postgres -d office_app`
4. Nalepi SQL kod i pritisni Enter

### Opcija 3: Preko pgAdmin ili drugog SQL klijenta

1. Poveži se na bazu kao administrator
2. Otvori Query Tool
3. Otvori fajl `scripts/migrate-datum-to-text-admin.sql`
4. Pokreni skriptu (F5 ili Execute)

## Šta migracija radi:

1. ✅ Konvertuje postojeće datume iz `date` tipa u `text` tip u formatu `DD.MM.YYYY`
2. ✅ Menja tip kolone `datum` iz `date` u `text`
3. ✅ Sve je u transakciji - ako nešto padne, vratiće se na staro stanje
4. ✅ Na kraju prikazuje prvih 5 obračuna za proveru

## Posle migracije:

- API kod je već ažuriran da koristi format `DD.MM.YYYY` bez konverzije
- Nema potrebe za dalje izmene u kodu
- Testirajte spremanje obračuna da proverite da sve radi

## Rollback (ako treba da se vrati nazad):

```sql
BEGIN;
ALTER TABLE obracuni 
ALTER COLUMN datum TYPE date USING TO_DATE(datum, 'DD.MM.YYYY');
COMMIT;
```

