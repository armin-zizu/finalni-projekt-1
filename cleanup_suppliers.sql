-- Delete all suppliers
DELETE FROM suppliers;

-- Verify
SELECT COUNT(*) as remaining_suppliers FROM suppliers;
