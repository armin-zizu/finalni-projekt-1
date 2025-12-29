-- Migration: Add display_order column to cjenovnik table
-- This migration adds a display_order column to allow custom ordering of items in the price list

-- Step 1: Add display_order column (nullable initially for existing data)
ALTER TABLE cjenovnik 
ADD COLUMN IF NOT EXISTS display_order INTEGER;

-- Step 2: Migrate existing data - assign display_order based on current order (alphabetical by name)
-- This ensures existing items have a display_order value
UPDATE cjenovnik
SET display_order = subquery.row_num - 1
FROM (
  SELECT 
    id,
    user_id,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY naziv ASC) as row_num
  FROM cjenovnik
  WHERE display_order IS NULL
) AS subquery
WHERE cjenovnik.id = subquery.id AND cjenovnik.user_id = subquery.user_id;

-- Step 3: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_cjenovnik_display_order ON cjenovnik(user_id, display_order);

-- Note: display_order can be NULL for new items, and the application will handle assigning values
-- The API sorts by COALESCE(display_order, 999999) to place NULL items at the end

