<?php
/**
 * LoteClick API - Utility Registrations Endpoints
 * Matrículas de Servicios Públicos (Agua, Energía, Gas)
 * INDEPENDENT from project accounting
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../jwt.php';

$auth = requireAuth();
$action = getParam('action', '');
$method = getMethod();

if ($action === 'bySale') { getBySale(); exit; }
if ($action === 'summary') { getSummary(); exit; }

switch ($method) {
    case 'GET':
        $id = getParam('id');
        $id ? getOne($id) : getAll();
        break;
    case 'POST':
        create();
        break;
    case 'PUT':
    case 'PATCH':
        $id = getParam('id');
        if (!$id) jsonError('ID requerido');
        update($id);
        break;
    case 'DELETE':
        $id = getParam('id');
        if (!$id) jsonError('ID requerido');
        deleteRecord($id);
        break;
    default:
        jsonError('Método no permitido', 405);
}

function enrichRecord($pdo, $record) {
    // Get sale info (client + lot)
    if ($record['sale_id']) {
        $stmt = $pdo->prepare(
            "SELECT s.id, s.sale_price, s.sale_date,
                    c.id as client_id, c.name as client_name, c.document as client_document, c.phone as client_phone,
                    l.number as lot_number, l.area as lot_area,
                    p.id as project_id, p.name as project_name
             FROM sales s
             LEFT JOIN clients c ON s.client_id = c.id
             LEFT JOIN lots l ON s.lot_id = l.id
             LEFT JOIN projects p ON s.project_id = p.id
             WHERE s.id = ?"
        );
        $stmt->execute([$record['sale_id']]);
        $saleInfo = $stmt->fetch();
        if ($saleInfo) {
            $record['client'] = [
                'id' => $saleInfo['client_id'],
                'name' => $saleInfo['client_name'],
                'document' => $saleInfo['client_document'],
                'phone' => $saleInfo['client_phone'],
            ];
            $record['lot'] = [
                'number' => $saleInfo['lot_number'],
                'area' => $saleInfo['lot_area'],
            ];
            $record['project'] = [
                'id' => $saleInfo['project_id'],
                'name' => $saleInfo['project_name'],
            ];
        }
    }
    return $record;
}

function getAll() {
    $pdo = getConnection();
    $stmt = $pdo->query("SELECT * FROM utility_registrations ORDER BY created_at DESC");
    $records = $stmt->fetchAll();
    foreach ($records as &$r) { $r = enrichRecord($pdo, $r); }
    jsonResponse(['data' => $records]);
}

function getOne($id) {
    $pdo = getConnection();
    $stmt = $pdo->prepare("SELECT * FROM utility_registrations WHERE id = ?");
    $stmt->execute([$id]);
    $record = $stmt->fetch();
    if (!$record) jsonError('Registro no encontrado', 404);
    jsonResponse(['data' => enrichRecord($pdo, $record)]);
}

function getBySale() {
    $pdo = getConnection();
    $saleId = getParam('saleId');
    if (!$saleId) jsonError('saleId requerido');
    $stmt = $pdo->prepare("SELECT * FROM utility_registrations WHERE sale_id = ? ORDER BY service_type ASC");
    $stmt->execute([$saleId]);
    $records = $stmt->fetchAll();
    foreach ($records as &$r) { $r = enrichRecord($pdo, $r); }
    jsonResponse(['data' => $records]);
}

function getSummary() {
    $pdo = getConnection();
    $stmt = $pdo->query(
        "SELECT 
            COUNT(*) as total_records,
            COALESCE(SUM(amount), 0) as total_amount,
            COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as total_paid,
            COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as total_pending,
            SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count
         FROM utility_registrations"
    );
    jsonResponse(['data' => $stmt->fetch()]);
}

function create() {
    $pdo = getConnection();
    $body = getJsonBody();
    $id = generateUUID();

    $stmt = $pdo->prepare(
        "INSERT INTO utility_registrations (id, sale_id, service_type, amount, status, charge_date, paid_date, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        $id,
        $body['sale_id'] ?? $body['saleId'],
        $body['service_type'] ?? $body['serviceType'],
        floatval($body['amount'] ?? 0),
        $body['status'] ?? 'pending',
        $body['charge_date'] ?? $body['chargeDate'] ?? date('Y-m-d'),
        $body['paid_date'] ?? $body['paidDate'] ?? null,
        $body['notes'] ?? null,
        $GLOBALS['auth']['id'] ?? null
    ]);

    $stmt = $pdo->prepare("SELECT * FROM utility_registrations WHERE id = ?");
    $stmt->execute([$id]);
    $record = $stmt->fetch();
    jsonResponse(['data' => enrichRecord($pdo, $record)], 201);
}

function update($id) {
    $pdo = getConnection();
    $body = getJsonBody();

    $stmt = $pdo->prepare(
        "UPDATE utility_registrations 
         SET sale_id = ?, service_type = ?, amount = ?, status = ?, charge_date = ?, paid_date = ?, notes = ?
         WHERE id = ?"
    );
    $stmt->execute([
        $body['sale_id'] ?? $body['saleId'],
        $body['service_type'] ?? $body['serviceType'],
        floatval($body['amount'] ?? 0),
        $body['status'] ?? 'pending',
        $body['charge_date'] ?? $body['chargeDate'],
        $body['paid_date'] ?? $body['paidDate'] ?? null,
        $body['notes'] ?? null,
        $id
    ]);

    $stmt = $pdo->prepare("SELECT * FROM utility_registrations WHERE id = ?");
    $stmt->execute([$id]);
    $record = $stmt->fetch();
    jsonResponse(['data' => enrichRecord($pdo, $record)]);
}

function deleteRecord($id) {
    $pdo = getConnection();
    $pdo->prepare("DELETE FROM utility_registrations WHERE id = ?")->execute([$id]);
    jsonResponse(['data' => ['id' => $id, 'deleted' => true]]);
}
