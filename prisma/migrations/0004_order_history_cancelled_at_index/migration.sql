-- Supports history lookups by the actual cancellation timestamp.
CREATE INDEX `orders_status_cancelled_at_idx` ON `orders` (`status`, `cancelled_at`);
