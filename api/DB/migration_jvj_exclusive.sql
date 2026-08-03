-- ==========================================================
-- MIGRACIÓN EXCLUSIVA J.V.J CONSTRUCTORES
-- ==========================================================

-- 1. Jerarquía Etapas y Manzanas
CREATE TABLE IF NOT EXISTS stages (
    id CHAR(36) PRIMARY KEY,
    project_id CHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS blocks (
    id CHAR(36) PRIMARY KEY,
    stage_id CHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE lots ADD COLUMN block_id CHAR(36) DEFAULT NULL AFTER project_id;
-- Nota: La constraint se agregará asumiendo que los lotes existentes se puedan actualizar.
ALTER TABLE lots ADD CONSTRAINT fk_lots_block FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE SET NULL;

-- 2. Acometida en Ventas
ALTER TABLE sales ADD COLUMN include_acometida TINYINT(1) DEFAULT 0 AFTER payment_type;
ALTER TABLE sales ADD COLUMN acometida_value DECIMAL(15,2) DEFAULT 0 AFTER include_acometida;
ALTER TABLE sales ADD COLUMN acometida_paid TINYINT(1) DEFAULT 0 AFTER acometida_value;

-- 3. Métodos de Pago en Comisionistas (Gastos)
ALTER TABLE expenses ADD COLUMN payment_method ENUM('cash', 'transfer', 'check', 'card', 'other') DEFAULT 'cash' AFTER amount;

-- 4. Métodos de Pago y Cuentas Bancarias
ALTER TABLE payments MODIFY COLUMN payment_method ENUM('cash', 'transfer', 'check', 'card', 'permuta', 'other') DEFAULT 'cash';

CREATE TABLE IF NOT EXISTS bank_accounts (
    id CHAR(36) PRIMARY KEY,
    bank_name VARCHAR(255) NOT NULL,
    account_type ENUM('savings', 'checking') NOT NULL,
    account_number VARCHAR(100) NOT NULL,
    owner_name VARCHAR(255),
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE payments ADD COLUMN bank_account_id CHAR(36) DEFAULT NULL AFTER payment_method;
ALTER TABLE payments ADD CONSTRAINT fk_payments_bank FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE SET NULL;

-- 5. Logo en Proyectos
ALTER TABLE projects ADD COLUMN logo_url TEXT DEFAULT NULL AFTER description;

-- 8. Auditoría y Firma
CREATE TABLE IF NOT EXISTS audit_logs (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(100) NOT NULL,
    entity_id CHAR(36) DEFAULT NULL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE profiles ADD COLUMN signature_image TEXT DEFAULT NULL AFTER associated_projects;
