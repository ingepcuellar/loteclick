<?php
/**
 * PredioClick API - Check Overdue Installments & Generate Notifications
 * Revisa cuotas vencidas y crea notificaciones automáticas
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../jwt.php';

$auth = requireAuth();
$method = getMethod();

if ($method !== 'POST') {
    jsonError('Método no permitido', 405);
}

checkOverdueInstallments();

function checkOverdueInstallments() {
    $pdo = getConnection();
    $today = date('Y-m-d');
    
    // Find overdue installments (pending, due_date < today)
    $stmt = $pdo->prepare("
        SELECT i.*, s.project_id, s.client_id, s.lot_number,
               c.name as client_name,
               p.name as project_name
        FROM installments i
        JOIN sales s ON i.sale_id = s.id
        LEFT JOIN clients c ON s.client_id = c.id
        LEFT JOIN projects p ON s.project_id = p.id
        WHERE i.status = 'pending' 
        AND i.due_date < ?
        ORDER BY i.due_date ASC
    ");
    $stmt->execute([$today]);
    $overdueInstallments = $stmt->fetchAll();
    
    $created = 0;
    $skipped = 0;
    
    foreach ($overdueInstallments as $installment) {
        // Check if notification already exists for this installment (avoid duplicates)
        $checkStmt = $pdo->prepare("
            SELECT COUNT(*) as cnt FROM notifications 
            WHERE reference_id = ? 
            AND reference_type = 'installment' 
            AND type = 'overdue_installment'
            AND created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
        ");
        $checkStmt->execute([$installment['id']]);
        $exists = $checkStmt->fetch();
        
        if ($exists['cnt'] > 0) {
            $skipped++;
            continue;
        }
        
        // Calculate days overdue
        $dueDate = new DateTime($installment['due_date']);
        $now = new DateTime($today);
        $daysOverdue = $now->diff($dueDate)->days;
        
        $amount = number_format($installment['amount'], 0, ',', '.');
        $title = "Cuota vencida — {$installment['client_name']}";
        $message = "La cuota #{$installment['installment_number']} por \${$amount} del lote {$installment['lot_number']} ({$installment['project_name']}) venció hace {$daysOverdue} día(s). Fecha de vencimiento: {$installment['due_date']}.";
        
        $id = generateUUID();
        
        // Create notification for admin
        $insertStmt = $pdo->prepare("
            INSERT INTO notifications (id, recipient_type, recipient_id, type, title, message, reference_id, reference_type)
            VALUES (?, 'admin', NULL, 'overdue_installment', ?, ?, ?, 'installment')
        ");
        $insertStmt->execute([$id, $title, $message, $installment['id']]);
        
        // Also notify partners of the project (look up real user IDs by partner name)
        $partnerStmt = $pdo->prepare("SELECT name FROM partners WHERE project_id = ?");
        $partnerStmt->execute([$installment['project_id']]);
        $projectPartners = $partnerStmt->fetchAll();
        
        foreach ($projectPartners as $partner) {
            $partnerName = $partner['name'] ?? null;
            if (!$partnerName) continue;
            // Look up real user ID by name in profiles table
            $userLookup = $pdo->prepare("SELECT id FROM profiles WHERE name = ? AND role = 'partner' LIMIT 1");
            $userLookup->execute([$partnerName]);
            $foundUser = $userLookup->fetch();
            if (!$foundUser) continue;
            
            $pid = generateUUID();
            $pInsert = $pdo->prepare("
                INSERT INTO notifications (id, recipient_type, recipient_id, type, title, message, reference_id, reference_type)
                VALUES (?, 'partner', ?, 'overdue_installment', ?, ?, ?, 'installment')
            ");
            $pInsert->execute([$pid, $foundUser['id'], $title, $message, $installment['id']]);
        }
        
        $created++;
    }
    
    jsonResponse([
        'data' => [
            'checked' => count($overdueInstallments),
            'created' => $created,
            'skipped' => $skipped
        ]
    ]);
}
