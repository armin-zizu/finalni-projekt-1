-- Migration: Add is_draft column to obracuni table
-- This migration adds the is_draft column that is needed for draft functionality

-- Add is_draft column if it doesn't exist
ALTER TABLE obracuni 
ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT FALSE;

-- Update existing rows to have is_draft = FALSE (they are all final obracuni)
UPDATE obracuni 
SET is_draft = FALSE 
WHERE is_draft IS NULL;

-- Make sure the column is NOT NULL after updating existing data
ALTER TABLE obracuni 
ALTER COLUMN is_draft SET DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN obracuni.is_draft IS 'Flag indicating if this is a draft obracun (TRUE) or final (FALSE)';

