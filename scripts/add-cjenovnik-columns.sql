-- Run this as postgres user: sudo -u postgres psql -d office_app -f this_file.sql
-- Or copy-paste this content when connected as postgres user
-- Adds missing columns to cjenovnik table for storing all user-entered data

ALTER TABLE cjenovnik 
ADD COLUMN IF NOT EXISTS nabavna_cijena DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS nabavna_cijena_flase DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS zapremina_flase DECIMAL(10, 2);

-- Create index if needed (optional, for performance)
-- CREATE INDEX IF NOT EXISTS idx_cjenovnik_user_id ON cjenovnik(user_id);

