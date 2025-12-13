-- Provjeri strukturu obracuni tabele i dodaj artikli JSONB kolonu ako ne postoji
-- Tabela obracuni trenutno ima strukturu sa odvojenim tabelama za artikle,
-- ali API očekuje JSONB artikli kolonu

BEGIN;

-- Provjeri da li kolona artikli postoji
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'obracuni' AND column_name = 'artikli'
    ) THEN
        -- Dodaj artikli JSONB kolonu
        ALTER TABLE obracuni ADD COLUMN artikli JSONB DEFAULT '{}';
        RAISE NOTICE 'Dodana kolona artikli u tabelu obracuni';
        
        -- Migriraj postojeće podatke iz odvojenih tabela u JSONB
        -- Ovo će popuniti artikli kolonu sa podacima iz obracun_artikli, obracun_rashodi, obracun_prihodi
        UPDATE obracuni o
        SET artikli = jsonb_build_object(
            'artikli', COALESCE(
                (SELECT jsonb_agg(jsonb_build_object(
                    'naziv', oa.naziv,
                    'cijena', oa.cijena,
                    'kolicina', oa.kolicina,
                    'pocetnoStanje', oa.pocetno_stanje,
                    'ulaz', oa.ulaz,
                    'utroseno', oa.utroseno,
                    'krajnjeStanje', oa.krajnje_stanje,
                    'vrijednostKM', oa.vrijednost_km
                )) FROM obracun_artikli oa WHERE oa.obracun_id = o.id),
                '[]'::jsonb
            ),
            'rashodi', COALESCE(
                (SELECT jsonb_agg(jsonb_build_object(
                    'naziv', or_.naziv,
                    'cijena', or_.cijena,
                    'placeno', COALESCE(or_.placeno, false)
                )) FROM obracun_rashodi or_ WHERE or_.obracun_id = o.id),
                '[]'::jsonb
            ),
            'prihodi', COALESCE(
                (SELECT jsonb_agg(jsonb_build_object(
                    'naziv', op.naziv,
                    'cijena', op.cijena
                )) FROM obracun_prihodi op WHERE op.obracun_id = o.id),
                '[]'::jsonb
            ),
            'ukupnoArtikli', COALESCE(o.ukupno_artikli, 0),
            'ukupnoRashod', COALESCE(o.ukupno_rashod, 0),
            'ukupnoPrihod', COALESCE(o.ukupno_prihod, 0),
            'neto', COALESCE(o.neto, 0),
            'isAzuriran', COALESCE(o.is_azuriran, false),
            'imaUlaz', COALESCE(o.ima_ulaz, false)
        )
        WHERE EXISTS (SELECT 1 FROM obracun_artikli oa WHERE oa.obracun_id = o.id)
           OR EXISTS (SELECT 1 FROM obracun_rashodi or_ WHERE or_.obracun_id = o.id)
           OR EXISTS (SELECT 1 FROM obracun_prihodi op WHERE op.obracun_id = o.id);
        
        RAISE NOTICE 'Migrirani postojeći podaci u artikli JSONB kolonu';
        
        -- Za obracune bez podataka, postavi default prazan objekt
        UPDATE obracuni
        SET artikli = jsonb_build_object(
            'artikli', '[]'::jsonb,
            'rashodi', '[]'::jsonb,
            'prihodi', '[]'::jsonb,
            'ukupnoArtikli', COALESCE(ukupno_artikli, 0),
            'ukupnoRashod', COALESCE(ukupno_rashod, 0),
            'ukupnoPrihod', COALESCE(ukupno_prihod, 0),
            'neto', COALESCE(neto, 0),
            'isAzuriran', COALESCE(is_azuriran, false),
            'imaUlaz', COALESCE(ima_ulaz, false)
        )
        WHERE artikli IS NULL OR artikli = '{}'::jsonb;
        
    ELSE
        RAISE NOTICE 'Kolona artikli već postoji';
    END IF;
END $$;

-- Provjeri strukturu
SELECT 
    column_name, 
    data_type
FROM information_schema.columns 
WHERE table_name = 'obracuni' 
ORDER BY ordinal_position;

COMMIT;

