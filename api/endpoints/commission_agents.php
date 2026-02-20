<?php
/**
 * LoteClick API - Commission Agents Endpoints
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../jwt.php';

$auth = requireAuth();
$method = getMethod();

switch ($method) {
    case 'GET':
        $id = getParam('id');
        $id ? getAgent($id) : getAllAgents();
        break;
    case 'POST':
        createAgent();
        break;
    case 'PUT':
    case 'PATCH':
        $id = getParam('id');
        if (!$id) jsonError('ID requerido');
        updateAgent($id);
        break;
    case 'DELETE':
        $id = getParam('id');
        if (!$id) jsonError('ID requerido');
        deleteAgent($id);
        break;
    default:
        jsonError('Método no válido', 405);
}

function getAllAgents() {
    $pdo = getConnection();
    $stmt = $pdo->query("SELECT * FROM commission_agents ORDER BY name ASC");
    jsonResponse(['data' => $stmt->fetchAll()]);
}

function getAgent($id) {
    $pdo = getConnection();
    $stmt = $pdo->prepare("SELECT * FROM commission_agents WHERE id = ?");
    $stmt->execute([$id]);
    $agent = $stmt->fetch();
    if (!$agent) jsonError('Comisionista no encontrado', 404);
    jsonResponse(['data' => $agent]);
}

function createAgent() {
    $pdo = getConnection();
    $body = getJsonBody();
    $id = generateUUID();

    $name = trim($body['name'] ?? '');
    if (empty($name)) jsonError('El nombre es requerido');

    // Check for duplicates
    $stmt = $pdo->prepare("SELECT id FROM commission_agents WHERE LOWER(name) = LOWER(?)");
    $stmt->execute([$name]);
    if ($stmt->fetch()) {
        jsonError('Ya existe un comisionista con ese nombre');
    }

    $stmt = $pdo->prepare(
        "INSERT INTO commission_agents (id, name, phone, document, notes) VALUES (?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        $id,
        $name,
        $body['phone'] ?? null,
        $body['document'] ?? null,
        $body['notes'] ?? null
    ]);

    $stmt = $pdo->prepare("SELECT * FROM commission_agents WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(['data' => $stmt->fetch()], 201);
}

function updateAgent($id) {
    $pdo = getConnection();
    $body = getJsonBody();

    $fields = [];
    $params = [];

    if (isset($body['name'])) { $fields[] = 'name = ?'; $params[] = trim($body['name']); }
    if (isset($body['phone'])) { $fields[] = 'phone = ?'; $params[] = $body['phone']; }
    if (isset($body['document'])) { $fields[] = 'document = ?'; $params[] = $body['document']; }
    if (isset($body['notes'])) { $fields[] = 'notes = ?'; $params[] = $body['notes']; }

    if (empty($fields)) jsonError('No hay campos para actualizar');

    $params[] = $id;
    $pdo->prepare("UPDATE commission_agents SET " . implode(', ', $fields) . " WHERE id = ?")->execute($params);

    $stmt = $pdo->prepare("SELECT * FROM commission_agents WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(['data' => $stmt->fetch()]);
}

function deleteAgent($id) {
    $pdo = getConnection();
    // Clear references in sales
    $pdo->prepare("UPDATE sales SET commission_agent_id = NULL WHERE commission_agent_id = ?")->execute([$id]);
    $pdo->prepare("DELETE FROM commission_agents WHERE id = ?")->execute([$id]);
    jsonResponse(['data' => ['id' => $id, 'deleted' => true]]);
}
