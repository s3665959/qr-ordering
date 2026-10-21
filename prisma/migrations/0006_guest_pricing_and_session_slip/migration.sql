-- Keep historical price, total, timestamps and events untouched. Old guest_count
-- represents adults because child counts were not recorded before this release.
ALTER TABLE `buffet_packages`
  ADD COLUMN `child_price_per_person` DECIMAL(10, 2) NULL;

ALTER TABLE `table_sessions`
  ADD COLUMN `adult_count` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `child_count` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `child_price_per_person_snapshot` DECIMAL(10, 2) NULL;

UPDATE `table_sessions` SET `adult_count` = `guest_count`;

UPDATE `buffet_packages`
SET `price_per_person` = 339.00, `child_price_per_person` = 169.00
WHERE `code` = 'PORK_BEEF';

UPDATE `buffet_packages`
SET `price_per_person` = 299.00, `child_price_per_person` = 149.00
WHERE `code` = 'PORK';
