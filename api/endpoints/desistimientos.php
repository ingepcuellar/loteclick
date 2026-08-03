<?php
/**
 * LoteClick API - Desistimientos Endpoints
 *
 * POST  → Registra desistimiento + elimina venta + libera lote (en una transacción)
 * GET   → Lista todos / uno por ID / por proyecto
 * DELETE → Elimina registro de desistimiento (solo el registro, NO restaura la venta)
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../jwt.php';

$auth = requireAuth();
$action = getParam('action', '');
$method = getMethod();

// Ensure table exists with ALL required columns
try {
    $pdo = getConnection();
    $pdo->exec("CREATE TABLE IF NOT EXISTS desistimientos (
        id CHAR(36) PRIMARY KEY,
        sale_id CHAR(36) DEFAULT NULL,
        project_id CHAR(36) NOT NULL,
        client_id CHAR(36) NOT NULL,
        client_name VARCHAR(255) NOT NULL,
        client_document VARCHAR(50) DEFAULT NULL,
        client_phone VARCHAR(50) DEFAULT NULL,
        lot_id CHAR(36) NOT NULL,
        lot_number VARCHAR(50) NOT NULL,
        project_name VARCHAR(255) DEFAULT NULL,
        sale_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        sale_price DECIMAL(15,2) NOT NULL DEFAULT 0,
        paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        total_paid DECIMAL(15,2) NOT NULL DEFAULT 0,
        amount_retained DECIMAL(15,2) DEFAULT 0,
        penalty_amount DECIMAL(15,2) DEFAULT 0,
        refund_amount DECIMAL(15,2) DEFAULT 0,
        desistimiento_date DATE NOT NULL,
        reason TEXT DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        registered_by CHAR(36) DEFAULT NULL,
        created_by CHAR(36) DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
} catch (Exception $e) {}

// Add any missing columns to existing tables
$alterations = [
    "ALTER TABLE desistimientos ADD COLUMN sale_id CHAR(36) DEFAULT NULL",
    "ALTER TABLE desistimientos ADD COLUMN client_document VARCHAR(50) DEFAULT NULL",
    "ALTER TABLE desistimientos ADD COLUMN client_phone VARCHAR(50) DEFAULT NULL",
    "ALTER TABLE desistimientos ADD COLUMN project_name VARCHAR(255) DEFAULT NULL",
    "ALTER TABLE desistimientos ADD COLUMN sale_amount DECIMAL(15,2) NOT NULL DEFAULT 0",
    "ALTER TABLE desistimientos ADD COLUMN sale_price DECIMAL(15,2) NOT NULL DEFAULT 0",
    "ALTER TABLE desistimientos ADD COLUMN paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0",
    "ALTER TABLE desistimientos ADD COLUMN total_paid DECIMAL(15,2) NOT NULL DEFAULT 0",
    "ALTER TABLE desistimientos ADD COLUMN amount_retained DECIMAL(15,2) DEFAULT 0",
    "ALTER TABLE desistimientos ADD COLUMN penalty_amount DECIMAL(15,2) DEFAULT 0",
    "ALTER TABLE desistimientos ADD COLUMN refund_amount DECIMAL(15,2) DEFAULT 0",
    "ALTER TABLE desistimientos ADD COLUMN notes TEXT DEFAULT NULL",
    "ALTER TABLE desistimientos ADD COLUMN registered_by CHAR(36) DEFAULT NULL",
    "ALTER TABLE desistimientos ADD COLUMN created_by CHAR(36) DEFAULT NULL",
    "ALTER TABLE payments ADD COLUMN payment_method VARCHAR(50) DEFAULT 'cash'",
    "ALTER TABLE payments ADD COLUMN bank_account_id VARCHAR(36) DEFAULT NULL",
    "ALTER TABLE payments ADD COLUMN receipt_image TEXT DEFAULT NULL",
    "ALTER TABLE expenses ADD COLUMN sale_id VARCHAR(36) DEFAULT NULL",
    "ALTER TABLE expenses ADD COLUMN bank_account_id VARCHAR(36) DEFAULT NULL",
    "ALTER TABLE expenses ADD COLUMN payment_method VARCHAR(50) DEFAULT 'cash'",
    "ALTER TABLE expenses ADD COLUMN selected_lots TEXT DEFAULT NULL",
    "ALTER TABLE sales ADD COLUMN commission_paid_amount DECIMAL(15,2) DEFAULT 0",
    "ALTER TABLE sales ADD COLUMN commission_paid TINYINT(1) DEFAULT 0",
    "ALTER TABLE sales ADD COLUMN include_acometida TINYINT(1) DEFAULT 0",
    "ALTER TABLE sales ADD COLUMN acometida_value DECIMAL(15,2) DEFAULT 0",
    "ALTER TABLE sales ADD COLUMN acometida_paid TINYINT(1) DEFAULT 0",
    "ALTER TABLE sales ADD COLUMN discount_amount DECIMAL(15,2) DEFAULT NULL",
    "ALTER TABLE sales ADD COLUMN discount_authorized_by VARCHAR(255) DEFAULT NULL",
    "ALTER TABLE sales ADD COLUMN discount_partner_name VARCHAR(255) DEFAULT NULL",
    "ALTER TABLE sales ADD COLUMN discount_status VARCHAR(50) DEFAULT NULL",
    "ALTER TABLE sales ADD COLUMN original_price DECIMAL(15,2) DEFAULT NULL",
    "ALTER TABLE lots ADD COLUMN manzana VARCHAR(50) DEFAULT NULL",
    "ALTER TABLE lots ADD COLUMN etapa_name VARCHAR(100) DEFAULT NULL",
    "ALTER TABLE contract_params ADD COLUMN initial_payment_pct DECIMAL(5,2) DEFAULT 20",
];
try {
    $pdo = getConnection();
    foreach ($alterations as $sql) {
        try { $pdo->exec($sql); } catch (Exception $e) { /* column already exists */ }
    }
    // Ensure commission_agents table exists
    $pdo->exec("CREATE TABLE IF NOT EXISTS commission_agents (
        id CHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50) DEFAULT NULL,
        document VARCHAR(50) DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
} catch (Exception $e) {}

if ($action === 'byProject') { getByProject(); exit; }

switch ($method) {
    case 'GET':
        $id = getParam('id');
        $id ? getOne($id) : getAll();
        break;
    case 'POST':
        createDesistimiento();
        break;
    case 'PUT':
    case 'PATCH':
        $id = getParam('id');
        if (!$id) jsonError('ID requerido');
        updateDesistimiento($id);
        break;
    case 'DELETE':
        $id = getParam('id');
        if (!$id) jsonError('ID requerido');
        deleteDesistimiento($id);
        break;
    default:
        jsonError('Método no permitido', 405);
}

// ─────────────────────────────────────────────
// GET - Todos los desistimientos
// ─────────────────────────────────────────────
function getAll() {
    $pdo = getConnection();
    $stmt = $pdo->query("SELECT * FROM desistimientos ORDER BY created_at DESC");
    jsonResponse(['data' => $stmt->fetchAll()]);
}

// ─────────────────────────────────────────────
// GET - Uno por ID
// ─────────────────────────────────────────────
function getOne($id) {
    $pdo = getConnection();
    $stmt = $pdo->prepare("SELECT * FROM desistimientos WHERE id = ?");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) jsonError('Desistimiento no encontrado', 404);
    jsonResponse(['data' => $row]);
}

// ─────────────────────────────────────────────
// GET - Por proyecto
// ─────────────────────────────────────────────
function getByProject() {
    $pdo = getConnection();
    $projectId = getParam('projectId');
    if (!$projectId) jsonError('projectId requerido');
    $stmt = $pdo->prepare("SELECT * FROM desistimientos WHERE project_id = ? ORDER BY created_at DESC");
    $stmt->execute([$projectId]);
    jsonResponse(['data' => $stmt->fetchAll()]);
}

// ─────────────────────────────────────────────
// POST - Crear desistimiento (+ eliminar venta + liberar lote)
// ─────────────────────────────────────────────
function createDesistimiento() {
    global $auth;
    $pdo = getConnection();
    $body = getJsonBody();

    $saleId = $body['sale_id'] ?? $body['saleId'] ?? null;
    if (!$saleId) jsonError('sale_id requerido');

    // Obtener datos completos de la venta antes de borrarla
    $stmt = $pdo->prepare("SELECT s.*, l.number AS lot_number, l.id AS lot_id_ref,
                                   c.name AS client_name, c.document AS client_document, c.phone AS client_phone,
                                   p.name AS project_name
                            FROM sales s
                            LEFT JOIN lots     l ON l.id = s.lot_id
                            LEFT JOIN clients  c ON c.id = s.client_id
                            LEFT JOIN projects p ON p.id = s.project_id
                            WHERE s.id = ?");
    $stmt->execute([$saleId]);
    $sale = $stmt->fetch();
    if (!$sale) jsonError('Venta no encontrada', 404);

    // Calcular total pagado
    $paidStmt = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE sale_id = ?");
    $paidStmt->execute([$saleId]);
    $totalPaid = floatval($paidStmt->fetch()['total']);

    $amountRetained = isset($body['amount_retained']) ? floatval($body['amount_retained']) : $totalPaid;
    $desistimientoDate = $body['desistimiento_date'] ?? $body['date'] ?? date('Y-m-d');
    $reason = $body['reason'] ?? null;
    $notes  = $body['notes'] ?? null;
    $registeredBy = $auth['sub'] ?? null;

    $pdo->beginTransaction();
    try {
        $newId = generateUUID();

        // 1. Insertar desistimiento
        $insertStmt = $pdo->prepare(
            "INSERT INTO desistimientos
                (id, sale_id, project_id, lot_id, lot_number,
                 client_id, client_name, client_document, client_phone,
                 project_name, sale_price, sale_amount, total_paid, paid_amount, amount_retained,
                 desistimiento_date, reason, notes, registered_by, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $insertStmt->execute([
            $newId,
            $saleId,
            $sale['project_id'],
            $sale['lot_id'],
            $sale['lot_number'] ?? 0,
            $sale['client_id'],
            $sale['client_name'] ?? 'N/A',
            $sale['client_document'] ?? null,
            $sale['client_phone'] ?? null,
            $sale['project_name'] ?? 'N/A',
            floatval($sale['sale_price']),
            floatval($sale['sale_price']),
            $totalPaid,
            $totalPaid,
            $amountRetained,
            $desistimientoDate,
            $reason,
            $notes,
            $registeredBy,
            $registeredBy
        ]);

        // 2. Liberar el lote principal
        $pdo->prepare("UPDATE lots SET status = 'available' WHERE id = ?")
            ->execute([$sale['lot_id']]);

        // 3. Liberar lotes adicionales (ventas multi-lote)
        $multiLots = $pdo->prepare("SELECT lot_id FROM sale_lots WHERE sale_id = ?");
        $multiLots->execute([$saleId]);
        foreach ($multiLots->fetchAll() as $sl) {
            $pdo->prepare("UPDATE lots SET status = 'available' WHERE id = ?")
                ->execute([$sl['lot_id']]);
        }

        // 4a. Marcar la venta como desistida (conserva historial para reportes)
        $pdo->prepare("UPDATE sales SET status = 'desistida' WHERE id = ?")
            ->execute([$saleId]);

        // 4b. Marcar cuotas pagadas como pagada_desistida (las pendientes se cancelan implícitamente)
        $pdo->prepare(
            "UPDATE installments
             SET status = 'pagada_desistida'
             WHERE sale_id = ?
               AND (paid_amount > 0 OR paid_date IS NOT NULL OR status = 'pagada')"
        )->execute([$saleId]);

        // 5. Calcular monto a devolver al cliente y guardarlo en el registro
        $refundAmount = max(0, $totalPaid - $amountRetained);
        $pdo->prepare("UPDATE desistimientos SET refund_amount = ? WHERE id = ?")
            ->execute([$refundAmount, $newId]);

        // 6. Si hay monto a devolver, registrar automáticamente como gasto de devolución
        if ($refundAmount > 0) {
            $expenseId = generateUUID();
            $expenseDesc = sprintf(
                'Devolución por desistimiento - %s - Lote #%s - %s',
                $sale['client_name'] ?? 'N/A',
                $sale['lot_number'] ?? '-',
                $sale['project_name'] ?? '-'
            );
            try {
                $pdo->prepare(
                    "INSERT INTO expenses
                        (id, description, amount, expense_date, category, project_id, notes, created_by)
                     VALUES (?, ?, ?, ?, 'Devolución Desistimiento', ?, ?, ?)"
                )->execute([
                    $expenseId,
                    $expenseDesc,
                    $refundAmount,
                    $desistimientoDate,
                    $sale['project_id'],
                    'Generado automáticamente al procesar desistimiento #' . $newId,
                    $registeredBy
                ]);
            } catch (Exception $expErr) {
                // No bloquear si la tabla expenses tiene esquema diferente; el gasto se puede crear manualmente
                error_log('Warning: no se pudo crear gasto de devolución: ' . $expErr->getMessage());
            }
        }

        $pdo->commit();

        // Devolver el desistimiento creado
        $stmt = $pdo->prepare("SELECT * FROM desistimientos WHERE id = ?");
        $stmt->execute([$newId]);
        jsonResponse(['data' => $stmt->fetch()], 201);

    } catch (Exception $e) {
        $pdo->rollBack();
        jsonError('Error al registrar desistimiento: ' . $e->getMessage(), 500);
    }
}

// ─────────────────────────────────────────────
// PUT/PATCH - Editar registro de desistimiento
// ─────────────────────────────────────────────
function updateDesistimiento($id) {
    global $auth;
    $pdo = getConnection();
    $body = getJsonBody();

    $amountRetained = isset($body['amount_retained']) ? floatval($body['amount_retained']) : null;
    $desistimientoDate = $body['desistimiento_date'] ?? $body['date'] ?? null;
    $reason = $body['reason'] ?? null;
    $notes  = $body['notes'] ?? null;

    // Build update query dynamically based on provided fields
    $updates = [];
    $params = [];
    
    if ($amountRetained !== null) {
        $updates[] = "amount_retained = ?";
        $params[] = $amountRetained;
    }
    if ($desistimientoDate !== null) {
        $updates[] = "desistimiento_date = ?";
        $params[] = $desistimientoDate;
    }
    if ($reason !== null) {
        $updates[] = "reason = ?";
        $params[] = $reason;
    }
    if ($notes !== null) {
        $updates[] = "notes = ?";
        $params[] = $notes;
    }

    if (empty($updates)) {
        jsonError('No fields to update', 400);
    }

    $params[] = $id;
    $sql = "UPDATE desistimientos SET " . implode(", ", $updates) . " WHERE id = ?";
    
    $pdo->prepare($sql)->execute($params);

    $stmt = $pdo->prepare("SELECT * FROM desistimientos WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(['data' => $stmt->fetch()]);
}

// ─────────────────────────────────────────────
// DELETE - Eliminar registro de desistimiento
// ─────────────────────────────────────────────
function deleteDesistimiento($id) {
    $pdo = getConnection();
    $pdo->prepare("DELETE FROM desistimientos WHERE id = ?")->execute([$id]);
    jsonResponse(['data' => ['id' => $id, 'deleted' => true]]);
}
