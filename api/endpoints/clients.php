<?php
/**
 * PredioClick API - Clients Endpoints
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../jwt.php';

$auth = requireAuth();
$action = getParam('action', '');
$method = getMethod();

if ($action === 'search') {
    searchClients();
    exit;
}

switch ($method) {
    case 'GET':
        $id = getParam('id');
        $id ? getClient($id) : getAllClients();
        break;
    case 'POST':
        createClient();
        break;
    case 'PUT':
    case 'PATCH':
        $id = getParam('id');
        if (!$id) jsonError('ID requerido');
        updateClient($id);
        break;
    case 'DELETE':
        $id = getParam('id');
        if (!$id) jsonError('ID requerido');
        deleteClient($id);
        break;
    default:
        jsonError('Método no permitido', 405);
}

function getAllClients() {
    $pdo = getConnection();
    $stmt = $pdo->query("SELECT * FROM clients ORDER BY created_at DESC");
    jsonResponse(['data' => $stmt->fetchAll()]);
}

function getClient($id) {
    $pdo = getConnection();
    $stmt = $pdo->prepare("SELECT * FROM clients WHERE id = ?");
    $stmt->execute([$id]);
    $client = $stmt->fetch();
    if (!$client) jsonError('Cliente no encontrado', 404);
    jsonResponse(['data' => $client]);
}

function createClient() {
    $pdo = getConnection();
    $body = getJsonBody();
    $id = generateUUID();

    $stmt = $pdo->prepare(
        "INSERT INTO clients (id, name, document, phone, email, address, notes) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        $id,
        $body['name'] ?? $body['fullName'] ?? '',
        $body['document'] ?? null,
        $body['phone'] ?? null,
        $body['email'] ?? null,
        $body['address'] ?? null,
        $body['notes'] ?? null
    ]);

    $stmt = $pdo->prepare("SELECT * FROM clients WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(['data' => $stmt->fetch()], 201);
}

function updateClient($id) {
    $pdo = getConnection();
    $body = getJsonBody();

    $stmt = $pdo->prepare(
        "UPDATE clients SET name = ?, document = ?, phone = ?, email = ?, address = ?, notes = ? WHERE id = ?"
    );
    $stmt->execute([
        $body['name'] ?? $body['fullName'] ?? '',
        $body['document'] ?? null,
        $body['phone'] ?? null,
        $body['email'] ?? null,
        $body['address'] ?? null,
        $body['notes'] ?? null,
        $id
    ]);

    $stmt = $pdo->prepare("SELECT * FROM clients WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(['data' => $stmt->fetch()]);
}

function deleteClient($id) {
    $pdo = getConnection();
    $pdo->prepare("DELETE FROM clients WHERE id = ?")->execute([$id]);
    jsonResponse(['data' => ['id' => $id, 'deleted' => true]]);
}

function searchClients() {
    $pdo = getConnection();
    $q = getParam('q', '');
    if (empty($q)) {
        jsonResponse(['data' => []]);
        return;
    }

    $like = "%$q%";
    $stmt = $pdo->prepare("SELECT * FROM clients WHERE name LIKE ? OR document LIKE ? LIMIT 20");
    $stmt->execute([$like, $like]);
    jsonResponse(['data' => $stmt->fetchAll()]);
}
