<?php
/**
 * LoteClick API - Expenses Endpoints
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../jwt.php';

$auth = requireAuth();
$action = getParam('action', '');
$method = getMethod();

// =====================================================
// AUTO-MIGRATE: Ensure all required columns exist
// This runs ONCE per request, before any logic
// =====================================================
try {
    $pdoMig = getConnection();
    $migrations = [
        "ALTER TABLE expenses ADD COLUMN sale_id VARCHAR(36) DEFAULT NULL",
        "ALTER TABLE expenses ADD COLUMN bank_account_id VARCHAR(36) DEFAULT NULL",
        "ALTER TABLE expenses ADD COLUMN payment_method VARCHAR(50) DEFAULT 'cash'",
        "ALTER TABLE expenses ADD COLUMN selected_lots TEXT DEFAULT NULL",
        "ALTER TABLE expenses ADD COLUMN partner_id VARCHAR(36) DEFAULT NULL",
        "ALTER TABLE expenses ADD COLUMN attachment TEXT DEFAULT NULL",
        "ALTER TABLE expenses ADD COLUMN notes TEXT DEFAULT NULL",
        "ALTER TABLE sales ADD COLUMN commission_paid_amount DECIMAL(15,2) DEFAULT 0",
        "ALTER TABLE sales ADD COLUMN commission_paid TINYINT(1) DEFAULT 0",
    ];
    foreach ($migrations as $sql) {
        try { $pdoMig->exec($sql); } catch (Exception $e) { /* column already exists */ }
    }
} catch (Exception $e) { /* silently ignore migration errors */ }

// =====================================================
// ROUTER
// =====================================================
if ($action === 'byProject')         { getExpensesByProject(); exit; }
if ($action === 'byCategory')        { getExpensesByCategory(); exit; }
if ($action === 'totalByProject')    { getTotalByProject(); exit; }
if ($action === 'pendingCommissions'){ getPendingCommissions(); exit; }

switch ($method) {
    case 'GET':
        $id = getParam('id');
        $id ? getExpense($id) : getAllExpenses();
        break;
    case 'POST':
        createExpense();
        break;
    case 'PUT':
    case 'PATCH':
        $id = getParam('id');
        if (!$id) jsonError('ID requerido');
        updateExpense($id);
        break;
    case 'DELETE':
        $id = getParam('id');
        if (!$id) jsonError('ID requerido');
        deleteExpense($id);
        break;
    default:
        jsonError('Método no permitido', 405);
}

// =====================================================
// HELPERS
// =====================================================

/**
 * Safely enrich expense with project name. 
 * DOES NOT try to join partners table (may not exist).
 */
function enrichExpense($pdo, $expense) {
    if (!empty($expense['project_id'])) {
        try {
            $stmt = $pdo->prepare("SELECT id, name FROM projects WHERE id = ?");
            $stmt->execute([$expense['project_id']]);
            $expense['project'] = $stmt->fetch() ?: null;
        } catch (Exception $e) {
            $expense['project'] = null;
        }
    }
    // partner_id enrichment: try, but ignore if partners table doesn't exist
    if (!empty($expense['partner_id'])) {
        try {
            // Try project_partners join table first
            $stmt = $pdo->prepare(
                "SELECT pp.id, pp.name FROM project_partners pp WHERE pp.id = ? LIMIT 1"
            );
            $stmt->execute([$expense['partner_id']]);
            $partner = $stmt->fetch();
            if (!$partner) {
                // Fallback: look in projects.partners JSON or just return id
                $expense['partner'] = ['id' => $expense['partner_id'], 'name' => 'Socio'];
            } else {
                $expense['partner'] = $partner;
            }
        } catch (Exception $e) {
            $expense['partner'] = ['id' => $expense['partner_id'], 'name' => 'Socio'];
        }
    }
    return $expense;
}

// =====================================================
// READ FUNCTIONS
// =====================================================

function getAllExpenses() {
    global $auth;
    $pdo = getConnection();
    // Auto-create table if it doesn't exist
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS expenses (
            id VARCHAR(36) PRIMARY KEY,
            project_id VARCHAR(36) DEFAULT NULL,
            partner_id VARCHAR(36) DEFAULT NULL,
            sale_id VARCHAR(36) DEFAULT NULL,
            category VARCHAR(100) DEFAULT NULL,
            description TEXT DEFAULT NULL,
            amount DECIMAL(15,2) NOT NULL DEFAULT 0,
            expense_date DATE DEFAULT NULL,
            payment_method VARCHAR(50) DEFAULT 'cash',
            bank_account_id VARCHAR(36) DEFAULT NULL,
            selected_lots TEXT DEFAULT NULL,
            attachment TEXT DEFAULT NULL,
            notes TEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )");
    } catch (Exception $e) {}

    try {
        // Ítem 5: Si el usuario es socio, solo ve gastos de sus proyectos
        $userRoles = getRolesFromAuth($auth);
        $isPartnerOnly = in_array('partner', $userRoles) && !in_array('admin', $userRoles);

        if ($isPartnerOnly) {
            $profStmt = $pdo->prepare("SELECT associated_projects FROM profiles WHERE id = ?");
            $profStmt->execute([$auth['sub'] ?? '']);
            $profile = $profStmt->fetch();
            $assocProjects = json_decode($profile['associated_projects'] ?? '[]', true) ?: [];

            if (empty($assocProjects)) {
                jsonResponse(['data' => []]);
                return;
            }
            $placeholders = implode(',', array_fill(0, count($assocProjects), '?'));
            $stmt = $pdo->prepare("SELECT * FROM expenses WHERE project_id IN ($placeholders) ORDER BY expense_date DESC");
            $stmt->execute($assocProjects);
        } else {
            $stmt = $pdo->query("SELECT * FROM expenses ORDER BY expense_date DESC");
        }

        $expenses = $stmt->fetchAll();
        foreach ($expenses as &$e) { $e = enrichExpense($pdo, $e); }
        jsonResponse(['data' => $expenses]);
    } catch (PDOException $e) {
        jsonResponse(['data' => []]);
    }
}

function getExpense($id) {
    $pdo = getConnection();
    $stmt = $pdo->prepare("SELECT * FROM expenses WHERE id = ?");
    $stmt->execute([$id]);
    $expense = $stmt->fetch();
    if (!$expense) jsonError('Gasto no encontrado', 404);
    jsonResponse(['data' => enrichExpense($pdo, $expense)]);
}

function getExpensesByProject() {
    $pdo = getConnection();
    $projectId = getParam('projectId');
    if (!$projectId) jsonError('projectId requerido');
    $stmt = $pdo->prepare("SELECT * FROM expenses WHERE project_id = ? ORDER BY expense_date DESC");
    $stmt->execute([$projectId]);
    $expenses = $stmt->fetchAll();
    foreach ($expenses as &$e) { $e = enrichExpense($pdo, $e); }
    jsonResponse(['data' => $expenses]);
}

function getExpensesByCategory() {
    $pdo = getConnection();
    $category = getParam('category');
    if (!$category) jsonError('category requerido');
    $stmt = $pdo->prepare("SELECT * FROM expenses WHERE category = ? ORDER BY expense_date DESC");
    $stmt->execute([$category]);
    $expenses = $stmt->fetchAll();
    foreach ($expenses as &$e) { $e = enrichExpense($pdo, $e); }
    jsonResponse(['data' => $expenses]);
}

function getTotalByProject() {
    $pdo = getConnection();
    $projectId = getParam('projectId');
    if (!$projectId) jsonError('projectId requerido');
    $stmt = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE project_id = ?");
    $stmt->execute([$projectId]);
    jsonResponse(['data' => floatval($stmt->fetch()['total'])]);
}

function getPendingCommissions() {
    $pdo = getConnection();

    try {
        $stmt = $pdo->query(
            "SELECT s.id as sale_id, s.project_id, s.commission_amount, s.commission_agent, s.sale_date,
                    p.name as project_name, c.name as client_name, l.number as lot_number
             FROM sales s
             JOIN projects p ON s.project_id = p.id
             JOIN clients c ON s.client_id = c.id
             JOIN lots l ON s.lot_id = l.id
             WHERE s.commission_amount > 0 AND s.commission_amount IS NOT NULL"
        );
        $sales = $stmt->fetchAll();
    } catch (Exception $e) {
        jsonResponse(['data' => []]);
        return;
    }

    $result = [];
    foreach ($sales as $sale) {
        $commTotal = floatval($sale['commission_amount']);
        $paidFromExpenses = 0;

        try {
            $expStmt = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE category = 'commissions' AND sale_id = ?");
            $expStmt->execute([$sale['sale_id']]);
            $paidFromExpenses = floatval($expStmt->fetch()['total']);
        } catch (Exception $e) {}

        if ($paidFromExpenses == 0 && !empty($sale['lot_number'])) {
            try {
                $expStmt2 = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE category = 'commissions' AND description LIKE ?");
                $expStmt2->execute(['%LOTE ' . $sale['lot_number'] . '%']);
                $paidFromExpenses = floatval($expStmt2->fetch()['total']);
            } catch (Exception $e) {}
        }

        if ($paidFromExpenses > $commTotal) $paidFromExpenses = $commTotal;

        try {
            $pdo->prepare("UPDATE sales SET commission_paid_amount = ? WHERE id = ?")->execute([$paidFromExpenses, $sale['sale_id']]);
        } catch (Exception $e) {}

        $pending = $commTotal - $paidFromExpenses;
        if ($pending > 0) {
            $sale['commission_paid_amount'] = $paidFromExpenses;
            $result[] = $sale;
        }
    }

    jsonResponse(['data' => $result]);
}

// =====================================================
// WRITE FUNCTIONS
// =====================================================

function createExpense() {
    global $auth;
    // Solo admin y partner pueden crear gastos (tesorero = solo lectura)
    $userRoles = getRolesFromAuth($auth);
    if (!array_intersect($userRoles, ['admin', 'partner'])) {
        jsonError('No tienes permiso para registrar gastos', 403);
    }

    $pdo = getConnection();
    $body = getJsonBody();

    if (empty($body)) {
        jsonError('No se recibieron datos', 400);
    }

    $id = generateUUID();

    // Safely uppercase description/notes
    if (function_exists('forceUppercase')) {
        try { forceUppercase($body, ['description', 'notes']); } catch (Exception $e) {}
    }

    $partnerId = $body['partner_id'] ?? $body['partnerId'] ?? null;
    if ($partnerId === 'office' || $partnerId === '' || $partnerId === 'null') $partnerId = null;

    $selectedLots = null;
    if (!empty($body['selected_lots'])) {
        $selectedLots = is_string($body['selected_lots']) ? $body['selected_lots'] : json_encode($body['selected_lots']);
    } elseif (!empty($body['selectedLots'])) {
        $selectedLots = is_string($body['selectedLots']) ? $body['selectedLots'] : json_encode($body['selectedLots']);
    }

    $amount     = floatval($body['amount'] ?? 0);
    $category   = $body['category'] ?? 'other';
    $projectId  = $body['project_id'] ?? $body['projectId'] ?? null;
    $description = $body['description'] ?? '';
    $expDate    = $body['expense_date'] ?? $body['date'] ?? date('Y-m-d');
    $notes      = $body['notes'] ?? null;
    $attachment = $body['attachment'] ?? null;
    $payMethod  = $body['payment_method'] ?? $body['paymentMethod'] ?? 'cash';
    $saleId     = ($category === 'commissions' && !empty($body['sale_id'])) ? $body['sale_id'] : null;
    $bankAccId  = $body['bank_account_id'] ?? $body['bankAccountId'] ?? null;

    // Validate commission amount
    if ($category === 'commissions' && !empty($saleId)) {
        try {
            $stmtCheck = $pdo->prepare("SELECT commission_amount, COALESCE(commission_paid_amount, 0) as commission_paid_amount FROM sales WHERE id = ?");
            $stmtCheck->execute([$saleId]);
            $sale = $stmtCheck->fetch();
            if ($sale) {
                $pending = floatval($sale['commission_amount']) - floatval($sale['commission_paid_amount']);
                if ($amount > $pending + 0.01) {
                    jsonError("El abono ($amount) supera el saldo pendiente de comisión (" . round($pending, 2) . ").");
                }
            }
        } catch (Exception $e) {}
    }

    // INSERT — use only columns that DEFINITELY exist after migration
    try {
        $stmt = $pdo->prepare(
            "INSERT INTO expenses 
                (id, project_id, partner_id, description, amount, category, expense_date, notes, attachment, selected_lots, payment_method, sale_id, bank_account_id) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            $id,
            $projectId,
            $partnerId,
            $description,
            $amount,
            $category,
            $expDate,
            $notes,
            $attachment,
            $selectedLots,
            $payMethod,
            $saleId,
            $bankAccId
        ]);
    } catch (PDOException $e) {
        // If still failing due to missing column, try minimal INSERT
        $msg = $e->getMessage();
        if (strpos($msg, 'Unknown column') !== false) {
            // Extract the problematic column name from error
            preg_match("/Unknown column '([^']+)'/", $msg, $matches);
            $badCol = $matches[1] ?? 'desconocida';
            // Try adding the column dynamically
            try {
                $colDef = strpos($badCol, 'amount') !== false ? "DECIMAL(15,2) DEFAULT NULL" : "TEXT DEFAULT NULL";
                $pdo->exec("ALTER TABLE expenses ADD COLUMN $badCol $colDef");
                // Retry the INSERT
                $stmt->execute([
                    $id, $projectId, $partnerId, $description, $amount, $category,
                    $expDate, $notes, $attachment, $selectedLots, $payMethod, $saleId, $bankAccId
                ]);
            } catch (Exception $e2) {
                jsonError('Error al guardar el gasto. Columna faltante: ' . $badCol . '. Detalle: ' . $e2->getMessage(), 500);
            }
        } else {
            jsonError('Error guardando gasto: ' . $msg, 500);
        }
    }

    // Handle commission partial payment tracking
    if ($category === 'commissions' && !empty($saleId)) {
        try {
            $pdo->prepare("UPDATE sales SET commission_paid_amount = COALESCE(commission_paid_amount, 0) + ? WHERE id = ?")
                ->execute([$amount, $saleId]);
        } catch (Exception $e) {}
    }

    $stmt2 = $pdo->prepare("SELECT * FROM expenses WHERE id = ?");
    $stmt2->execute([$id]);
    $expense = $stmt2->fetch();
    jsonResponse(['data' => enrichExpense($pdo, $expense)], 201);
}

function updateExpense($id) {
    global $auth;
    $userRoles = getRolesFromAuth($auth);
    if (!array_intersect($userRoles, ['admin', 'partner'])) {
        jsonError('No tienes permiso para editar gastos', 403);
    }

    $pdo = getConnection();
    $body = getJsonBody();

    if (function_exists('forceUppercase')) {
        try { forceUppercase($body, ['description', 'notes']); } catch (Exception $e) {}
    }

    $selectedLots = null;
    if (!empty($body['selected_lots'])) {
        $selectedLots = is_string($body['selected_lots']) ? $body['selected_lots'] : json_encode($body['selected_lots']);
    } elseif (!empty($body['selectedLots'])) {
        $selectedLots = is_string($body['selectedLots']) ? $body['selectedLots'] : json_encode($body['selectedLots']);
    }

    $partnerId = $body['partner_id'] ?? $body['partnerId'] ?? null;
    if ($partnerId === 'office' || $partnerId === '' || $partnerId === 'null') $partnerId = null;

    // Preserve existing attachment if not explicitly sent (Ítem 24 bug fix)
    $existingStmt = $pdo->prepare("SELECT attachment FROM expenses WHERE id = ?");
    $existingStmt->execute([$id]);
    $existing = $existingStmt->fetch();
    $attachment = array_key_exists('attachment', $body)
        ? ($body['attachment'] ?: $existing['attachment'])
        : $existing['attachment'];

    try {
        $stmt = $pdo->prepare(
            "UPDATE expenses SET 
                project_id = ?, partner_id = ?, description = ?, amount = ?, 
                category = ?, expense_date = ?, notes = ?, attachment = ?, 
                selected_lots = ?, payment_method = ?, bank_account_id = ? 
             WHERE id = ?"
        );
        $stmt->execute([
            $body['project_id'] ?? $body['projectId'] ?? null,
            $partnerId,
            $body['description'] ?? '',
            floatval($body['amount'] ?? 0),
            $body['category'] ?? 'other',
            $body['expense_date'] ?? $body['date'] ?? date('Y-m-d'),
            $body['notes'] ?? null,
            $attachment,
            $selectedLots,
            $body['payment_method'] ?? $body['paymentMethod'] ?? 'cash',
            $body['bank_account_id'] ?? $body['bankAccountId'] ?? null,
            $id
        ]);
    } catch (PDOException $e) {
        jsonError('Error actualizando gasto: ' . $e->getMessage(), 500);
    }

    $stmt2 = $pdo->prepare("SELECT * FROM expenses WHERE id = ?");
    $stmt2->execute([$id]);
    $expense = $stmt2->fetch();
    jsonResponse(['data' => enrichExpense($pdo, $expense)]);
}

function deleteExpense($id) {
    global $auth;
    $userRoles = getRolesFromAuth($auth);
    if (!array_intersect($userRoles, ['admin', 'partner'])) {
        jsonError('No tienes permiso para eliminar gastos', 403);
    }

    $pdo = getConnection();

    $expStmt = $pdo->prepare("SELECT amount, category, sale_id FROM expenses WHERE id = ?");
    $expStmt->execute([$id]);
    $expense = $expStmt->fetch();

    $pdo->prepare("DELETE FROM expenses WHERE id = ?")->execute([$id]);

    if ($expense && $expense['category'] === 'commissions' && !empty($expense['sale_id'])) {
        try {
            $sumStmt = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE sale_id = ? AND category = 'commissions'");
            $sumStmt->execute([$expense['sale_id']]);
            $newTotal = floatval($sumStmt->fetch()['total']);
            $pdo->prepare("UPDATE sales SET commission_paid_amount = ? WHERE id = ?")->execute([$newTotal, $expense['sale_id']]);
        } catch (Exception $e) {}
    }

    jsonResponse(['data' => ['id' => $id, 'deleted' => true]]);
}
