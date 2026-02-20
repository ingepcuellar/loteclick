<?php
/**
 * LoteClick API - Notifications Endpoints
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../jwt.php';

$auth = requireAuth();
$action = getParam('action', '');
$method = getMethod();

if ($action === 'count') { getUnreadCount(); exit; }
if ($action === 'byPartner') { getByPartner(); exit; }
if ($action === 'markRead') { markAsRead(); exit; }
if ($action === 'updateDiscount') { updateDiscountStatus(); exit; }

switch ($method) {
    case 'GET':
        $id = getParam('id');
        $id ? getNotification($id) : getAllNotifications();
        break;
    case 'POST':
        createNotification();
        break;
    default:
        jsonError('Método no permitido', 405);
}

function getAllNotifications() {
    $pdo = getConnection();
    $stmt = $pdo->query("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100");
    jsonResponse(['data' => $stmt->fetchAll()]);
}

function getNotification($id) {
    $pdo = getConnection();
    $stmt = $pdo->prepare("SELECT * FROM notifications WHERE id = ?");
    $stmt->execute([$id]);
    $n = $stmt->fetch();
    if (!$n) jsonError('Notificación no encontrada', 404);
    jsonResponse(['data' => $n]);
}

function getByPartner() {
    $pdo = getConnection();
    $partnerId = getParam('partnerId');
    if (!$partnerId) jsonError('partnerId requerido');
    $stmt = $pdo->prepare("SELECT * FROM notifications WHERE recipient_id = ? ORDER BY created_at DESC LIMIT 50");
    $stmt->execute([$partnerId]);
    jsonResponse(['data' => $stmt->fetchAll()]);
}

function getUnreadCount() {
    $pdo = getConnection();
    $recipientId = getParam('recipientId');
    
    if ($recipientId) {
        $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM notifications WHERE recipient_id = ? AND is_read = 0");
        $stmt->execute([$recipientId]);
    } else {
        $stmt = $pdo->query("SELECT COUNT(*) as count FROM notifications WHERE is_read = 0");
    }
    jsonResponse(['data' => $stmt->fetch()]);
}

function createNotification() {
    $pdo = getConnection();
    $body = getJsonBody();
    $id = generateUUID();

    $stmt = $pdo->prepare(
        "INSERT INTO notifications (id, recipient_type, recipient_id, type, title, message, reference_id, reference_type) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        $id,
        $body['recipient_type'] ?? 'partner',
        $body['recipient_id'] ?? null,
        $body['type'] ?? 'general',
        $body['title'] ?? 'Notificación',
        $body['message'] ?? null,
        $body['reference_id'] ?? null,
        $body['reference_type'] ?? null
    ]);

    $stmt = $pdo->prepare("SELECT * FROM notifications WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(['data' => $stmt->fetch()], 201);
}

function markAsRead() {
    $pdo = getConnection();
    $body = getJsonBody();
    $id = $body['id'] ?? getParam('id');
    if (!$id) jsonError('ID requerido');

    $pdo->prepare("UPDATE notifications SET is_read = 1 WHERE id = ?")->execute([$id]);
    jsonResponse(['data' => ['id' => $id, 'is_read' => 1]]);
}

function updateDiscountStatus() {
    $pdo = getConnection();
    $body = getJsonBody();
    $saleId = $body['sale_id'] ?? $body['saleId'];
    $status = $body['status']; // 'approved' or 'rejected'
    
    if (!$saleId || !$status) jsonError('sale_id y status requeridos');
    if (!in_array($status, ['approved', 'rejected'])) jsonError('Status debe ser approved o rejected');

    $pdo->prepare("UPDATE sales SET discount_status = ? WHERE id = ?")->execute([$status, $saleId]);
    
    // Mark related notification as read
    $pdo->prepare("UPDATE notifications SET is_read = 1 WHERE reference_id = ? AND type = 'discount_request'")->execute([$saleId]);

    jsonResponse(['data' => ['sale_id' => $saleId, 'discount_status' => $status]]);
}
