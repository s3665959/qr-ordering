-- Update only the active source price for the pork and beef buffet package.
-- Existing table_sessions keep their price_per_person_snapshot and total_amount.
UPDATE `buffet_packages`
SET `price_per_person` = 399.00
WHERE `code` = 'PORK_BEEF';
