<?php
require_once '../config.php';

// Endpoint para ejecutar la migración de la base de datos automáticamente
try {
    $pdo = getConnection();
    
    // 1. Jerarquía Etapas y Manzanas
    $pdo->exec("CREATE TABLE IF NOT EXISTS stages (
        id CHAR(36) PRIMARY KEY,
        project_id CHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    $pdo->exec("CREATE TABLE IF NOT EXISTS blocks (
        id CHAR(36) PRIMARY KEY,
        stage_id CHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // Add block_id to lots if it doesn't exist
    try {
        $pdo->exec("ALTER TABLE lots ADD COLUMN block_id CHAR(36) DEFAULT NULL AFTER project_id;");
        $pdo->exec("ALTER TABLE lots ADD CONSTRAINT fk_lots_block FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE SET NULL;");
    } catch(PDOException $e) {}

    // 2. Acometida en Ventas
    try {
        $pdo->exec("ALTER TABLE sales ADD COLUMN include_acometida TINYINT(1) DEFAULT 0 AFTER payment_type;");
        $pdo->exec("ALTER TABLE sales ADD COLUMN acometida_value DECIMAL(15,2) DEFAULT 0 AFTER include_acometida;");
        $pdo->exec("ALTER TABLE sales ADD COLUMN acometida_paid TINYINT(1) DEFAULT 0 AFTER acometida_value;");
    } catch(PDOException $e) {}

    // 3. Métodos de Pago en Comisionistas (Gastos)
    try {
        $pdo->exec("ALTER TABLE expenses ADD COLUMN payment_method ENUM('cash', 'transfer', 'check', 'card', 'other') DEFAULT 'cash' AFTER amount;");
    } catch(PDOException $e) {}

    // 4. Métodos de Pago y Cuentas Bancarias
    try {
        $pdo->exec("ALTER TABLE payments MODIFY COLUMN payment_method ENUM('cash', 'transfer', 'check', 'card', 'permuta', 'other') DEFAULT 'cash';");
    } catch(PDOException $e) {}

    $pdo->exec("CREATE TABLE IF NOT EXISTS bank_accounts (
        id CHAR(36) PRIMARY KEY,
        bank_name VARCHAR(255) NOT NULL,
        account_type ENUM('Ahorros', 'Corriente') NOT NULL,
        account_number VARCHAR(100) NOT NULL,
        owner_name VARCHAR(255),
        is_active TINYINT(1) DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    try {
        $pdo->exec("ALTER TABLE payments ADD COLUMN bank_account_id CHAR(36) DEFAULT NULL AFTER payment_method;");
        $pdo->exec("ALTER TABLE payments ADD CONSTRAINT fk_payments_bank FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE SET NULL;");
    } catch(PDOException $e) {}

    // 5. Logo y Configuración en Proyectos
    try {
        $pdo->exec("ALTER TABLE projects ADD COLUMN block_type VARCHAR(50) DEFAULT NULL AFTER description;");
    } catch(PDOException $e) {}
    try {
        $pdo->exec("ALTER TABLE projects ADD COLUMN logo_url TEXT DEFAULT NULL AFTER block_type;");
    } catch(PDOException $e) {}

    // 8. Auditoría y Firma
    $pdo->exec("CREATE TABLE IF NOT EXISTS audit_logs (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        user_name VARCHAR(255) DEFAULT NULL,
        action VARCHAR(100) NOT NULL,
        entity VARCHAR(100) NOT NULL,
        entity_id CHAR(36) DEFAULT NULL,
        field_name VARCHAR(255) DEFAULT NULL,
        old_value TEXT DEFAULT NULL,
        new_value TEXT DEFAULT NULL,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // Add extra columns if table already exists
    try { $pdo->exec("ALTER TABLE audit_logs ADD COLUMN user_name VARCHAR(255) DEFAULT NULL AFTER user_id;"); } catch(PDOException $e) {}
    try { $pdo->exec("ALTER TABLE audit_logs ADD COLUMN field_name VARCHAR(255) DEFAULT NULL AFTER entity_id;"); } catch(PDOException $e) {}
    try { $pdo->exec("ALTER TABLE audit_logs ADD COLUMN old_value TEXT DEFAULT NULL AFTER field_name;"); } catch(PDOException $e) {}
    try { $pdo->exec("ALTER TABLE audit_logs ADD COLUMN new_value TEXT DEFAULT NULL AFTER old_value;"); } catch(PDOException $e) {}

    try {
        $pdo->exec("ALTER TABLE profiles ADD COLUMN signature_image TEXT DEFAULT NULL AFTER associated_projects;");
    } catch(PDOException $e) {}

    echo json_encode(['success' => true, 'message' => 'Migración de la base de datos completada exitosamente.']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
