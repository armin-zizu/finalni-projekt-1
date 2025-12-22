-- Fix devices table to prevent duplicates
-- Change UNIQUE constraint from device_id only to (user_id, device_id) combination

-- First, remove the old UNIQUE constraint on device_id
-- Note: Constraint name might vary - try common variations
ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_device_id_key;
ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_device_id_unique;

-- Add new UNIQUE constraint on (user_id, device_id) combination
-- This ensures that same device can be used by different users,
-- but same user cannot have duplicate entries for same device
ALTER TABLE devices ADD CONSTRAINT devices_user_id_device_id_unique UNIQUE (user_id, device_id);

-- Create index for faster lookups (if not already exists)
CREATE INDEX IF NOT EXISTS idx_devices_user_device ON devices(user_id, device_id);

-- Clean up any duplicate entries (keep the most recent one for each user_id + device_id combination)
-- This query keeps the device with the most recent last_login or created_at
WITH ranked_devices AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY user_id, device_id ORDER BY 
           COALESCE(last_login, created_at) DESC, created_at DESC) as rn
  FROM devices
)
DELETE FROM devices
WHERE id IN (
  SELECT id FROM ranked_devices WHERE rn > 1
);

