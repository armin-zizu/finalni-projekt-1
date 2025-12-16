-- Migracija: Promena tipa kolone 'datum' iz 'date' u 'text'
-- Ovo omogućava čuvanje datuma u formatu DD.MM.YYYY umesto YYYY-MM-DD

-- Prvo, konvertujemo postojeće datume u DD.MM.YYYY format
-- Ako već postoje podaci u tabeli
UPDATE obracuni 
SET datum_raw = TO_CHAR(datum, 'DD.MM.YYYY')
WHERE datum_raw IS NULL OR datum_raw = '';

-- Promenimo tip kolone 'datum' iz 'date' u 'text'
-- Koristimo ALTER COLUMN sa USING klauzulom za konverziju postojećih vrednosti
ALTER TABLE obracuni 
ALTER COLUMN datum TYPE text USING TO_CHAR(datum, 'DD.MM.YYYY');

-- Sada možemo da uklonimo 'datum_raw' kolonu ako postoji i ako više nije potrebna
-- (Ostavljamo komentar, ali ne brišemo kolonu odmah u slučaju da se koristi negde)
-- ALTER TABLE obracuni DROP COLUMN IF EXISTS datum_raw;

