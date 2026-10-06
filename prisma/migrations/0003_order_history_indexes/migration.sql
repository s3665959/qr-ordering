-- Supports business-day served queue and historical table lookups without changing order data.
CREATE INDEX `orders_status_served_at_idx` ON `orders` (`status`, `served_at`);
CREATE INDEX `orders_table_session_id_served_at_idx` ON `orders` (`table_session_id`, `served_at`);
