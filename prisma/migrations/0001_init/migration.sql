-- CreateTable
CREATE TABLE `stores` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `timezone` VARCHAR(64) NOT NULL DEFAULT 'Asia/Bangkok',
    `default_duration_minutes` INTEGER NOT NULL DEFAULT 120,
    `alert_before_minutes` INTEGER NOT NULL DEFAULT 15,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `stores_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `staff_users` (
    `id` CHAR(36) NOT NULL,
    `store_id` CHAR(36) NOT NULL,
    `username` VARCHAR(100) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `display_name` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `last_login_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `staff_users_store_id_status_idx`(`store_id`, `status`),
    UNIQUE INDEX `staff_users_store_id_username_key`(`store_id`, `username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(80) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(500) NULL,
    `is_system` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `roles_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permissions` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(100) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(500) NULL,

    UNIQUE INDEX `permissions_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `staff_user_roles` (
    `staff_user_id` CHAR(36) NOT NULL,
    `role_id` CHAR(36) NOT NULL,
    `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`staff_user_id`, `role_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_permissions` (
    `role_id` CHAR(36) NOT NULL,
    `permission_id` CHAR(36) NOT NULL,

    PRIMARY KEY (`role_id`, `permission_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `staff_auth_sessions` (
    `id` CHAR(36) NOT NULL,
    `staff_user_id` CHAR(36) NOT NULL,
    `session_token_hash` CHAR(64) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `staff_auth_sessions_session_token_hash_key`(`session_token_hash`),
    INDEX `staff_auth_sessions_staff_user_id_expires_at_idx`(`staff_user_id`, `expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dining_tables` (
    `id` CHAR(36) NOT NULL,
    `store_id` CHAR(36) NOT NULL,
    `table_number` VARCHAR(50) NOT NULL,
    `display_name` VARCHAR(191) NOT NULL,
    `capacity` INTEGER NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `dining_tables_store_id_is_active_sort_order_idx`(`store_id`, `is_active`, `sort_order`),
    UNIQUE INDEX `dining_tables_store_id_table_number_key`(`store_id`, `table_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `buffet_packages` (
    `id` CHAR(36) NOT NULL,
    `store_id` CHAR(36) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `price_per_person` DECIMAL(10, 2) NOT NULL,
    `duration_minutes` INTEGER NOT NULL DEFAULT 120,
    `allows_beef_ordering` BOOLEAN NOT NULL DEFAULT false,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `buffet_packages_store_id_is_active_sort_order_idx`(`store_id`, `is_active`, `sort_order`),
    UNIQUE INDEX `buffet_packages_store_id_code_key`(`store_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `table_sessions` (
    `id` CHAR(36) NOT NULL,
    `store_id` CHAR(36) NOT NULL,
    `table_id` CHAR(36) NOT NULL,
    `package_id` CHAR(36) NOT NULL,
    `guest_count` INTEGER NOT NULL,
    `package_name_snapshot` VARCHAR(191) NOT NULL,
    `price_per_person_snapshot` DECIMAL(10, 2) NOT NULL,
    `duration_minutes_snapshot` INTEGER NOT NULL,
    `allows_beef_ordering_snapshot` BOOLEAN NOT NULL,
    `total_amount` DECIMAL(10, 2) NOT NULL,
    `lifecycle_status` ENUM('PAID_PENDING_START', 'ACTIVE', 'CLOSED', 'CANCELLED') NOT NULL,
    `opened_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `started_at` DATETIME(3) NULL,
    `ends_at` DATETIME(3) NULL,
    `closed_at` DATETIME(3) NULL,
    `cancelled_at` DATETIME(3) NULL,
    `opened_by_id` CHAR(36) NOT NULL,
    `started_by_id` CHAR(36) NULL,
    `closed_by_id` CHAR(36) NULL,
    `cancelled_by_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `table_sessions_store_id_lifecycle_status_idx`(`store_id`, `lifecycle_status`),
    INDEX `table_sessions_table_id_opened_at_idx`(`table_id`, `opened_at`),
    INDEX `table_sessions_lifecycle_status_ends_at_idx`(`lifecycle_status`, `ends_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `active_table_sessions` (
    `table_id` CHAR(36) NOT NULL,
    `table_session_id` CHAR(36) NOT NULL,
    `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `active_table_sessions_table_session_id_key`(`table_session_id`),
    PRIMARY KEY (`table_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` CHAR(36) NOT NULL,
    `table_session_id` CHAR(36) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `method` VARCHAR(50) NOT NULL,
    `status` ENUM('CONFIRMED', 'VOIDED', 'REFUNDED') NOT NULL DEFAULT 'CONFIRMED',
    `reference` VARCHAR(191) NULL,
    `notes` VARCHAR(500) NULL,
    `paid_at` DATETIME(3) NOT NULL,
    `received_by_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payments_table_session_id_status_idx`(`table_session_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `qr_access_tokens` (
    `id` CHAR(36) NOT NULL,
    `table_session_id` CHAR(36) NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `issued_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `issued_by_id` CHAR(36) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `revoked_by_id` CHAR(36) NULL,
    `revocation_reason` VARCHAR(191) NULL,
    `replaced_by_token_id` CHAR(36) NULL,
    `last_used_at` DATETIME(3) NULL,

    UNIQUE INDEX `qr_access_tokens_token_hash_key`(`token_hash`),
    UNIQUE INDEX `qr_access_tokens_replaced_by_token_id_key`(`replaced_by_token_id`),
    INDEX `qr_access_tokens_table_session_id_issued_at_idx`(`table_session_id`, `issued_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `active_qr_tokens` (
    `table_session_id` CHAR(36) NOT NULL,
    `qr_token_id` CHAR(36) NOT NULL,
    `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `active_qr_tokens_qr_token_id_key`(`qr_token_id`),
    PRIMARY KEY (`table_session_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `table_session_extensions` (
    `id` CHAR(36) NOT NULL,
    `table_session_id` CHAR(36) NOT NULL,
    `old_ends_at` DATETIME(3) NOT NULL,
    `new_ends_at` DATETIME(3) NOT NULL,
    `minutes_added` INTEGER NOT NULL,
    `reason` VARCHAR(500) NOT NULL,
    `approved_by_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `table_session_extensions_table_session_id_created_at_idx`(`table_session_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `table_session_events` (
    `id` CHAR(36) NOT NULL,
    `table_session_id` CHAR(36) NOT NULL,
    `event_type` VARCHAR(80) NOT NULL,
    `actor_staff_id` CHAR(36) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `table_session_events_table_session_id_created_at_idx`(`table_session_id`, `created_at`),
    INDEX `table_session_events_event_type_created_at_idx`(`event_type`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `staff_alerts` (
    `id` CHAR(36) NOT NULL,
    `table_session_id` CHAR(36) NOT NULL,
    `alert_type` ENUM('ENDING_SOON') NOT NULL,
    `triggered_at` DATETIME(3) NOT NULL,
    `acknowledged_at` DATETIME(3) NULL,
    `acknowledged_by_id` CHAR(36) NULL,

    INDEX `staff_alerts_acknowledged_at_triggered_at_idx`(`acknowledged_at`, `triggered_at`),
    UNIQUE INDEX `staff_alerts_table_session_id_alert_type_triggered_at_key`(`table_session_id`, `alert_type`, `triggered_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `menu_categories` (
    `id` CHAR(36) NOT NULL,
    `store_id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(500) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `menu_categories_store_id_is_active_sort_order_idx`(`store_id`, `is_active`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `menu_items` (
    `id` CHAR(36) NOT NULL,
    `category_id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(1000) NULL,
    `serving_unit` VARCHAR(100) NOT NULL,
    `image_key` VARCHAR(500) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_available` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `menu_items_category_id_is_active_is_available_sort_order_idx`(`category_id`, `is_active`, `is_available`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orders` (
    `id` CHAR(36) NOT NULL,
    `table_session_id` CHAR(36) NOT NULL,
    `order_number` VARCHAR(50) NOT NULL,
    `status` ENUM('NEW', 'ACCEPTED', 'PREPARING', 'DELIVERING', 'SERVED', 'CANCELLED') NOT NULL DEFAULT 'NEW',
    `idempotency_key` VARCHAR(100) NOT NULL,
    `request_fingerprint` CHAR(64) NOT NULL,
    `ordered_at` DATETIME(3) NOT NULL,
    `accepted_at` DATETIME(3) NULL,
    `served_at` DATETIME(3) NULL,
    `cancelled_at` DATETIME(3) NULL,
    `cancellation_reason` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `orders_status_ordered_at_idx`(`status`, `ordered_at`),
    INDEX `orders_table_session_id_ordered_at_idx`(`table_session_id`, `ordered_at`),
    UNIQUE INDEX `orders_table_session_id_idempotency_key_key`(`table_session_id`, `idempotency_key`),
    UNIQUE INDEX `orders_table_session_id_order_number_key`(`table_session_id`, `order_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_items` (
    `id` CHAR(36) NOT NULL,
    `order_id` CHAR(36) NOT NULL,
    `menu_item_id` CHAR(36) NOT NULL,
    `item_name_snapshot` VARCHAR(191) NOT NULL,
    `serving_unit_snapshot` VARCHAR(100) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `order_items_order_id_idx`(`order_id`),
    INDEX `order_items_menu_item_id_idx`(`menu_item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_status_events` (
    `id` CHAR(36) NOT NULL,
    `order_id` CHAR(36) NOT NULL,
    `from_status` ENUM('NEW', 'ACCEPTED', 'PREPARING', 'DELIVERING', 'SERVED', 'CANCELLED') NULL,
    `to_status` ENUM('NEW', 'ACCEPTED', 'PREPARING', 'DELIVERING', 'SERVED', 'CANCELLED') NOT NULL,
    `reason` VARCHAR(500) NULL,
    `changed_by_staff_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `order_status_events_order_id_created_at_idx`(`order_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `staff_users` ADD CONSTRAINT `staff_users_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff_user_roles` ADD CONSTRAINT `staff_user_roles_staff_user_id_fkey` FOREIGN KEY (`staff_user_id`) REFERENCES `staff_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff_user_roles` ADD CONSTRAINT `staff_user_roles_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff_auth_sessions` ADD CONSTRAINT `staff_auth_sessions_staff_user_id_fkey` FOREIGN KEY (`staff_user_id`) REFERENCES `staff_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dining_tables` ADD CONSTRAINT `dining_tables_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `buffet_packages` ADD CONSTRAINT `buffet_packages_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `table_sessions` ADD CONSTRAINT `table_sessions_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `table_sessions` ADD CONSTRAINT `table_sessions_table_id_fkey` FOREIGN KEY (`table_id`) REFERENCES `dining_tables`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `table_sessions` ADD CONSTRAINT `table_sessions_package_id_fkey` FOREIGN KEY (`package_id`) REFERENCES `buffet_packages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `table_sessions` ADD CONSTRAINT `table_sessions_opened_by_id_fkey` FOREIGN KEY (`opened_by_id`) REFERENCES `staff_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `table_sessions` ADD CONSTRAINT `table_sessions_started_by_id_fkey` FOREIGN KEY (`started_by_id`) REFERENCES `staff_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `table_sessions` ADD CONSTRAINT `table_sessions_closed_by_id_fkey` FOREIGN KEY (`closed_by_id`) REFERENCES `staff_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `table_sessions` ADD CONSTRAINT `table_sessions_cancelled_by_id_fkey` FOREIGN KEY (`cancelled_by_id`) REFERENCES `staff_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `active_table_sessions` ADD CONSTRAINT `active_table_sessions_table_id_fkey` FOREIGN KEY (`table_id`) REFERENCES `dining_tables`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `active_table_sessions` ADD CONSTRAINT `active_table_sessions_table_session_id_fkey` FOREIGN KEY (`table_session_id`) REFERENCES `table_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_table_session_id_fkey` FOREIGN KEY (`table_session_id`) REFERENCES `table_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_received_by_id_fkey` FOREIGN KEY (`received_by_id`) REFERENCES `staff_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `qr_access_tokens` ADD CONSTRAINT `qr_access_tokens_table_session_id_fkey` FOREIGN KEY (`table_session_id`) REFERENCES `table_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `qr_access_tokens` ADD CONSTRAINT `qr_access_tokens_issued_by_id_fkey` FOREIGN KEY (`issued_by_id`) REFERENCES `staff_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `qr_access_tokens` ADD CONSTRAINT `qr_access_tokens_revoked_by_id_fkey` FOREIGN KEY (`revoked_by_id`) REFERENCES `staff_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `qr_access_tokens` ADD CONSTRAINT `qr_access_tokens_replaced_by_token_id_fkey` FOREIGN KEY (`replaced_by_token_id`) REFERENCES `qr_access_tokens`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `active_qr_tokens` ADD CONSTRAINT `active_qr_tokens_table_session_id_fkey` FOREIGN KEY (`table_session_id`) REFERENCES `table_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `active_qr_tokens` ADD CONSTRAINT `active_qr_tokens_qr_token_id_fkey` FOREIGN KEY (`qr_token_id`) REFERENCES `qr_access_tokens`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `table_session_extensions` ADD CONSTRAINT `table_session_extensions_table_session_id_fkey` FOREIGN KEY (`table_session_id`) REFERENCES `table_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `table_session_extensions` ADD CONSTRAINT `table_session_extensions_approved_by_id_fkey` FOREIGN KEY (`approved_by_id`) REFERENCES `staff_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `table_session_events` ADD CONSTRAINT `table_session_events_table_session_id_fkey` FOREIGN KEY (`table_session_id`) REFERENCES `table_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `table_session_events` ADD CONSTRAINT `table_session_events_actor_staff_id_fkey` FOREIGN KEY (`actor_staff_id`) REFERENCES `staff_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff_alerts` ADD CONSTRAINT `staff_alerts_table_session_id_fkey` FOREIGN KEY (`table_session_id`) REFERENCES `table_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff_alerts` ADD CONSTRAINT `staff_alerts_acknowledged_by_id_fkey` FOREIGN KEY (`acknowledged_by_id`) REFERENCES `staff_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `menu_categories` ADD CONSTRAINT `menu_categories_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `menu_items` ADD CONSTRAINT `menu_items_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `menu_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_table_session_id_fkey` FOREIGN KEY (`table_session_id`) REFERENCES `table_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_menu_item_id_fkey` FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_status_events` ADD CONSTRAINT `order_status_events_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_status_events` ADD CONSTRAINT `order_status_events_changed_by_staff_id_fkey` FOREIGN KEY (`changed_by_staff_id`) REFERENCES `staff_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
