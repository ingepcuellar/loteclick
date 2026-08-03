<?php
/**
 * RESET completo de tablas para entrega limpia
 * ⚠️ ELIMINAR INMEDIATAMENTE DESPUÉS DE USAR
 * 
 * GET: muestra estado actual
 * GET ?execute=1: vacía TODAS las tablas de datos (mantiene profiles)
 */
require_once __DIR__ . '/../config.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $pdo = getConnection();
    $execute = isset($_GET['execute']) && $_GET['execute'] == '1';
    
    $tables = ['blocks', 'stages', 'lots', 'partners', 'payments', 'installments', 
               'expenses', 'sales', 'projects', 'notifications', 'audit_logs', 'desistimientos'];
    
    $counts = [];
    foreach ($tables as $t) {
        try {
            $stmt = $pdo->query("SELECT COUNT(*) as c FROM $t");
            $counts[$t] = $stmt->fetch()['c'];
        } catch(Exception $e) {
            $counts[$t] = 'tabla no existe';
        }
    }
    
    if ($execute) {
        $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");
        foreach ($tables as $t) {
            try {
                $pdo->exec("TRUNCATE TABLE $t");
            } catch(Exception $e) {
                try { $pdo->exec("DELETE FROM $t"); } catch(Exception $e2) {}
            }
        }
        $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
        
        echo json_encode([
            'success' => true,
            'message' => 'Todas las tablas vaciadas. Perfiles (usuarios) intactos.',
            'antes' => $counts
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    } else {
        // Show profiles too
        try {
            $stmt = $pdo->query("SELECT id, name, email, role FROM profiles");
            $profiles = $stmt->fetchAll();
        } catch(Exception $e) { $profiles = []; }
        
        echo json_encode([
            'mode' => 'DIAGNOSTICO (agrega ?execute=1 para vaciar todo)',
            'registros_por_tabla' => $counts,
            'usuarios' => $profiles
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
