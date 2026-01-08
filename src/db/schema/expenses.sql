-- Expense table schema generated from src/db/entities/Expense.ts
-- Database: radius

CREATE TABLE IF NOT EXISTS `expenses` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(128) NOT NULL,
  `category` VARCHAR(64) NULL,
  `amount` FLOAT NOT NULL,
  `currency` VARCHAR(8) NOT NULL DEFAULT 'USD',
  `expenseDate` DATE NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'unpaid',
  `notes` TEXT NULL,
  `createdBy` VARCHAR(64) NULL,
  `updatedBy` VARCHAR(64) NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` DATETIME NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_expenses_expenseDate` (`expenseDate`),
  INDEX `idx_expenses_status` (`status`),
  INDEX `idx_expenses_category` (`category`),
  INDEX `idx_expenses_deletedAt` (`deletedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

