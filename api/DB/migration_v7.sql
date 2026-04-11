-- =============================================
-- LoteClick - Migration V7
-- Parámetros de Contrato
-- Run this AFTER migration_v6.sql
-- =============================================

CREATE TABLE IF NOT EXISTS contract_params (
    id CHAR(36) PRIMARY KEY,
    -- Vendedor (siempre la misma persona)
    vendor_name VARCHAR(255) NOT NULL DEFAULT '',
    vendor_document VARCHAR(100) NOT NULL DEFAULT '',
    vendor_phone VARCHAR(50) DEFAULT '',
    vendor_address VARCHAR(500) DEFAULT '',
    -- Inmueble
    matricula_inmobiliaria VARCHAR(100) DEFAULT '',
    porcentaje_cuota VARCHAR(20) DEFAULT '0.052%',
    ciudad VARCHAR(100) DEFAULT 'Villavicencio - Meta',
    -- Notaría
    notaria_nombre VARCHAR(255) DEFAULT '',
    notaria_ciudad VARCHAR(100) DEFAULT '',
    escritura_fecha DATE DEFAULT NULL,
    escritura_hora VARCHAR(20) DEFAULT '03:00 PM',
    -- Título de propiedad (cláusula SEGUNDA - texto libre)
    titulo_propiedad TEXT,
    -- Consecutivo de promesa
    ultimo_numero_promesa INT DEFAULT 0,
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
