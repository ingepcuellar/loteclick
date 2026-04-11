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
 * Convert APNs device token to FCM registration token
 * Uses Firebase Instance ID batchImport API
 */
function convertApnsToFcm($apnsToken) {
    $serviceAccountPath = defined('FCM_SERVICE_ACCOUNT_PATH') ? FCM_SERVICE_ACCOUNT_PATH : null;
    if (!$serviceAccountPath || !file_exists($serviceAccountPath)) {
        error_log("FCM service account not found for APNs conversion");
        return null;
    }
    
    $accessToken = getFirebaseAccessToken($serviceAccountPath);
    if (!$accessToken) {
        error_log("Failed to get Firebase access token for APNs conversion");
        return null;
    }
    
    $sa = json_decode(file_get_contents($serviceAccountPath), true);
    $projectId = $sa['project_id'] ?? null;
    
    // Get the GCM Sender ID from GoogleService-Info.plist or use project number
    // The application field should be the bundle ID
    $bundleId = 'com.PredioClick.app';
    
    $url = "https://iid.googleapis.com/iid/v1:batchImport";
    
    $payload = [
        'application' => $bundleId,
        'sandbox' => false,  // false for production/TestFlight
        'apns_tokens' => [$apnsToken]
    ];
    
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $accessToken,
            'Content-Type: application/json',
            'access_token_auth: true'
        ],
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    error_log("APNs->FCM conversion response (HTTP $httpCode): $response");
    
    if ($httpCode !== 200) {
        error_log("APNs->FCM conversion failed (HTTP $httpCode): $response");
        return null;
    }
    
    $data = json_decode($response, true);
    if (!empty($data['results'])) {
        foreach ($data['results'] as $result) {
            if (($result['status'] ?? '') === 'OK' && !empty($result['registration_token'])) {
                return $result['registration_token'];
            }
        }
    }
    
    error_log("APNs->FCM conversion: no valid token in response");
    return null;
}

/**
 * Check if a token looks like an APNs token (hex string, typically 64 chars)
 * FCM tokens are much longer (150+ chars) and base64-encoded
 */
function isApnsToken($token) {
    // APNs tokens are hex-encoded, typically 64 characters
    return strlen($token) <= 100 && ctype_xdigit($token);
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
    $originalToken = $token;
    $conversionInfo = null;
    
    // If iOS and token looks like APNs, convert to FCM
    if ($platform === 'ios' && isApnsToken($token)) {
        $fcmToken = convertApnsToFcm($token);
        if ($fcmToken) {
            $conversionInfo = 'apns_converted_to_fcm';
            $token = $fcmToken; // Use FCM token for storage
        } else {
            $conversionInfo = 'apns_conversion_failed';
            // Still store the APNs token as fallback
            error_log("Warning: Could not convert APNs token to FCM for user $userId");
        }
    }
    
    // Check if token already exists for this user
    $check = $pdo->prepare("SELECT id FROM device_tokens WHERE user_id = ? AND token = ?");
    $check->execute([$userId, $token]);
    
    if ($check->fetch()) {
        jsonResponse(['data' => [
            'status' => 'already_registered',
            'token_type' => $conversionInfo ?? 'existing'
        ]]);
        return;
    }
    
    // Remove old tokens for this user (one device per user)
    $pdo->prepare("DELETE FROM device_tokens WHERE user_id = ?")->execute([$userId]);
    
    // Insert new token
    $id = generateUUID();
    $stmt = $pdo->prepare("INSERT INTO device_tokens (id, user_id, token, platform) VALUES (?, ?, ?, ?)");
    $stmt->execute([$id, $userId, $token, $platform]);
    
    jsonResponse(['data' => [
        'status' => 'registered',
        'id' => $id,
        'token_type' => $conversionInfo ?? 'direct',
        'token_preview' => substr($token, 0, 20) . '...'
    ]], 201);
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
    $stmt = $pdo->prepare("SELECT token, platform FROM device_tokens WHERE user_id = ?");
    $stmt->execute([$userId]);
    $tokens = $stmt->fetchAll();
    $tokenCount = count($tokens);
    
    if ($tokenCount == 0) {
        jsonResponse(['data' => [
            'status' => 'no_tokens',
            'message' => 'No hay tokens registrados para este usuario'
        ]]);
        return;
    }
    
    // Show debug info about stored tokens
    $tokenInfo = array_map(function($t) {
        return [
            'platform' => $t['platform'],
            'token_preview' => substr($t['token'], 0, 30) . '...',
            'token_length' => strlen($t['token']),
            'looks_like_apns' => isApnsToken($t['token'])
        ];
    }, $tokens);
    
    $result = sendPushToUser($pdo, $userId, 'Push Test ✅', 'Si ves esto, las notificaciones push funcionan correctamente.', [
        'type' => 'test',
        'route' => '/push-diagnostic'
    ]);
    
    jsonResponse(['data' => [
        'status' => $result ? 'sent' : 'failed',
        'tokens_found' => $tokenCount,
        'token_info' => $tokenInfo
    ]]);
}
