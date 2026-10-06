CREATE TABLE `login_throttles` (
    `id` CHAR(36) NOT NULL,
    `key_hash` CHAR(64) NOT NULL,
    `staff_user_id` CHAR(36) NULL,
    `window_started_at` DATETIME(3) NOT NULL,
    `failure_count` INTEGER NOT NULL,
    `locked_until` DATETIME(3) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `login_throttles_key_hash_key`(`key_hash`),
    INDEX `login_throttles_locked_until_idx`(`locked_until`),
    PRIMARY KEY (`id`),
    CONSTRAINT `login_throttles_staff_user_id_fkey` FOREIGN KEY (`staff_user_id`) REFERENCES `staff_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
