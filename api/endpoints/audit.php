<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../jwt.php';

$user = requireAuth();
requireRole(['admin'], $user);

$method = getMethod();
$action = getParam('action', 'list');

if ($method === 'GET') {
    if ($action === 'list') {
        listAuditLogs();
    } else if ($action === 'entities') {
        listEntities();
    } else {
        jsonError('Acción no válida', 400);
    }
} else {
    jsonError('Método no permitido', 405);
}

function listAuditLogs() {
    $pdo = getConnection();

    $userId    = getParam('userId', '');
    $entity    = getParam('entity', '');
    $action    = getParam('action_type', '');
    $dateFrom  = getParam('dateFrom', '');
    $dateTo    = getParam('dateTo', '');
    $page      = max(1, (int) getParam('page', 1));
    $limit     = min(100, max(10, (int) getParam('limit', 50)));
    $offset    = ($page - 1) * $limit;

    $where  = ['1=1'];
    $params = [];

    if ($userId)   { $where[] = 'user_id = ?';                $params[] = $userId; }
    if ($entity)   { $where[] = 'entity = ?';                 $params[] = $entity; }
    if ($action)   { $where[] = 'action = ?';                 $params[] = $action; }
    if ($dateFrom) { $where[] = 'DATE(created_at) >= ?';      $params[] = $dateFrom; }
    if ($dateTo)   { $where[] = 'DATE(created_at) <= ?';      $params[] = $dateTo; }

    $whereClause = implode(' AND ', $where);

    // Total count
    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM audit_logs WHERE $whereClause");
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    // Data
    $stmt = $pdo->prepare(
        "SELECT * FROM audit_logs WHERE $whereClause ORDER BY created_at DESC LIMIT $limit OFFSET $offset"
    );
    $stmt->execute($params);
    $logs = $stmt->fetchAll();

    jsonResponse([
        'data' => $logs,
        'meta' => [
            'total'   => $total,
            'page'    => $page,
            'limit'   => $limit,
            'pages'   => (int) ceil($total / $limit),
        ]
    ]);
}

function listEntities() {
    $pdo = getConnection();
    $stmt = $pdo->query("SELECT DISTINCT entity FROM audit_logs ORDER BY entity");
    $entities = $stmt->fetchAll(PDO::FETCH_COLUMN);
    jsonResponse(['data' => $entities]);
}
