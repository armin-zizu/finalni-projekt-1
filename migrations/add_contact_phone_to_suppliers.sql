-- Add contact and phone fields to suppliers table
ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS contact TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_suppliers_contact ON suppliers(contact);
