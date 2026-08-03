<?php
/**
 * Script de limpieza de datos huérfanos
 * Elimina stages, blocks, lots y otros datos sin proyecto padre
 * 
 * GET: diagnóstico
 * GET ?execute=1: ejecutar limpieza
 * 
 * ELIMINAR DESPUÉS DE USAR
 */
require_once __DIR__ . '/../config.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $pdo = getConnection();
    $execute = isset($_GET['execute']) && $_GET['execute'] == '1';
    $results = [];

    // Orphan stages (no matching project)
    $stmt = $pdo->query("SELECT COUNT(*) as c FROM stages WHERE project_id NOT IN (SELECT id FROM projects)");
    $orphanStages = $stmt->fetch()['c'];
    $results['orphan_stages'] = $orphanStages;

    // Orphan blocks (no matching stage)
    $stmt = $pdo->query("SELECT COUNT(*) as c FROM blocks WHERE stage_id NOT IN (SELECT id FROM stages)");
    $orphanBlocks = $stmt->fetch()['c'];
    $results['orphan_blocks'] = $orphanBlocks;

    // Orphan lots (no matching project)
    $stmt = $pdo->query("SELECT COUNT(*) as c FROM lots WHERE project_id NOT IN (SELECT id FROM projects)");
    $orphanLots = $stmt->fetch()['c'];
    $results['orphan_lots'] = $orphanLots;

    // Orphan partners
    $stmt = $pdo->query("SELECT COUNT(*) as c FROM partners WHERE project_id NOT IN (SELECT id FROM projects)");
    $orphanPartners = $stmt->fetch()['c'];
    $results['orphan_partners'] = $orphanPartners;

    // Orphan sales
    $stmt = $pdo->query("SELECT COUNT(*) as c FROM sales WHERE project_id NOT IN (SELECT id FROM projects)");
    $orphanSales = $stmt->fetch()['c'];
    $results['orphan_sales'] = $orphanSales;

    // ALL remaining data
    $results['total_projects'] = $pdo->query("SELECT COUNT(*) as c FROM projects")->fetch()['c'];
    $results['total_stages'] = $pdo->query("SELECT COUNT(*) as c FROM stages")->fetch()['c'];
    $results['total_blocks'] = $pdo->query("SELECT COUNT(*) as c FROM blocks")->fetch()['c'];
    $results['total_lots'] = $pdo->query("SELECT COUNT(*) as c FROM lots")->fetch()['c'];
    $results['total_profiles'] = $pdo->query("SELECT COUNT(*) as c FROM profiles")->fetch()['c'];

    if ($execute) {
        $pdo->exec("DELETE FROM blocks WHERE stage_id NOT IN (SELECT id FROM stages)");
        $pdo->exec("DELETE FROM stages WHERE project_id NOT IN (SELECT id FROM projects)");
        $pdo->exec("DELETE FROM lots WHERE project_id NOT IN (SELECT id FROM projects)");
        $pdo->exec("DELETE FROM partners WHERE project_id NOT IN (SELECT id FROM projects)");
        // Don't delete orphan sales automatically - too risky
        $results['cleaned'] = true;
    }

    echo json_encode([
        'mode' => $execute ? 'EJECUTADO' : 'DIAGNOSTICO (agrega ?execute=1)',
        'data' => $results
    ], JSON_PRETTY_PRINT);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
