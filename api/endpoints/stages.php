<?php
require_once '../config.php';
require_once '../jwt.php';

$method = getMethod();
$pdo = getConnection();
$user = validateToken();

switch ($method) {
    case 'GET':
        $project_id = getParam('project_id');
        if ($project_id) {
            $stmt = $pdo->prepare("SELECT * FROM stages WHERE project_id = ? ORDER BY created_at ASC");
            $stmt->execute([$project_id]);
        } else {
            $stmt = $pdo->query("SELECT * FROM stages ORDER BY created_at ASC");
        }
        jsonResponse($stmt->fetchAll());
        break;

    case 'POST':
        $data = getJsonBody();
        if (empty($data['project_id']) || empty($data['name'])) {
            jsonError("Project ID y Name son requeridos");
        }
        
        $name = mb_strtoupper($data['name'], 'UTF-8');

        $id = generateUUID();
        $stmt = $pdo->prepare("INSERT INTO stages (id, project_id, name) VALUES (?, ?, ?)");
        $stmt->execute([$id, $data['project_id'], $name]);

        jsonResponse(['id' => $id, 'message' => 'Etapa creada correctamente'], 201);
        break;

    case 'DELETE':
        $id = getParam('id');
        if (!$id) jsonError("ID requerido");
        
        $stmt = $pdo->prepare("DELETE FROM stages WHERE id = ?");
        $stmt->execute([$id]);
        jsonResponse(['message' => 'Etapa eliminada']);
        break;

    default:
        jsonError("Method not allowed", 405);
}
