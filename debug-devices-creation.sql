-- Debug script - run these commands one by one to see what's happening

-- 1. Check if table already exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'devices'
) as table_exists;

-- 2. Check current user permissions
SELECT current_user, current_database();

-- 3. Try to create table WITHOUT foreign key first (to see if that's the problem)
CREATE TABLE IF NOT EXISTS devices_test (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT,
  device_id VARCHAR(255) UNIQUE NOT NULL,
  device_name VARCHAR(255),
  device_info JSONB,
  role VARCHAR(50),
  permissions JSONB DEFAULT '{}',
  is_blocked BOOLEAN DEFAULT FALSE,
  last_login TIMESTAMP,
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- If that works, drop it and try with foreign key:
-- DROP TABLE devices_test;

-- 4. Check users table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'id';

-- 5. Try creating devices table step by step
-- First just basic structure:
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT,
  device_id VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- If that works, add foreign key constraint separately:
-- ALTER TABLE devices ADD CONSTRAINT devices_user_id_fkey 
-- FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Then add remaining columns:
-- ALTER TABLE devices ADD COLUMN device_name VARCHAR(255);
-- ALTER TABLE devices ADD COLUMN device_info JSONB;
-- ALTER TABLE devices ADD COLUMN role VARCHAR(50);
-- ALTER TABLE devices ADD COLUMN permissions JSONB DEFAULT '{}';
-- ALTER TABLE devices ADD COLUMN is_blocked BOOLEAN DEFAULT FALSE;
-- ALTER TABLE devices ADD COLUMN last_login TIMESTAMP;
-- ALTER TABLE devices ADD COLUMN status VARCHAR(50);
-- ALTER TABLE devices ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();

