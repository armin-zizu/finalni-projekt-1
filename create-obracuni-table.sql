-- Provjeri i kreiraj tabelu obracuni ako ne postoji
-- Ovo osigurava da tabela ima sve potrebne kolone

CREATE TABLE IF NOT EXISTS obracuni (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  datum VARCHAR(50) NOT NULL, -- Format: "DD.MM.YYYY"
  artikli JSONB NOT NULL DEFAULT '{}', -- Array artikala sa svim detaljima
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, datum)
);

-- Ako tabela postoji ali nema kolonu artikli, dodaj je
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'obracuni' AND column_name = 'artikli'
    ) THEN
        ALTER TABLE obracuni ADD COLUMN artikli JSONB NOT NULL DEFAULT '{}';
        RAISE NOTICE 'Dodana kolona artikli u tabelu obracuni';
    ELSE
        RAISE NOTICE 'Kolona artikli već postoji u tabeli obracuni';
    END IF;
END $$;

-- Kreiraj index ako ne postoji
CREATE INDEX IF NOT EXISTS idx_obracuni_user_id ON obracuni(user_id);
CREATE INDEX IF NOT EXISTS idx_obracuni_datum ON obracuni(datum);

-- Provjeri strukturu
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'obracuni' 
ORDER BY ordinal_position;

