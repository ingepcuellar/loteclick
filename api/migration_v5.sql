-- Migration v5: Commission amount, discount tracking, notifications, and multi-lot support
-- Run this migration on the production database

-- 1. Commission amount field
ALTER TABLE sales ADD COLUMN commission_amount DECIMAL(15,2) DEFAULT NULL AFTER commission_agent_id;

-- 2. Discount tracking fields
ALTER TABLE sales ADD COLUMN original_price DECIMAL(15,2) DEFAULT NULL AFTER commission_amount;
ALTER TABLE sales ADD COLUMN discount_amount DECIMAL(15,2) DEFAULT NULL AFTER original_price;
ALTER TABLE sales ADD COLUMN discount_authorized_by CHAR(36) DEFAULT NULL AFTER discount_amount;
ALTER TABLE sales ADD COLUMN discount_partner_name VARCHAR(255) DEFAULT NULL AFTER discount_authorized_by;
ALTER TABLE sales ADD COLUMN discount_status ENUM('pending','approved','rejected') DEFAULT NULL AFTER discount_partner_name;

-- 3. Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id CHAR(36) PRIMARY KEY,
    recipient_type ENUM('partner','admin','seller','treasurer') NOT NULL DEFAULT 'partner',
    recipient_id CHAR(36) DEFAULT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    reference_id CHAR(36) DEFAULT NULL,
    reference_type VARCHAR(50) DEFAULT NULL,
    is_read TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Multi-lot support: junction table for grouped sales
CREATE TABLE IF NOT EXISTS sale_lots (
    id CHAR(36) PRIMARY KEY,
    sale_id CHAR(36) NOT NULL,
    lot_id CHAR(36) NOT NULL,
    lot_number VARCHAR(50),
    original_price DECIMAL(15,2) DEFAULT 0,
    sale_price DECIMAL(15,2) DEFAULT 0,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (lot_id) REFERENCES lots(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
