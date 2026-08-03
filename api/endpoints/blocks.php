<?php
require_once '../config.php';
require_once '../jwt.php';

$method = getMethod();
$pdo = getConnection();
$user = validateToken();

switch ($method) {
    case 'GET':
        $stage_id = getParam('stage_id');
        if ($stage_id) {
            $stmt = $pdo->prepare("SELECT * FROM blocks WHERE stage_id = ? ORDER BY created_at ASC");
            $stmt->execute([$stage_id]);
        } else {
            $stmt = $pdo->query("SELECT * FROM blocks ORDER BY created_at ASC");
        }
        jsonResponse($stmt->fetchAll());
        break;

    case 'POST':
        $data = getJsonBody();
        if (empty($data['stage_id']) || empty($data['name'])) {
            jsonError("Stage ID y Name son requeridos");
        }
        
        $name = mb_strtoupper($data['name'], 'UTF-8');

        $id = generateUUID();
        $stmt = $pdo->prepare("INSERT INTO blocks (id, stage_id, name) VALUES (?, ?, ?)");
        $stmt->execute([$id, $data['stage_id'], $name]);

        jsonResponse(['id' => $id, 'message' => 'Manzana creada correctamente'], 201);
        break;

    case 'DELETE':
        $id = getParam('id');
        if (!$id) jsonError("ID requerido");
        
        $stmt = $pdo->prepare("DELETE FROM blocks WHERE id = ?");
        $stmt->execute([$id]);
        jsonResponse(['message' => 'Manzana eliminada']);
        break;

    default:
        jsonError("Method not allowed", 405);
}
