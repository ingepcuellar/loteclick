<?php
/**
 * LoteClick API - Partner Disbursements Endpoints
 * Entregas de dinero a socios
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../jwt.php';

$auth = requireAuth();
$action = getParam('action', '');
$method = getMethod();

if ($action === 'byProject') { getByProject(); exit; }
if ($action === 'byPartner') { getByPartner(); exit; }

switch ($method) {
    case 'GET':
        $id = getParam('id');
        $id ? getDisbursement($id) : getAllDisbursements();
        break;
    case 'POST':
        createDisbursement();
        break;
    case 'PUT':
    case 'PATCH':
        $id = getParam('id');
        if (!$id) jsonError('ID requerido');
        updateDisbursement($id);
        break;
    case 'DELETE':
        $id = getParam('id');
        if (!$id) jsonError('ID requerido');
        deleteDisbursement($id);
        break;
    default:
        jsonError('Método no permitido', 405);
}

function enrichDisbursement($pdo, $d) {
    if ($d['project_id']) {
        $stmt = $pdo->prepare("SELECT id, name FROM projects WHERE id = ?");
        $stmt->execute([$d['project_id']]);
        $d['project'] = $stmt->fetch() ?: null;
    }
    if ($d['partner_id']) {
        $stmt = $pdo->prepare("SELECT id, name, document, phone FROM partners WHERE id = ?");
        $stmt->execute([$d['partner_id']]);
        $d['partner'] = $stmt->fetch() ?: null;
    }
    return $d;
}

function getAllDisbursements() {
    $pdo = getConnection();
    $stmt = $pdo->query("SELECT * FROM partner_disbursements ORDER BY disbursement_date DESC");
    $items = $stmt->fetchAll();
    foreach ($items as &$d) { $d = enrichDisbursement($pdo, $d); }
    jsonResponse(['data' => $items]);
}

function getDisbursement($id) {
    $pdo = getConnection();
    $stmt = $pdo->prepare("SELECT * FROM partner_disbursements WHERE id = ?");
    $stmt->execute([$id]);
    $d = $stmt->fetch();
    if (!$d) jsonError('Entrega no encontrada', 404);
    jsonResponse(['data' => enrichDisbursement($pdo, $d)]);
}

function getByProject() {
    $pdo = getConnection();
    $projectId = getParam('projectId');
    if (!$projectId) jsonError('projectId requerido');
    $stmt = $pdo->prepare("SELECT * FROM partner_disbursements WHERE project_id = ? ORDER BY disbursement_date DESC");
    $stmt->execute([$projectId]);
    $items = $stmt->fetchAll();
    foreach ($items as &$d) { $d = enrichDisbursement($pdo, $d); }
    jsonResponse(['data' => $items]);
}

function getByPartner() {
    $pdo = getConnection();
    $partnerId = getParam('partnerId');
    if (!$partnerId) jsonError('partnerId requerido');
    $stmt = $pdo->prepare("SELECT * FROM partner_disbursements WHERE partner_id = ? ORDER BY disbursement_date DESC");
    $stmt->execute([$partnerId]);
    $items = $stmt->fetchAll();
    foreach ($items as &$d) { $d = enrichDisbursement($pdo, $d); }
    jsonResponse(['data' => $items]);
}

function createDisbursement() {
    global $auth;
    $pdo = getConnection();
    $body = getJsonBody();
    $id = generateUUID();

    $stmt = $pdo->prepare(
        "INSERT INTO partner_disbursements (id, project_id, partner_id, amount, disbursement_date, receipt_image, signature_image, notes, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        $id,
        $body['project_id'] ?? $body['projectId'],
        $body['partner_id'] ?? $body['partnerId'],
        floatval($body['amount'] ?? 0),
        $body['disbursement_date'] ?? $body['disbursementDate'] ?? date('Y-m-d'),
        $body['receipt_image'] ?? $body['receiptImage'] ?? null,
        $body['signature_image'] ?? $body['signatureImage'] ?? null,
        $body['notes'] ?? null,
        $auth['sub'] ?? null
    ]);

    $stmt = $pdo->prepare("SELECT * FROM partner_disbursements WHERE id = ?");
    $stmt->execute([$id]);
    $d = $stmt->fetch();
    jsonResponse(['data' => enrichDisbursement($pdo, $d)], 201);
}

function updateDisbursement($id) {
    $pdo = getConnection();
    $body = getJsonBody();

    $stmt = $pdo->prepare(
        "UPDATE partner_disbursements SET project_id = ?, partner_id = ?, amount = ?, disbursement_date = ?, 
         receipt_image = ?, signature_image = ?, notes = ? WHERE id = ?"
    );
    $stmt->execute([
        $body['project_id'] ?? $body['projectId'],
        $body['partner_id'] ?? $body['partnerId'],
        floatval($body['amount'] ?? 0),
        $body['disbursement_date'] ?? $body['disbursementDate'],
        $body['receipt_image'] ?? $body['receiptImage'] ?? null,
        $body['signature_image'] ?? $body['signatureImage'] ?? null,
        $body['notes'] ?? null,
        $id
    ]);

    $stmt = $pdo->prepare("SELECT * FROM partner_disbursements WHERE id = ?");
    $stmt->execute([$id]);
    $d = $stmt->fetch();
    jsonResponse(['data' => enrichDisbursement($pdo, $d)]);
}

function deleteDisbursement($id) {
    $pdo = getConnection();
    $pdo->prepare("DELETE FROM partner_disbursements WHERE id = ?")->execute([$id]);
    jsonResponse(['data' => ['id' => $id, 'deleted' => true]]);
}
