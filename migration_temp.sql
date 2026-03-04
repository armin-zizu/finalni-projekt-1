ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS contact TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_suppliers_contact ON suppliers(contact);
