-- Grant all privileges on suppliers table to office_user
ALTER TABLE suppliers OWNER TO office_user;

-- Add columns
ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS contact TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';

-- Create index
CREATE INDEX IF NOT EXISTS idx_suppliers_contact ON suppliers(contact);

-- Grant privileges
GRANT ALL PRIVILEGES ON suppliers TO office_user;
