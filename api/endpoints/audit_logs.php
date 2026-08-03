<?php
/**
 * LoteClick API - Audit Logs Endpoints
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../jwt.php';

$auth = requireAuth();
$action = getParam('action', '');
$method = getMethod();

if ($action === 'byEntity') { getByEntity(); exit; }

switch ($method) {
    case 'GET':
        getAllLogs();
        break;
    case 'POST':
        createLog();
        break;
    default:
        jsonError('Método no permitido', 405);
}

function getAllLogs() {
    $pdo = getConnection();
    $entity = getParam('entity');
    $entityId = getParam('entityId');
    $limit = intval(getParam('limit', 50));
    
    $sql = "SELECT * FROM audit_logs WHERE 1=1";
    $params = [];
    
    if ($entity) {
        $sql .= " AND entity = ?";
        $params[] = $entity;
    }
    if ($entityId) {
        $sql .= " AND entity_id = ?";
        $params[] = $entityId;
    }
    
    $sql .= " ORDER BY created_at DESC LIMIT " . min($limit, 200);
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    jsonResponse(['data' => $stmt->fetchAll()]);
}

function getByEntity() {
    $pdo = getConnection();
    $entity = getParam('entity');
    $entityId = getParam('entityId');
    
    if (!$entity || !$entityId) jsonError('entity y entityId requeridos');
    
    $stmt = $pdo->prepare("SELECT * FROM audit_logs WHERE entity = ? AND entity_id = ? ORDER BY created_at DESC LIMIT 100");
    $stmt->execute([$entity, $entityId]);
    jsonResponse(['data' => $stmt->fetchAll()]);
}

function createLog() {
    global $auth;
    $body = getJsonBody();
    
    logAudit(
        $auth['userId'],
        $auth['name'] ?? 'Unknown',
        $body['action'] ?? 'unknown',
        $body['entity'] ?? 'unknown',
        $body['entityId'] ?? null,
        $body['fieldName'] ?? null,
        $body['oldValue'] ?? null,
        $body['newValue'] ?? null,
        $body['details'] ?? null
    );
    
    jsonResponse(['data' => ['logged' => true]], 201);
}
