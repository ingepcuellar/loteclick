<?php
/**
 * LoteClick — Migración v12
 * Soporte para desistimientos sin DELETE
 * Agrega columna status a sales e installments para conservar historial.
 *
 * SEGURA: Solo agrega columnas/índices nuevos, no modifica datos existentes.
 * Ejecutar UNA sola vez en producción.
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../jwt.php';

$auth = requireAuth();
// Solo admins pueden ejecutar migraciones
if (($auth['role'] ?? '') !== 'admin') {
    jsonError('Solo administradores pueden ejecutar migraciones', 403);
}

$pdo = getConnection();
$results = [];

$migrations = [
    // 1. Columna status en sales
    'sales_status_column' => "ALTER TABLE sales
        ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active'
        COMMENT 'active | desistida | completada'",

    // 2. Columna status en installments
    'installments_status_column' => "ALTER TABLE installments
        ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'pendiente'
        COMMENT 'pendiente | pagada | pagada_desistida'",

    // 3. Índice en sales.status para performance en reportes
    'sales_status_index' => "ALTER TABLE sales ADD INDEX idx_sale_status (status)",

    // 4. Índice en installments.status
    'installments_status_index' => "ALTER TABLE installments ADD INDEX idx_inst_status (status)",
];

foreach ($migrations as $name => $sql) {
    try {
        $pdo->exec($sql);
        $results[$name] = 'OK — aplicado';
    } catch (Exception $e) {
        // Si el error es porque ya existe la columna/índice, es OK
        $msg = $e->getMessage();
        if (
            str_contains($msg, 'Duplicate column') ||
            str_contains($msg, 'already exists') ||
            str_contains($msg, "Duplicate key name")
        ) {
            $results[$name] = 'SKIP — ya existía';
        } else {
            $results[$name] = 'ERROR — ' . $msg;
        }
    }
}

// 5. Sincronizar cuotas ya pagadas al nuevo sistema de estados
// Solo actualiza las que tienen paid=1 o paid_at IS NOT NULL y aún están en 'pendiente'
try {
    $updated = $pdo->exec(
        "UPDATE installments
         SET status = 'pagada'
         WHERE (paid_amount > 0 OR paid_date IS NOT NULL)
           AND status = 'pendiente'"
    );
    $results['sync_paid_installments'] = "OK — {$updated} cuotas sincronizadas como 'pagada'";
} catch (Exception $e) {
    $results['sync_paid_installments'] = 'ERROR — ' . $e->getMessage();
}

// Verificación final: contar registros por estado
$verification = [];
try {
    $stmt = $pdo->query("SELECT status, COUNT(*) as total FROM sales GROUP BY status");
    $verification['sales'] = $stmt->fetchAll();
} catch (Exception $e) {
    $verification['sales'] = 'ERROR: ' . $e->getMessage();
}
try {
    $stmt = $pdo->query("SELECT status, COUNT(*) as total FROM installments GROUP BY status");
    $verification['installments'] = $stmt->fetchAll();
} catch (Exception $e) {
    $verification['installments'] = 'ERROR: ' . $e->getMessage();
}

jsonResponse([
    'data' => [
        'migration' => 'v12',
        'description' => 'Soporte para desistimientos sin DELETE — columnas status agregadas',
        'results' => $results,
        'verification' => $verification,
    ]
]);
