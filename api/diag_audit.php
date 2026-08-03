<?php
/**
 * Diagnostic script for audit_logs table and logAudit function
 * Access: /api/diag_audit.php
 */
require_once __DIR__ . '/config.php';

header('Content-Type: text/plain; charset=utf-8');

echo "=== DIAGNÓSTICO AUDITORÍA ===\n\n";

try {
    $pdo = getConnection();
    echo "✅ Conexión a BD OK\n\n";
} catch (Exception $e) {
    echo "❌ Error de conexión: " . $e->getMessage() . "\n";
    exit;
}

// 1. Check if table exists
echo "--- 1. ¿Existe la tabla audit_logs? ---\n";
try {
    $result = $pdo->query("SHOW TABLES LIKE 'audit_logs'")->fetch();
    if ($result) {
        echo "✅ Tabla audit_logs EXISTE\n\n";
    } else {
        echo "❌ Tabla audit_logs NO EXISTE. Creándola...\n";
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        echo "✅ Tabla creada\n\n";
    }
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n\n";
}

// 2. Show columns
echo "--- 2. Columnas actuales ---\n";
try {
    $cols = $pdo->query("SHOW COLUMNS FROM audit_logs")->fetchAll();
    foreach ($cols as $col) {
        echo "  - {$col['Field']} ({$col['Type']}) {$col['Null']} {$col['Default']}\n";
    }
    echo "\n";
    
    $colNames = array_column($cols, 'Field');
    $needed = ['user_name', 'field_name', 'old_value', 'new_value'];
    $missing = array_diff($needed, $colNames);
    
    if (empty($missing)) {
        echo "✅ Todas las columnas requeridas existen\n\n";
    } else {
        echo "❌ Columnas FALTANTES: " . implode(', ', $missing) . "\n";
        echo "   Agregándolas ahora...\n";
        foreach ($missing as $col) {
            $type = ($col === 'old_value' || $col === 'new_value' || $col === 'details') ? 'TEXT' : 'VARCHAR(255)';
            try {
                $pdo->exec("ALTER TABLE audit_logs ADD COLUMN `$col` $type DEFAULT NULL");
                echo "   ✅ Columna $col agregada\n";
            } catch (Exception $e) {
                echo "   ❌ Error agregando $col: " . $e->getMessage() . "\n";
            }
        }
        echo "\n";
    }
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n\n";
}

// 3. Try inserting a test record
echo "--- 3. Prueba de INSERT ---\n";
try {
    $testId = generateUUID();
    $stmt = $pdo->prepare(
        "INSERT INTO audit_logs (id, user_id, user_name, action, entity, entity_id, field_name, old_value, new_value, details) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        $testId, 'diag-test', 'Diagnóstico', 'create', 'test', 'test-entity-001', 
        'test_field', 'valor_anterior', 'valor_nuevo', 'Registro de prueba desde diagnóstico'
    ]);
    echo "✅ INSERT exitoso (id: $testId)\n\n";
} catch (Exception $e) {
    echo "❌ Error INSERT: " . $e->getMessage() . "\n\n";
}

// 4. Read back
echo "--- 4. Lectura de registros ---\n";
try {
    $stmt = $pdo->query("SELECT COUNT(*) as total FROM audit_logs");
    $count = $stmt->fetch()['total'];
    echo "Total registros en audit_logs: $count\n";
    
    $stmt = $pdo->query("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 5");
    $rows = $stmt->fetchAll();
    foreach ($rows as $row) {
        echo "  [{$row['created_at']}] {$row['user_name']} - {$row['action']} - {$row['entity']} - {$row['details']}\n";
    }
    echo "\n";
} catch (Exception $e) {
    echo "❌ Error lectura: " . $e->getMessage() . "\n\n";
}

// 5. Test logAudit function
echo "--- 5. Prueba de logAudit() ---\n";
try {
    logAudit('diag-user', 'DiagScript', 'create', 'diagnostic', 'diag-001', null, null, null, 'Test desde logAudit function');
    echo "✅ logAudit() ejecutado sin errores\n";
    
    // Verify it was inserted
    $stmt = $pdo->prepare("SELECT * FROM audit_logs WHERE entity = 'diagnostic' ORDER BY created_at DESC LIMIT 1");
    $stmt->execute();
    $row = $stmt->fetch();
    if ($row) {
        echo "✅ Registro encontrado: {$row['details']}\n";
    } else {
        echo "❌ logAudit() NO insertó el registro\n";
    }
} catch (Exception $e) {
    echo "❌ Error logAudit: " . $e->getMessage() . "\n";
}

// 6. Check foreign key constraint
echo "\n--- 6. Verificar FK constraint ---\n";
try {
    $stmt = $pdo->query("SHOW CREATE TABLE audit_logs");
    $create = $stmt->fetch();
    $ddl = $create['Create Table'] ?? $create[1] ?? '';
    if (strpos($ddl, 'FOREIGN KEY') !== false) {
        echo "⚠️ La tabla tiene FOREIGN KEY constraint:\n";
        echo "   $ddl\n";
        echo "   Esto puede causar que INSERT falle si user_id no existe en profiles\n";
    } else {
        echo "✅ Sin FK constraints problemáticos\n";
    }
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}

echo "\n=== FIN DIAGNÓSTICO ===\n";
