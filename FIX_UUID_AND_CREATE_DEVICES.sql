-- First enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Now create devices table
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT,
  device_id VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Verify it was created
SELECT 'Devices table created!' as status;

