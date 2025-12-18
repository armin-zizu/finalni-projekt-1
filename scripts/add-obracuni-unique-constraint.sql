-- Run this as postgres user: sudo -u postgres psql -d office_app -f this_file.sql
-- Or copy-paste this content when connected as postgres user
-- Adds UNIQUE constraint on (user_id, datum) to ensure only one obracun per user per date

-- Prvo proveri da li već postoji constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'obracuni_user_id_datum_unique' 
        AND conrelid = 'obracuni'::regclass
    ) THEN
        -- Ako postoje duplikati, prvo ih obriši (zadrži samo najnoviji)
        DELETE FROM obracuni a
        USING obracuni b
        WHERE a.user_id = b.user_id 
          AND a.datum = b.datum
          AND a.id < b.id;
        
        -- Dodaj UNIQUE constraint
        ALTER TABLE obracuni
        ADD CONSTRAINT obracuni_user_id_datum_unique UNIQUE (user_id, datum);
        
        RAISE NOTICE 'UNIQUE constraint added successfully';
    ELSE
        RAISE NOTICE 'UNIQUE constraint already exists';
    END IF;
END $$;


