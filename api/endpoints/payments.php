<?php
/**
 * LoteClick API - Payments Endpoints
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../jwt.php';

$auth = requireAuth();
$action = getParam('action', '');
$method = getMethod();

if ($action === 'bySale') {
    getPaymentsBySale();
    exit;
}
if ($action === 'totalBySale') {
    getTotalBySale();
    exit;
}

switch ($method) {
    case 'GET':
        $id = getParam('id');
        $id ? getPayment($id) : getAllPayments();
        break;
    case 'POST':
        createPayment();
        break;
    case 'PUT':
    case 'PATCH':
        $id = getParam('id');
        if (!$id) jsonError('ID requerido');
        updatePayment($id);
        break;
    case 'DELETE':
        $id = getParam('id');
        if (!$id) jsonError('ID requerido');
        deletePayment($id);
        break;
    default:
        jsonError('Método no permitido', 405);
}

function enrichPayment($pdo, $payment) {
    $stmt = $pdo->prepare(
        "SELECT s.id, s.sale_price, 
                p.id as project_id, p.name as project_name,
                l.id as lot_id, l.number as lot_number,
                c.id as client_id, c.name as client_name
         FROM sales s
         LEFT JOIN projects p ON s.project_id = p.id
         LEFT JOIN lots l ON s.lot_id = l.id
         LEFT JOIN clients c ON s.client_id = c.id
         WHERE s.id = ?"
    );
    $stmt->execute([$payment['sale_id']]);
    $saleInfo = $stmt->fetch();

    if ($saleInfo) {
        $payment['sale'] = [
            'id' => $saleInfo['id'],
            'sale_price' => $saleInfo['sale_price'],
            'project' => ['id' => $saleInfo['project_id'], 'name' => $saleInfo['project_name']],
            'lot' => ['id' => $saleInfo['lot_id'], 'number' => $saleInfo['lot_number']],
            'client' => ['id' => $saleInfo['client_id'], 'name' => $saleInfo['client_name']]
        ];
    }

    return $payment;
}

function getAllPayments() {
    global $auth;
    $pdo = getConnection();

    // Ítem 5: Si el usuario es socio, solo ve pagos de sus proyectos
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
        $stmt = $pdo->prepare(
            "SELECT p.* FROM payments p
             JOIN sales s ON p.sale_id = s.id
             WHERE s.project_id IN ($placeholders)
             ORDER BY p.payment_date DESC"
        );
        $stmt->execute($assocProjects);
    } else {
        $stmt = $pdo->query("SELECT * FROM payments ORDER BY payment_date DESC");
    }

    $payments = $stmt->fetchAll();
    foreach ($payments as &$p) {
        $p = enrichPayment($pdo, $p);
    }
    jsonResponse(['data' => $payments]);
}

function getPayment($id) {
    $pdo = getConnection();
    $stmt = $pdo->prepare("SELECT * FROM payments WHERE id = ?");
    $stmt->execute([$id]);
    $payment = $stmt->fetch();
    if (!$payment) jsonError('Pago no encontrado', 404);
    jsonResponse(['data' => enrichPayment($pdo, $payment)]);
}

function getPaymentsBySale() {
    $pdo = getConnection();
    $saleId = getParam('saleId');
    if (!$saleId) jsonError('saleId requerido');

    $stmt = $pdo->prepare("SELECT * FROM payments WHERE sale_id = ? ORDER BY payment_date DESC");
    $stmt->execute([$saleId]);
    jsonResponse(['data' => $stmt->fetchAll()]);
}

function getTotalBySale() {
    $pdo = getConnection();
    $saleId = getParam('saleId');
    if (!$saleId) jsonError('saleId requerido');

    $stmt = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE sale_id = ?");
    $stmt->execute([$saleId]);
    $result = $stmt->fetch();
    jsonResponse(['data' => floatval($result['total'])]);
}

function createPayment() {
    global $auth;
    // Solo admin y partner pueden crear pagos (tesorero = solo lectura)
    $userRoles = getRolesFromAuth($auth);
    $canCreate = array_intersect($userRoles, ['admin', 'partner']);
    if (empty($canCreate)) jsonError('No tienes permiso para registrar pagos', 403);

    $pdo = getConnection();
    $body = getJsonBody();
    $id = generateUUID();

    forceUppercase($body, ['notes']);

    $stmt = $pdo->prepare(
        "INSERT INTO payments (id, sale_id, amount, payment_date, payment_method, bank_account_id, receipt_image, notes) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        $id,
        $body['sale_id'] ?? $body['saleId'],
        floatval($body['amount'] ?? 0),
        $body['payment_date'] ?? $body['paymentDate'] ?? date('Y-m-d'),
        $body['payment_method'] ?? $body['paymentMethod'] ?? 'cash',
        $body['bank_account_id'] ?? $body['bankAccountId'] ?? null,
        $body['receipt_image'] ?? $body['receiptImage'] ?? null,
        $body['notes'] ?? null
    ]);

    $stmt = $pdo->prepare("SELECT * FROM payments WHERE id = ?");
    $stmt->execute([$id]);
    $payment = $stmt->fetch();

    global $auth;
    $userName = $auth['name'] ?? $auth['email'] ?? 'Sistema';
    $saleId   = $body['sale_id'] ?? $body['saleId'] ?? '';
    logAudit($auth['sub'] ?? '', $userName, 'create', 'payment', $id, null, null, null,
        'Pago registrado: $' . number_format(floatval($body['amount'] ?? 0), 0, '.', '.') . ' — Venta ' . substr($saleId, 0, 8));

    jsonResponse(['data' => $payment], 201);
}

function updatePayment($id) {
    global $auth;
    $userRoles = getRolesFromAuth($auth);
    $canEdit = array_intersect($userRoles, ['admin', 'partner']);
    if (empty($canEdit)) jsonError('No tienes permiso para editar pagos', 403);

    $pdo = getConnection();
    $body = getJsonBody();

    forceUppercase($body, ['notes']);

    // Preserve existing receipt_image if not explicitly sent (Ítem 24 bug fix)
    $existingStmt = $pdo->prepare("SELECT receipt_image FROM payments WHERE id = ?");
    $existingStmt->execute([$id]);
    $existing = $existingStmt->fetch();
    $receiptImage = array_key_exists('receipt_image', $body)
        ? ($body['receipt_image'] ?: $existing['receipt_image'])
        : (array_key_exists('receiptImage', $body)
            ? ($body['receiptImage'] ?: $existing['receipt_image'])
            : $existing['receipt_image']);

    $stmt = $pdo->prepare(
        "UPDATE payments SET sale_id = ?, amount = ?, payment_date = ?, payment_method = ?, bank_account_id = ?, receipt_image = ?, notes = ? WHERE id = ?"
    );
    $stmt->execute([
        $body['sale_id'] ?? $body['saleId'],
        floatval($body['amount'] ?? 0),
        $body['payment_date'] ?? $body['paymentDate'],
        $body['payment_method'] ?? $body['paymentMethod'] ?? 'cash',
        $body['bank_account_id'] ?? $body['bankAccountId'] ?? null,
        $receiptImage,
        $body['notes'] ?? null,
        $id
    ]);

    $stmt = $pdo->prepare("SELECT * FROM payments WHERE id = ?");
    $stmt->execute([$id]);
    $updated = $stmt->fetch();

    $userName = $auth['name'] ?? $auth['email'] ?? 'Sistema';
    logAudit($auth['sub'] ?? '', $userName, 'update', 'payment', $id, 'amount',
        null, number_format(floatval($body['amount'] ?? 0), 0, '.', '.'), 'Pago editado');

    jsonResponse(['data' => $updated]);
}

function deletePayment($id) {
    global $auth;
    $userRoles = getRolesFromAuth($auth);
    $canDelete = array_intersect($userRoles, ['admin', 'partner']);
    if (empty($canDelete)) jsonError('No tienes permiso para eliminar pagos', 403);

    $pdo = getConnection();
    $userName = $auth['name'] ?? $auth['email'] ?? 'Sistema';
    logAudit($auth['sub'] ?? '', $userName, 'delete', 'payment', $id, null, null, null, 'Pago eliminado');
    $pdo->prepare("DELETE FROM payments WHERE id = ?")->execute([$id]);
    jsonResponse(['data' => ['id' => $id, 'deleted' => true]]);
}
