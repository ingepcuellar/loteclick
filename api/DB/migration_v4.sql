-- =============================================
-- PredioClick - Migration V4
-- Utility Registrations (Matrículas de Servicios Públicos)
-- INDEPENDENT from project accounting
-- =============================================

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

-- Indexes
CREATE INDEX idx_utility_sale ON utility_registrations(sale_id);
CREATE INDEX idx_utility_status ON utility_registrations(status);
CREATE INDEX idx_utility_type ON utility_registrations(service_type);
