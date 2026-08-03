<?php
/**
 * LoteClick - Auto Migration Script
 * Detects and creates missing tables/columns required by the latest version.
 * Access: /api/auto_migrate.php
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/jwt.php';

header('Content-Type: text/html; charset=utf-8');
echo "<h2>🔧 LoteClick - Migración Automática</h2>";
echo "<pre style='font-family:monospace; line-height:1.8;'>";

$pdo = getConnection();
$results = [];

function tableExists($pdo, $table) {
    return (bool)$pdo->query("SHOW TABLES LIKE '$table'")->fetch();
}

function columnExists($pdo, $table, $column) {
    try {
        $cols = $pdo->query("SHOW COLUMNS FROM `$table`")->fetchAll(PDO::FETCH_COLUMN, 0);
        return in_array($column, $cols);
    } catch (Exception $e) { return false; }
}

function runSQL($pdo, $desc, $sql) {
    try {
        $pdo->exec($sql);
        echo "✅ $desc\n";
    } catch (Exception $e) {
        $msg = $e->getMessage();
        if (strpos($msg, 'Duplicate') !== false || strpos($msg, 'already exists') !== false) {
            echo "⏭️ $desc (ya existía)\n";
        } else {
            echo "❌ $desc — Error: $msg\n";
        }
    }
}

// ═══════════════════════════════════════════════════════════
echo "\n=== 1. TABLAS NUEVAS ===\n\n";
// ═══════════════════════════════════════════════════════════

// stages table
if (!tableExists($pdo, 'stages')) {
    runSQL($pdo, "Crear tabla 'stages'",
        "CREATE TABLE stages (
            id CHAR(36) PRIMARY KEY,
            project_id CHAR(36) NOT NULL,
            name VARCHAR(255) NOT NULL,
            description TEXT DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
} else {
    echo "⏭️ Tabla 'stages' ya existe\n";
}

// blocks table
if (!tableExists($pdo, 'blocks')) {
    runSQL($pdo, "Crear tabla 'blocks'",
        "CREATE TABLE blocks (
            id CHAR(36) PRIMARY KEY,
            stage_id CHAR(36) NOT NULL,
            name VARCHAR(255) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
} else {
    echo "⏭️ Tabla 'blocks' ya existe\n";
}

// sale_lots table
if (!tableExists($pdo, 'sale_lots')) {
    runSQL($pdo, "Crear tabla 'sale_lots'",
        "CREATE TABLE sale_lots (
            id CHAR(36) PRIMARY KEY,
            sale_id CHAR(36) NOT NULL,
            lot_id CHAR(36) NOT NULL,
            lot_number VARCHAR(50) DEFAULT NULL,
            original_price DECIMAL(15,2) DEFAULT 0,
            sale_price DECIMAL(15,2) DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
} else {
    echo "⏭️ Tabla 'sale_lots' ya existe\n";
}

// notifications table
if (!tableExists($pdo, 'notifications')) {
    runSQL($pdo, "Crear tabla 'notifications'",
        "CREATE TABLE notifications (
            id CHAR(36) PRIMARY KEY,
            recipient_type ENUM('admin','seller','treasurer','partner','all') DEFAULT 'admin',
            recipient_id CHAR(36) DEFAULT NULL,
            type VARCHAR(100) NOT NULL DEFAULT 'info',
            title VARCHAR(255) NOT NULL,
            message TEXT,
            reference_id CHAR(36) DEFAULT NULL,
            reference_type VARCHAR(100) DEFAULT NULL,
            is_read TINYINT(1) DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            read_at DATETIME DEFAULT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
} else {
    echo "⏭️ Tabla 'notifications' ya existe\n";
}

// audit_logs table (handled by ensureAuditTable but do it explicitly too)
if (!tableExists($pdo, 'audit_logs')) {
    runSQL($pdo, "Crear tabla 'audit_logs'",
        "CREATE TABLE audit_logs (
            id CHAR(36) PRIMARY KEY,
            user_id VARCHAR(100) DEFAULT NULL,
            user_name VARCHAR(255) DEFAULT NULL,
            action VARCHAR(100) NOT NULL,
            entity VARCHAR(100) NOT NULL,
            entity_id CHAR(36) DEFAULT NULL,
            field_name VARCHAR(255) DEFAULT NULL,
            old_value TEXT DEFAULT NULL,
            new_value TEXT DEFAULT NULL,
            details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
} else {
    echo "⏭️ Tabla 'audit_logs' ya existe\n";
    // Drop FK if exists
    try {
        $ddl = $pdo->query("SHOW CREATE TABLE audit_logs")->fetch();
        $createSql = $ddl['Create Table'] ?? $ddl[1] ?? '';
        if (preg_match('/CONSTRAINT `([^`]+)` FOREIGN KEY \(`user_id`\)/', $createSql, $m)) {
            runSQL($pdo, "Eliminar FK constraint en audit_logs", "ALTER TABLE audit_logs DROP FOREIGN KEY `{$m[1]}`");
        }
    } catch (Exception $e) {}
}

// push_subscriptions table
if (!tableExists($pdo, 'push_subscriptions')) {
    runSQL($pdo, "Crear tabla 'push_subscriptions'",
        "CREATE TABLE push_subscriptions (
            id CHAR(36) PRIMARY KEY,
            user_id CHAR(36) NOT NULL,
            token TEXT NOT NULL,
            device_info VARCHAR(255) DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
} else {
    echo "⏭️ Tabla 'push_subscriptions' ya existe\n";
}

// bank_accounts table
if (!tableExists($pdo, 'bank_accounts')) {
    runSQL($pdo, "Crear tabla 'bank_accounts'",
        "CREATE TABLE bank_accounts (
            id CHAR(36) PRIMARY KEY,
            bank_name VARCHAR(255) NOT NULL,
            account_type VARCHAR(100) DEFAULT 'savings',
            account_number VARCHAR(100) DEFAULT NULL,
            holder_name VARCHAR(255) DEFAULT NULL,
            is_active TINYINT(1) DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
} else {
    echo "⏭️ Tabla 'bank_accounts' ya existe\n";
}

// contract_params table
if (!tableExists($pdo, 'contract_params')) {
    runSQL($pdo, "Crear tabla 'contract_params'",
        "CREATE TABLE contract_params (
            id CHAR(36) PRIMARY KEY,
            vendor_name VARCHAR(255) NOT NULL DEFAULT '',
            vendor_document VARCHAR(100) NOT NULL DEFAULT '',
            vendor_phone VARCHAR(50) DEFAULT '',
            vendor_address VARCHAR(500) DEFAULT '',
            matricula_inmobiliaria VARCHAR(100) DEFAULT '',
            porcentaje_cuota VARCHAR(20) DEFAULT '0.052%',
            ciudad VARCHAR(100) DEFAULT 'Villavicencio - Meta',
            notaria_nombre VARCHAR(255) DEFAULT '',
            notaria_ciudad VARCHAR(100) DEFAULT '',
            escritura_fecha DATE DEFAULT NULL,
            escritura_hora VARCHAR(20) DEFAULT '03:00 PM',
            titulo_propiedad TEXT,
            ultimo_numero_promesa INT DEFAULT 0,
            initial_payment_pct DECIMAL(5,2) DEFAULT 20.00,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
} else {
    echo "⏭️ Tabla 'contract_params' ya existe\n";
    // Ensure initial_payment_pct column exists if the table was created previously without it
    if (!columnExists($pdo, 'contract_params', 'initial_payment_pct')) {
        runSQL($pdo, "contract_params: agregar columna 'initial_payment_pct'", "ALTER TABLE contract_params ADD COLUMN `initial_payment_pct` DECIMAL(5,2) DEFAULT 20.00");
    }
}

// ═══════════════════════════════════════════════════════════
echo "\n=== 2. COLUMNAS NUEVAS EN TABLAS EXISTENTES ===\n\n";
// ═══════════════════════════════════════════════════════════

// --- lots table ---
$lotCols = [
    ['etapa_name', "VARCHAR(255) DEFAULT NULL"],
    ['manzana', "VARCHAR(255) DEFAULT NULL"],
    ['etapa_id', "CHAR(36) DEFAULT NULL"],
    ['block_id', "CHAR(36) DEFAULT NULL"],
    ['area', "DECIMAL(10,2) DEFAULT NULL"],
];
foreach ($lotCols as [$col, $type]) {
    if (!columnExists($pdo, 'lots', $col)) {
        runSQL($pdo, "lots: agregar columna '$col'", "ALTER TABLE lots ADD COLUMN `$col` $type");
    } else {
        echo "⏭️ lots.$col ya existe\n";
    }
}

// --- sales table ---
$salesCols = [
    ['separe_amount', "DECIMAL(15,2) DEFAULT 0"],
    ['original_price', "DECIMAL(15,2) DEFAULT NULL"],
    ['discount_amount', "DECIMAL(15,2) DEFAULT NULL"],
    ['discount_authorized_by', "CHAR(36) DEFAULT NULL"],
    ['discount_partner_name', "VARCHAR(255) DEFAULT NULL"],
    ['discount_status', "VARCHAR(50) DEFAULT 'approved'"],
    ['include_acometida', "TINYINT(1) DEFAULT 0"],
    ['acometida_value', "DECIMAL(15,2) DEFAULT 0"],
    ['acometida_paid', "TINYINT(1) DEFAULT 0"],
    ['commission_agent', "VARCHAR(255) DEFAULT NULL"],
    ['commission_agent_id', "CHAR(36) DEFAULT NULL"],
    ['commission_amount', "DECIMAL(15,2) DEFAULT NULL"],
    ['custom_plan', "JSON DEFAULT NULL"],
];
foreach ($salesCols as [$col, $type]) {
    if (!columnExists($pdo, 'sales', $col)) {
        runSQL($pdo, "sales: agregar columna '$col'", "ALTER TABLE sales ADD COLUMN `$col` $type");
    } else {
        echo "⏭️ sales.$col ya existe\n";
    }
}

// --- payments table ---
$payCols = [
    ['bank_account_id', "CHAR(36) DEFAULT NULL"],
    ['receipt_image', "TEXT DEFAULT NULL"],
];
foreach ($payCols as [$col, $type]) {
    if (!columnExists($pdo, 'payments', $col)) {
        runSQL($pdo, "payments: agregar columna '$col'", "ALTER TABLE payments ADD COLUMN `$col` $type");
    } else {
        echo "⏭️ payments.$col ya existe\n";
    }
}

// --- desistimientos table ---
if (tableExists($pdo, 'desistimientos')) {
    $desisCols = [
        ['sale_id', "CHAR(36) DEFAULT NULL"],
        ['client_document', "VARCHAR(50) DEFAULT NULL"],
        ['client_phone', "VARCHAR(50) DEFAULT NULL"],
        ['project_name', "VARCHAR(255) DEFAULT NULL"],
        ['sale_amount', "DECIMAL(15,2) NOT NULL DEFAULT 0"],
        ['sale_price', "DECIMAL(15,2) NOT NULL DEFAULT 0"],
        ['paid_amount', "DECIMAL(15,2) NOT NULL DEFAULT 0"],
        ['total_paid', "DECIMAL(15,2) NOT NULL DEFAULT 0"],
        ['amount_retained', "DECIMAL(15,2) DEFAULT 0"],
        ['penalty_amount', "DECIMAL(15,2) DEFAULT 0"],
        ['refund_amount', "DECIMAL(15,2) DEFAULT 0"],
        ['notes', "TEXT DEFAULT NULL"],
        ['registered_by', "CHAR(36) DEFAULT NULL"],
        ['created_by', "CHAR(36) DEFAULT NULL"],
    ];
    foreach ($desisCols as [$col, $type]) {
        if (!columnExists($pdo, 'desistimientos', $col)) {
            runSQL($pdo, "desistimientos: agregar columna '$col'", "ALTER TABLE desistimientos ADD COLUMN `$col` $type");
        } else {
            echo "⏭️ desistimientos.$col ya existe\n";
        }
    }
}

// --- profiles table ---
$profCols = [
    ['is_active', "TINYINT(1) DEFAULT 1"],
    ['associated_projects', "JSON DEFAULT NULL"],
    ['roles', "VARCHAR(255) DEFAULT NULL"],
];
foreach ($profCols as [$col, $type]) {
    if (!columnExists($pdo, 'profiles', $col)) {
        runSQL($pdo, "profiles: agregar columna '$col'", "ALTER TABLE profiles ADD COLUMN `$col` $type");
    } else {
        echo "⏭️ profiles.$col ya existe\n";
    }
}

// --- projects table ---
$projCols = [
    ['signature_image', "TEXT DEFAULT NULL"],
    ['signature_name', "VARCHAR(255) DEFAULT NULL"],
    ['signature_role', "VARCHAR(255) DEFAULT NULL"],
    ['logo_image', "TEXT DEFAULT NULL"],
];
foreach ($projCols as [$col, $type]) {
    if (!columnExists($pdo, 'projects', $col)) {
        runSQL($pdo, "projects: agregar columna '$col'", "ALTER TABLE projects ADD COLUMN `$col` $type");
    } else {
        echo "⏭️ projects.$col ya existe\n";
    }
}

// --- audit_logs columns ---
if (tableExists($pdo, 'audit_logs')) {
    $auditCols = [
        ['user_name', "VARCHAR(255) DEFAULT NULL"],
        ['field_name', "VARCHAR(255) DEFAULT NULL"],
        ['old_value', "TEXT DEFAULT NULL"],
        ['new_value', "TEXT DEFAULT NULL"],
    ];
    foreach ($auditCols as [$col, $type]) {
        if (!columnExists($pdo, 'audit_logs', $col)) {
            runSQL($pdo, "audit_logs: agregar columna '$col'", "ALTER TABLE audit_logs ADD COLUMN `$col` $type");
        } else {
            echo "⏭️ audit_logs.$col ya existe\n";
        }
    }
    // Make user_id nullable
    try {
        $pdo->exec("ALTER TABLE audit_logs MODIFY COLUMN user_id VARCHAR(100) DEFAULT NULL");
        echo "✅ audit_logs.user_id → nullable\n";
    } catch (Exception $e) {}
}

// ═══════════════════════════════════════════════════════════
echo "\n=== 3. RESUMEN ===\n\n";
// ═══════════════════════════════════════════════════════════

// Count tables
$tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN, 0);
echo "Total tablas en BD: " . count($tables) . "\n";
foreach ($tables as $t) {
    $count = $pdo->query("SELECT COUNT(*) FROM `$t`")->fetchColumn();
    echo "  📋 $t: $count registros\n";
}

echo "\n</pre>";
echo "<br><h3>✅ Migración completada</h3>";
echo "<p><a href='/' style='font-size:18px;'>🏡 Abrir LoteClick</a></p>";
echo "<p><small>Elimina este archivo después de usar: <code>auto_migrate.php</code></small></p>";
