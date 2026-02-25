<?php
/**
 * LoteClick API - Push Notifications Endpoint
 * Manages device tokens for push notifications
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../jwt.php';
require_once __DIR__ . '/../push-helper.php';

$auth = requireAuth();
$action = getParam('action', '');

switch ($action) {
    case 'register':
        registerToken();
        break;
    case 'unregister':
        unregisterToken();
        break;
    case 'test':
        testPush();
        break;
    default:
        jsonError('Acción no válida', 400);
}

/**
 * Register a device token for push notifications
 */
function registerToken() {
    if (getMethod() !== 'POST') jsonError('Método no permitido', 405);
    
    global $auth;
    $body = getJsonBody();
    $token = $body['token'] ?? null;
    $platform = $body['platform'] ?? 'ios';
    
    if (!$token) jsonError('Token requerido');
    
    $pdo = getConnection();
    $userId = $auth['sub'];
    
    // Check if token already exists for this user
    $check = $pdo->prepare("SELECT id FROM device_tokens WHERE user_id = ? AND token = ?");
    $check->execute([$userId, $token]);
    
    if ($check->fetch()) {
        jsonResponse(['data' => ['status' => 'already_registered']]);
        return;
    }
    
    // Remove old tokens for this user (one device per user)
    $pdo->prepare("DELETE FROM device_tokens WHERE user_id = ?")->execute([$userId]);
    
    // Insert new token
    $id = generateUUID();
    $stmt = $pdo->prepare("INSERT INTO device_tokens (id, user_id, token, platform) VALUES (?, ?, ?, ?)");
    $stmt->execute([$id, $userId, $token, $platform]);
    
    jsonResponse(['data' => ['status' => 'registered', 'id' => $id]], 201);
}

/**
 * Unregister a device token
 */
function unregisterToken() {
    if (getMethod() !== 'POST') jsonError('Método no permitido', 405);
    
    global $auth;
    $body = getJsonBody();
    $token = $body['token'] ?? null;
    
    $pdo = getConnection();
    
    if ($token) {
        $pdo->prepare("DELETE FROM device_tokens WHERE token = ?")->execute([$token]);
    } else {
        $pdo->prepare("DELETE FROM device_tokens WHERE user_id = ?")->execute([$auth['sub']]);
    }
    
    jsonResponse(['data' => ['status' => 'unregistered']]);
}

/**
 * Send a test push notification to the current user
 */
function testPush() {
    if (getMethod() !== 'POST') jsonError('Método no permitido', 405);
    
    global $auth;
    $pdo = getConnection();
    $userId = $auth['sub'];
    
    // Check if user has device tokens
    $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM device_tokens WHERE user_id = ?");
    $stmt->execute([$userId]);
    $tokenCount = $stmt->fetch()['count'];
    
    if ($tokenCount == 0) {
        jsonResponse(['data' => [
            'status' => 'no_tokens',
            'message' => 'No hay tokens registrados para este usuario'
        ]]);
        return;
    }
    
    $result = sendPushToUser($pdo, $userId, 'Push Test ✅', 'Si ves esto, las notificaciones push funcionan correctamente.', [
        'type' => 'test',
        'route' => '/push-diagnostic'
    ]);
    
    jsonResponse(['data' => [
        'status' => $result ? 'sent' : 'failed',
        'tokens_found' => $tokenCount
    ]]);
}
