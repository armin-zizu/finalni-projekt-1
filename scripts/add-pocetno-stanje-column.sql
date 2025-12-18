-- Run this as postgres user: sudo -u postgres psql -d office_app -f this_file.sql
-- Or copy-paste this content when connected as postgres user
-- Adds pocetno_stanje column to cjenovnik table

ALTER TABLE cjenovnik 
ADD COLUMN IF NOT EXISTS pocetno_stanje DECIMAL(10, 2) DEFAULT 0;


