<?php
/**
 * Script de reparación de comisiones corruptas
 * 
 * USO: 
 *   Diagnóstico: GET /api/endpoints/fix_commissions.php
 *   Ejecutar:    GET /api/endpoints/fix_commissions.php?execute=1
 */
error_reporting(E_ALL);
ini_set('display_errors', 0);

require_once __DIR__ . '/../config.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

try {
    $execute = isset($_GET['execute']) && $_GET['execute'] == '1';
    $pdo = getConnection();
    $results = [];

    // Ensure sale_id column exists on expenses
    try { 
        $pdo->exec("ALTER TABLE expenses ADD COLUMN sale_id VARCHAR(36) DEFAULT NULL"); 
    } catch(Exception $e) { 
        // Column already exists, that's fine
    }

    // 1. Find all sales with commissions
    $stmt = $pdo->query(
        "SELECT s.id, s.commission_amount, s.commission_paid_amount, s.commission_agent, s.lot_id,
                l.number as lot_number
         FROM sales s
         LEFT JOIN lots l ON s.lot_id = l.id
         WHERE s.commission_amount > 0"
    );
    $sales = $stmt->fetchAll();

    foreach ($sales as $sale) {
        $saleId = $sale['id'];
        $commissionTotal = floatval($sale['commission_amount']);
        $currentPaid = floatval($sale['commission_paid_amount'] ?? 0);
        $lotNumber = $sale['lot_number'] ?? '';
        $agent = $sale['commission_agent'] ?? '';

        // 2. Find commission expenses linked to this sale
        // Strategy: try sale_id first, then match by description containing lot number
        $expenses = [];
        
        // Try by sale_id
        try {
            $expStmt = $pdo->prepare(
                "SELECT id, amount, description, expense_date FROM expenses 
                 WHERE category = 'commissions' AND sale_id = ?
                 ORDER BY expense_date ASC"
            );
            $expStmt->execute([$saleId]);
            $expenses = $expStmt->fetchAll();
        } catch(Exception $e) {}

        // If no results by sale_id, try matching by lot number in description
        if (empty($expenses) && $lotNumber) {
            $expStmt = $pdo->prepare(
                "SELECT id, amount, description, expense_date FROM expenses 
                 WHERE category = 'commissions' AND description LIKE ?
                 ORDER BY expense_date ASC"
            );
            $expStmt->execute(['%LOTE ' . $lotNumber . '%']);
            $expenses = $expStmt->fetchAll();
            
            // Also try without "LOTE" prefix
            if (empty($expenses)) {
                $expStmt->execute(['%LOTE ' . $lotNumber . '%']);
                $expenses = $expStmt->fetchAll();
            }
        }

        $totalExpenses = 0;
        foreach ($expenses as $exp) {
            $totalExpenses += floatval($exp['amount']);
        }

        $isCorrupted = $totalExpenses > $commissionTotal;
        
        $saleInfo = [
            'sale_id' => $saleId,
            'agent' => $agent,
            'lot_number' => $lotNumber,
            'commission_total' => $commissionTotal,
            'commission_paid_db' => $currentPaid,
            'expenses_sum' => $totalExpenses,
            'expenses_count' => count($expenses),
            'is_corrupted' => $isCorrupted,
            'excess' => $isCorrupted ? ($totalExpenses - $commissionTotal) : 0,
        ];

        if ($isCorrupted && $execute) {
            // Keep earliest expenses that sum <= commission_amount, delete the rest
            $runningTotal = 0;
            $keepIds = [];
            $deleteIds = [];
            
            foreach ($expenses as $exp) {
                $expAmount = floatval($exp['amount']);
                if ($runningTotal + $expAmount <= $commissionTotal) {
                    $runningTotal += $expAmount;
                    $keepIds[] = $exp['id'];
                } else {
                    $deleteIds[] = ['id' => $exp['id'], 'amount' => $expAmount, 'desc' => $exp['description']];
                }
            }
            
            // Delete excess expenses
            foreach ($deleteIds as $del) {
                $pdo->prepare("DELETE FROM expenses WHERE id = ?")->execute([$del['id']]);
            }
            
            // Recalculate commission_paid_amount
            $pdo->prepare("UPDATE sales SET commission_paid_amount = ? WHERE id = ?")->execute([$runningTotal, $saleId]);
            
            $saleInfo['fixed'] = true;
            $saleInfo['kept'] = count($keepIds);
            $saleInfo['deleted'] = $deleteIds;
            $saleInfo['new_paid_amount'] = $runningTotal;
        } elseif (!$isCorrupted && $execute) {
            // Sync commission_paid_amount with actual expenses
            if (abs($currentPaid - $totalExpenses) > 0.01) {
                $pdo->prepare("UPDATE sales SET commission_paid_amount = ? WHERE id = ?")->execute([$totalExpenses, $saleId]);
                $saleInfo['synced'] = $totalExpenses;
            }
        }

        $results[] = $saleInfo;
    }

    $corruptedCount = 0;
    foreach ($results as $r) {
        if ($r['is_corrupted']) $corruptedCount++;
    }

    echo json_encode([
        'mode' => $execute ? 'EJECUTADO' : 'DIAGNOSTICO (agrega ?execute=1 para corregir)',
        'total_ventas_con_comision' => count($results),
        'ventas_corruptas' => $corruptedCount,
        'detalles' => $results,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ], JSON_PRETTY_PRINT);
}
