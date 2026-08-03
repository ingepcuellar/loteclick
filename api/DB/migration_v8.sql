-- =============================================
-- LoteClick - Migration v8: Tabla Desistimientos
-- =============================================
-- Ejecutar en producción (cPanel MySQL)

CREATE TABLE IF NOT EXISTS desistimientos (
    id CHAR(36) PRIMARY KEY,
    sale_id CHAR(36) NOT NULL COMMENT 'ID de la venta original (ya eliminada)',
    project_id CHAR(36) NOT NULL,
    lot_id CHAR(36) NOT NULL,
    lot_number INT NOT NULL,
    client_id CHAR(36) NOT NULL,
    client_name VARCHAR(255) NOT NULL,
    client_document VARCHAR(100),
    client_phone VARCHAR(50),
    project_name VARCHAR(255) NOT NULL,
    sale_price DECIMAL(15,2) NOT NULL COMMENT 'Precio original de venta',
    total_paid DECIMAL(15,2) NOT NULL DEFAULT 0 COMMENT 'Total que habia pagado el cliente',
    amount_retained DECIMAL(15,2) NOT NULL COMMENT 'Monto que retiene la empresa (configurable)',
    desistimiento_date DATE NOT NULL,
    reason TEXT COMMENT 'Motivo del desistimiento',
    notes TEXT,
    registered_by CHAR(36),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (registered_by) REFERENCES profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_desistimientos_project ON desistimientos(project_id);
CREATE INDEX idx_desistimientos_client ON desistimientos(client_id);
CREATE INDEX idx_desistimientos_date ON desistimientos(desistimiento_date);
