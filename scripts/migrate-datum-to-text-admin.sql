-- Migracija: Promena tipa kolone 'datum' iz 'date' u 'text'
-- Ovo omogućava čuvanje datuma u formatu DD.MM.YYYY umesto YYYY-MM-DD
-- 
-- VAŽNO: Ova migracija mora biti pokrenuta od strane administratora baze (owner tabele)
-- 
-- Uputstvo:
-- 1. Povezite se na PostgreSQL server kao administrator (postgres user ili owner tabele)
-- 2. Povezite se na bazu: \c office_app (ili vaša baza)
-- 3. Pokrenite ovu skriptu: \i scripts/migrate-datum-to-text-admin.sql
-- 
-- ILI preko psql komandne linije:
-- psql -h hostname -U postgres -d office_app -f scripts/migrate-datum-to-text-admin.sql

BEGIN;

-- 1. Prvo, konvertujemo postojeće datume u DD.MM.YYYY format u datum_raw kolonu (ako postoji)
-- Ovo je opciono - samo ako želite da sačuvate originalne datume u datum_raw
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'obracuni' AND column_name = 'datum_raw') THEN
        UPDATE obracuni 
        SET datum_raw = TO_CHAR(datum, 'DD.MM.YYYY')
        WHERE datum_raw IS NULL OR datum_raw = '';
        RAISE NOTICE 'Postojeći datumi konvertovani u datum_raw kolonu';
    END IF;
END $$;

-- 2. Promenimo tip kolone 'datum' iz 'date' u 'text'
-- Koristimo ALTER COLUMN sa USING klauzulom za konverziju postojećih vrednosti
ALTER TABLE obracuni 
ALTER COLUMN datum TYPE text USING TO_CHAR(datum, 'DD.MM.YYYY');

-- 3. Proveri rezultat
DO $$
DECLARE
    datum_type text;
BEGIN
    SELECT data_type INTO datum_type
    FROM information_schema.columns
    WHERE table_name = 'obracuni' AND column_name = 'datum';
    
    IF datum_type = 'text' THEN
        RAISE NOTICE '✅ Migracija uspešna! Kolona datum je sada tipa: %', datum_type;
    ELSE
        RAISE EXCEPTION '❌ Migracija neuspešna! Kolona datum je tipa: %', datum_type;
    END IF;
END $$;

COMMIT;

-- Provera: Prikaži prvih 5 obračuna sa novim formatom datuma
SELECT id, datum, user_id, saved_at 
FROM obracuni 
ORDER BY TO_DATE(datum, 'DD.MM.YYYY') DESC NULLS LAST 
LIMIT 5;

