<?php
/**
 * Migración: Corrige el constraint UNIQUE de lots
 * Cambia de UNIQUE(project_id, number) a UNIQUE(project_id, block_id, number)
 * para permitir lotes con mismo número en diferentes manzanas/etapas
 * 
 * ELIMINAR DESPUÉS DE USAR
 */
require_once __DIR__ . '/../config.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $pdo = getConnection();
    $results = [];

    // 1. List all indexes on lots table
    $stmt = $pdo->query("SHOW INDEX FROM lots");
    $indexes = $stmt->fetchAll();
    $results['current_indexes'] = array_map(function($idx) {
        return [
            'key_name' => $idx['Key_name'],
            'column' => $idx['Column_name'],
            'unique' => $idx['Non_unique'] == 0 ? 'YES' : 'NO'
        ];
    }, $indexes);

    // 2. Find and drop the problematic unique constraint
    $droppedKeys = [];
    foreach ($indexes as $idx) {
        $keyName = $idx['Key_name'];
        if ($keyName === 'PRIMARY') continue;
        
        // Drop any unique key that involves 'number' but not 'block_id'
        if ($idx['Non_unique'] == 0 && $keyName !== 'PRIMARY') {
            // Get all columns in this key
            $keyColumns = array_filter($indexes, fn($i) => $i['Key_name'] === $keyName);
            $cols = array_column($keyColumns, 'Column_name');
            
            if (in_array('number', $cols) && !in_array('block_id', $cols)) {
                try {
                    $pdo->exec("ALTER TABLE lots DROP INDEX `$keyName`");
                    $droppedKeys[] = $keyName;
                } catch(Exception $e) {
                    $results['drop_error_' . $keyName] = $e->getMessage();
                }
            }
        }
    }
    $results['dropped_keys'] = $droppedKeys;

    // 3. Create new unique constraint that includes block_id
    try {
        $pdo->exec("ALTER TABLE lots ADD UNIQUE KEY `lot_project_block_number` (project_id, block_id, number)");
        $results['new_key'] = 'lot_project_block_number (project_id, block_id, number) CREATED';
    } catch(Exception $e) {
        $results['new_key_error'] = $e->getMessage();
        // Maybe it already exists
        if (strpos($e->getMessage(), 'Duplicate') !== false) {
            $results['note'] = 'Key already exists or data has duplicates. Trying without unique...';
            try {
                $pdo->exec("ALTER TABLE lots ADD INDEX `lot_project_block_number` (project_id, block_id, number)");
                $results['fallback_key'] = 'Non-unique index created';
            } catch(Exception $e2) {
                $results['fallback_error'] = $e2->getMessage();
            }
        }
    }

    // 4. Show updated indexes
    $stmt = $pdo->query("SHOW INDEX FROM lots");
    $newIndexes = $stmt->fetchAll();
    $results['updated_indexes'] = array_map(function($idx) {
        return [
            'key_name' => $idx['Key_name'],
            'column' => $idx['Column_name'],
            'unique' => $idx['Non_unique'] == 0 ? 'YES' : 'NO'
        ];
    }, $newIndexes);

    echo json_encode([
        'success' => true,
        'message' => 'Migración de constraint lots completada',
        'details' => $results
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
