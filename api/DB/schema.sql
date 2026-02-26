-- =============================================
-- PredioClick - MySQL Schema
-- =============================================

CREATE TABLE IF NOT EXISTS profiles (
    id CHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'seller', 'partner') NOT NULL DEFAULT 'seller',
    is_active TINYINT(1) DEFAULT 1,
    associated_projects JSON DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS projects (
    id CHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(500) NOT NULL,
    description TEXT,
    created_by CHAR(36),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS partners (
    id CHAR(36) PRIMARY KEY,
    project_id CHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
    document VARCHAR(100),
    phone VARCHAR(50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lots (
    id CHAR(36) PRIMARY KEY,
    project_id CHAR(36) NOT NULL,
    number INT NOT NULL,
    area DECIMAL(10,2),
    price DECIMAL(15,2),
    status ENUM('available', 'reserved', 'sold') DEFAULT 'available',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_lot_project (project_id, number),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS clients (
    id CHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    document VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    notes TEXT,
    created_by CHAR(36),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sales (
    id CHAR(36) PRIMARY KEY,
    project_id CHAR(36) NOT NULL,
    lot_id CHAR(36) NOT NULL,
    client_id CHAR(36) NOT NULL,
    sale_price DECIMAL(15,2) NOT NULL,
    sale_date DATE NOT NULL,
    payment_type ENUM('cash', 'credit') NOT NULL DEFAULT 'cash',
    down_payment DECIMAL(15,2) DEFAULT 0,
    installments INT DEFAULT 1,
    notes TEXT,
    created_by CHAR(36),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (lot_id) REFERENCES lots(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payments (
    id CHAR(36) PRIMARY KEY,
    sale_id CHAR(36) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_method ENUM('cash', 'transfer', 'check', 'card', 'other') DEFAULT 'cash',
    receipt_image TEXT,
    notes TEXT,
    created_by CHAR(36),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS expenses (
    id CHAR(36) PRIMARY KEY,
    project_id CHAR(36) NOT NULL,
    partner_id CHAR(36),
    description VARCHAR(500) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    category ENUM('infrastructure', 'legal', 'marketing', 'administrative', 'other') DEFAULT 'other',
    expense_date DATE NOT NULL,
    notes TEXT,
    created_by CHAR(36),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS installments (
    id CHAR(36) PRIMARY KEY,
    sale_id CHAR(36) NOT NULL,
    installment_number INT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    due_date DATE NOT NULL,
    status ENUM('pending', 'paid', 'partial', 'overdue') DEFAULT 'pending',
    paid_amount DECIMAL(15,2) DEFAULT 0,
    paid_date DATE,
    payment_id CHAR(36),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_installment_sale (sale_id, installment_number),
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Indexes
CREATE INDEX idx_partners_project ON partners(project_id);
CREATE INDEX idx_lots_project ON lots(project_id);
CREATE INDEX idx_lots_status ON lots(status);
CREATE INDEX idx_sales_project ON sales(project_id);
CREATE INDEX idx_sales_client ON sales(client_id);
CREATE INDEX idx_payments_sale ON payments(sale_id);
CREATE INDEX idx_expenses_project ON expenses(project_id);
CREATE INDEX idx_installments_sale ON installments(sale_id);
CREATE INDEX idx_installments_status ON installments(status);
CREATE INDEX idx_installments_due ON installments(due_date);

-- Default admin user (password: admin123)
INSERT INTO profiles (id, name, email, password, role, is_active) VALUES (
    UUID(),
    'Administrador',
    'admin@PredioClick.com',
    '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'admin',
    1
);
