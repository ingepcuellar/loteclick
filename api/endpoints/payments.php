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
    $pdo = getConnection();
    $stmt = $pdo->query("SELECT * FROM payments ORDER BY payment_date DESC");
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
    $pdo = getConnection();
    $body = getJsonBody();
    $id = generateUUID();

    $stmt = $pdo->prepare(
        "INSERT INTO payments (id, sale_id, amount, payment_date, payment_method, receipt_image, notes) 
         VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        $id,
        $body['sale_id'] ?? $body['saleId'],
        floatval($body['amount'] ?? 0),
        $body['payment_date'] ?? $body['paymentDate'] ?? date('Y-m-d'),
        $body['payment_method'] ?? $body['paymentMethod'] ?? 'cash',
        $body['receipt_image'] ?? $body['receiptImage'] ?? null,
        $body['notes'] ?? null
    ]);

    $stmt = $pdo->prepare("SELECT * FROM payments WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(['data' => $stmt->fetch()], 201);
}

function updatePayment($id) {
    $pdo = getConnection();
    $body = getJsonBody();

    $stmt = $pdo->prepare(
        "UPDATE payments SET sale_id = ?, amount = ?, payment_date = ?, payment_method = ?, receipt_image = ?, notes = ? WHERE id = ?"
    );
    $stmt->execute([
        $body['sale_id'] ?? $body['saleId'],
        floatval($body['amount'] ?? 0),
        $body['payment_date'] ?? $body['paymentDate'],
        $body['payment_method'] ?? $body['paymentMethod'] ?? 'cash',
        $body['receipt_image'] ?? $body['receiptImage'] ?? null,
        $body['notes'] ?? null,
        $id
    ]);

    $stmt = $pdo->prepare("SELECT * FROM payments WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(['data' => $stmt->fetch()]);
}

function deletePayment($id) {
    $pdo = getConnection();
    $pdo->prepare("DELETE FROM payments WHERE id = ?")->execute([$id]);
    jsonResponse(['data' => ['id' => $id, 'deleted' => true]]);
}
