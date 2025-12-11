-- Create devices table with TEXT user_id (matching users.id type)
-- Run this on your server via: sudo -u postgres psql -d office_app -f create-devices-table.sql

BEGIN;

-- Create devices table
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(255) UNIQUE NOT NULL,
  device_name VARCHAR(255),
  device_info JSONB,
  role VARCHAR(50),
  permissions JSONB DEFAULT '{}',
  is_blocked BOOLEAN DEFAULT FALSE,
  last_login TIMESTAMP,
  status VARCHAR(50), -- 'active', 'blocked', 'pending', 'approved', 'verifikacija'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);

-- Create index on device_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);

COMMIT;

-- Verify table was created
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'devices' 
ORDER BY ordinal_position;

