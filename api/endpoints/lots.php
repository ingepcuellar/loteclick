<?php
/**
 * LoteClick API - Individual Lot Management
 * Allows adding, updating, and deleting individual lots in an existing project.
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../jwt.php';

$auth = requireAuth();
$method = getMethod();

switch ($method) {
    case 'GET':
        $id = getParam('id');
        $projectId = getParam('projectId');
        if ($id) {
            getLot($id);
        } elseif ($projectId) {
            getLotsByProject($projectId);
        } else {
            jsonError('Se requiere id o projectId');
        }
        break;
    case 'POST':
        createLot();
        break;
    case 'PUT':
    case 'PATCH':
        $id = getParam('id');
        if (!$id) jsonError('ID requerido');
        updateLot($id);
        break;
    case 'DELETE':
        $id = getParam('id');
        if (!$id) jsonError('ID requerido');
        deleteLot($id);
        break;
    default:
        jsonError('Método no permitido', 405);
}

function getLot($id) {
    $pdo = getConnection();
    $stmt = $pdo->prepare("SELECT * FROM lots WHERE id = ?");
    $stmt->execute([$id]);
    $lot = $stmt->fetch();
    if (!$lot) jsonError('Lote no encontrado', 404);
    jsonResponse(['data' => $lot]);
}

function getLotsByProject($projectId) {
    $pdo = getConnection();
    $stmt = $pdo->prepare("SELECT * FROM lots WHERE project_id = ? ORDER BY manzana ASC, LENGTH(number) ASC, number ASC");
    $stmt->execute([$projectId]);
    jsonResponse(['data' => $stmt->fetchAll()]);
}

function createLot() {
    $pdo = getConnection();
    $body = getJsonBody();

    $projectId = $body['project_id'] ?? $body['projectId'] ?? null;
    $number    = trim($body['number'] ?? '');

    if (!$projectId) jsonError('project_id es requerido');
    if (empty($number)) jsonError('El número de lote es requerido');

    // Verify project exists
    $stmt = $pdo->prepare("SELECT id FROM projects WHERE id = ?");
    $stmt->execute([$projectId]);
    if (!$stmt->fetch()) jsonError('Proyecto no encontrado', 404);

    // Check for duplicate lot number in same project + manzana
    $manzana = !empty($body['manzana']) ? trim($body['manzana']) : null;
    $checkStmt = $pdo->prepare(
        "SELECT id FROM lots WHERE project_id = ? AND number = ? AND (manzana = ? OR (manzana IS NULL AND ? IS NULL))"
    );
    $checkStmt->execute([$projectId, $number, $manzana, $manzana]);
    if ($checkStmt->fetch()) {
        jsonError("Ya existe el lote '$number'" . ($manzana ? " en la manzana '$manzana'" : '') . " en este proyecto", 409);
    }

    $id = generateUUID();
    $blockId  = $body['block_id'] ?? $body['blockId'] ?? null;
    $area     = !empty($body['area'])  ? floatval($body['area'])  : null;
    $price    = !empty($body['price']) ? floatval($body['price']) : null;

    $pdo->prepare(
        "INSERT INTO lots (id, project_id, block_id, number, manzana, area, price, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'available')"
    )->execute([$id, $projectId, $blockId, $number, $manzana, $area, $price]);

    $stmt = $pdo->prepare("SELECT * FROM lots WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(['data' => $stmt->fetch()], 201);
}

function updateLot($id) {
    $pdo = getConnection();
    $body = getJsonBody();

    $stmt = $pdo->prepare("SELECT * FROM lots WHERE id = ?");
    $stmt->execute([$id]);
    $lot = $stmt->fetch();
    if (!$lot) jsonError('Lote no encontrado', 404);

    // Don't allow changing status of sold/pending lots via this endpoint
    if (isset($body['status']) && in_array($lot['status'], ['sold', 'pending_initial'])) {
        unset($body['status']); // Only sales/desistimientos can change status of sold lots
    }

    $fields = [];
    $params = [];

    if (isset($body['number']))  { $fields[] = 'number = ?';  $params[] = trim($body['number']); }
    if (isset($body['manzana'])) { $fields[] = 'manzana = ?'; $params[] = !empty($body['manzana']) ? trim($body['manzana']) : null; }
    if (isset($body['area']))    { $fields[] = 'area = ?';    $params[] = !empty($body['area']) ? floatval($body['area']) : null; }
    if (isset($body['price']))   { $fields[] = 'price = ?';   $params[] = !empty($body['price']) ? floatval($body['price']) : null; }
    if (isset($body['status']) && !in_array($lot['status'], ['sold', 'pending_initial'])) {
        $fields[] = 'status = ?';
        $params[] = $body['status'];
    }

    if (empty($fields)) jsonError('No hay campos para actualizar');

    $params[] = $id;
    $pdo->prepare("UPDATE lots SET " . implode(', ', $fields) . " WHERE id = ?")->execute($params);

    $stmt = $pdo->prepare("SELECT * FROM lots WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(['data' => $stmt->fetch()]);
}

function deleteLot($id) {
    $pdo = getConnection();
    $stmt = $pdo->prepare("SELECT status FROM lots WHERE id = ?");
    $stmt->execute([$id]);
    $lot = $stmt->fetch();

    if (!$lot) jsonError('Lote no encontrado', 404);

    // Cannot delete a sold lot
    if (in_array($lot['status'], ['sold', 'pending_initial'])) {
        jsonError('No se puede eliminar un lote que tiene una venta activa', 409);
    }

    $pdo->prepare("DELETE FROM lots WHERE id = ?")->execute([$id]);
    jsonResponse(['data' => ['id' => $id, 'deleted' => true]]);
}
