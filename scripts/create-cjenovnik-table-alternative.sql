-- Alternative version using uuid_generate_v4() instead of gen_random_uuid()
-- Use this if gen_random_uuid() doesn't work

-- First ensure uuid extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create cjenovnik table if it doesn't exist
CREATE TABLE IF NOT EXISTS cjenovnik (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    naziv VARCHAR(255) NOT NULL,
    cijena DECIMAL(10, 2) NOT NULL,
    proizvodna_cijena DECIMAL(10, 2),
    zestoko_kolicina DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, naziv)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_cjenovnik_user_id ON cjenovnik(user_id);
CREATE INDEX IF NOT EXISTS idx_cjenovnik_user_naziv ON cjenovnik(user_id, naziv);

