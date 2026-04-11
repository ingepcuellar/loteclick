-- =============================================
-- LoteClick - Schema Completo para JVJ Constructores
-- Base de datos NUEVA desde cero
-- Incluye: schema base + migrations v2 + v3 + v4 + v5 + v6
-- =============================================

-- ─── PROFILES (Usuarios) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
    id CHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    -- v6: VARCHAR para soportar arrays JSON de roles múltiples ej: '["seller","treasurer"]'
    role VARCHAR(100) NOT NULL DEFAULT 'seller',
    is_active TINYINT(1) DEFAULT 1,
    associated_projects JSON DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── PROJECTS ────────────────────────────────────────────────────
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

-- ─── PARTNERS (Socios del Proyecto) ──────────────────────────────
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

-- ─── LOTS (Lotes) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lots (
    id CHAR(36) PRIMARY KEY,
    project_id CHAR(36) NOT NULL,
    number INT NOT NULL,
    area DECIMAL(10,2),
    price DECIMAL(15,2),
    -- v2: incluye 'pending_initial'
    status ENUM('available', 'reserved', 'sold', 'pending_initial') DEFAULT 'available',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_lot_project (project_id, number),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── CLIENTS (Clientes) ─────────────────────────────────────────
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

-- ─── COMMISSION AGENTS (Agentes de Comisión) ────────────────────
CREATE TABLE IF NOT EXISTS commission_agents (
    id CHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    document VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(255),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── SALES (Ventas) ──────────────────────────────────────────────
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
    -- v2: commission agent
    commission_agent VARCHAR(255) DEFAULT NULL,
    commission_agent_id CHAR(36) DEFAULT NULL,
    -- v5: commission amount
    commission_amount DECIMAL(15,2) DEFAULT NULL,
    -- v5: discount tracking
    original_price DECIMAL(15,2) DEFAULT NULL,
    discount_amount DECIMAL(15,2) DEFAULT NULL,
    discount_authorized_by CHAR(36) DEFAULT NULL,
    discount_partner_name VARCHAR(255) DEFAULT NULL,
    discount_status ENUM('pending','approved','rejected') DEFAULT NULL,
    created_by CHAR(36),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (lot_id) REFERENCES lots(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── PAYMENTS (Pagos) ────────────────────────────────────────────
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

-- ─── EXPENSES (Gastos) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
    id CHAR(36) PRIMARY KEY,
    project_id CHAR(36) NOT NULL,
    partner_id CHAR(36),
    description VARCHAR(500) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    -- v3: VARCHAR flexible para categorías
    category VARCHAR(50) NOT NULL DEFAULT 'other',
    expense_date DATE NOT NULL,
    notes TEXT,
    -- v2: attachment
    attachment TEXT DEFAULT NULL,
    -- v3: multi-lot tracking para Firmas y Escrituras
    selected_lots JSON DEFAULT NULL,
    created_by CHAR(36),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── INSTALLMENTS (Cuotas) ───────────────────────────────────────
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

-- ─── PARTNER DISBURSEMENTS (Desembolsos a Socios) ───────────────
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

-- ─── UTILITY REGISTRATIONS (Matrículas de Servicios Públicos) ───
CREATE TABLE IF NOT EXISTS utility_registrations (
    id CHAR(36) PRIMARY KEY,
    sale_id CHAR(36) NOT NULL,
    service_type ENUM('water','energy','gas') NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    status ENUM('pending','paid') DEFAULT 'pending',
    charge_date DATE NOT NULL,
    paid_date DATE,
    notes TEXT,
    created_by CHAR(36),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── NOTIFICATIONS ───────────────────────────────────────────────
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

-- ─── SALE LOTS (Lotes Agrupados por Venta) ──────────────────────
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

-- ─── INDEXES ─────────────────────────────────────────────────────
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
CREATE INDEX idx_disbursements_project ON partner_disbursements(project_id);
CREATE INDEX idx_disbursements_partner ON partner_disbursements(partner_id);
CREATE INDEX idx_utility_sale ON utility_registrations(sale_id);
CREATE INDEX idx_utility_status ON utility_registrations(status);
CREATE INDEX idx_utility_type ON utility_registrations(service_type);

-- ─── USUARIO ADMIN POR DEFECTO ──────────────────────────────────
-- Contraseña: admin123 (bcrypt hash)
-- ⚠️ CAMBIAR esta contraseña inmediatamente después del primer login
INSERT INTO profiles (id, name, email, password, role, is_active) VALUES (
    UUID(),
    'Administrador JVJ',
    'admin@jvjconstructores.com',
    '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'admin',
    1
);
