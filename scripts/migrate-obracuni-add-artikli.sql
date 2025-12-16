-- Migracija: Dodavanje kolone 'artikli' JSONB u tabelu 'obracuni'
-- Ovo omogućava čuvanje detaljnih podataka o artiklima u obračunu

BEGIN;

-- Dodaj kolonu 'artikli' kao JSONB (mogu biti null za postojeće zapise)
ALTER TABLE obracuni 
ADD COLUMN IF NOT EXISTS artikli JSONB;

-- Komentar za dokumentaciju
COMMENT ON COLUMN obracuni.artikli IS 'JSONB polje sa detaljnim podacima o artiklima, rashodima i prihodima';

COMMIT;

-- Provera: Prikaži strukturu tabele nakon migracije
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns
WHERE table_name = 'obracuni'
ORDER BY ordinal_position;

