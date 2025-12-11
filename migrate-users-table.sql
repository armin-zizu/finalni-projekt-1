-- Migration script to add missing columns to users table
-- Run this script directly on your PostgreSQL server as a user with ALTER TABLE permissions
-- You can run it via psql: psql -h 46.224.115.49 -U office_user -d office_app -f migrate-users-table.sql

BEGIN;

-- Add password_hash column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- Add role column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT NULL;

-- Add is_owner column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_owner BOOLEAN DEFAULT FALSE;

-- Add permissions column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';

-- Add updated_at column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Make email NOT NULL if it's nullable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'email' 
    AND is_nullable = 'YES'
  ) THEN
    -- First set NULL emails to a placeholder (adjust if needed)
    UPDATE users SET email = 'noemail_' || id WHERE email IS NULL;
    ALTER TABLE users ALTER COLUMN email SET NOT NULL;
  END IF;
END $$;

-- Add unique constraint on email if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_email_key' 
    AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
  END IF;
END $$;

-- Update updated_at to NOW() for existing rows
UPDATE users 
SET updated_at = COALESCE(updated_at, created_at, NOW())
WHERE updated_at IS NULL;

COMMIT;

-- Show the final structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'users'
ORDER BY ordinal_position;

