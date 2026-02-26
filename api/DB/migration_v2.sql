-- =============================================
-- PredioClick - Migration V2
-- Run this BEFORE deploying new code
-- =============================================

-- 1. Add 'treasurer' role to profiles
ALTER TABLE profiles MODIFY COLUMN role ENUM('admin', 'seller', 'treasurer', 'partner') NOT NULL DEFAULT 'seller';

-- 2. Add commission_agent to sales
ALTER TABLE sales ADD COLUMN commission_agent VARCHAR(255) DEFAULT NULL AFTER notes;

-- 3. Add attachment to expenses
ALTER TABLE expenses ADD COLUMN attachment TEXT DEFAULT NULL AFTER notes;

-- 4. Add 'pending_initial' status to lots
ALTER TABLE lots MODIFY COLUMN status ENUM('available', 'reserved', 'sold', 'pending_initial') DEFAULT 'available';

-- 5. Create partner_disbursements table
CREATE TABLE IF NOT EXISTS partner_disbursements (
    id CHAR(36) PRIMARY KEY,
    project_id CHAR(36) NOT NULL,
    partner_id CHAR(36) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    disbursement_date DATE NOT NULL,
    receipt_image TEXT,
    signature_image TEXT,
    notes TEXT,
    created_by CHAR(36),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Indexes for partner_disbursements
CREATE INDEX idx_disbursements_project ON partner_disbursements(project_id);
CREATE INDEX idx_disbursements_partner ON partner_disbursements(partner_id);
