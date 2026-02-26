<?php
/**
 * PredioClick - Push Notification Diagnostic
 * Checks all components needed for push to work
 * DELETE THIS FILE AFTER DEBUGGING
 */
require_once __DIR__ . '/../config.php';

header('Content-Type: application/json; charset=utf-8');

$checks = [];

// 1. Check firebase-service-account.json
$saPath = defined('FCM_SERVICE_ACCOUNT_PATH') ? FCM_SERVICE_ACCOUNT_PATH : 'NOT DEFINED';
$checks['fcm_service_account_path'] = $saPath;
$checks['fcm_file_exists'] = file_exists($saPath);
if (file_exists($saPath)) {
    $sa = json_decode(file_get_contents($saPath), true);
    $checks['fcm_project_id'] = $sa['project_id'] ?? 'MISSING';
    $checks['fcm_client_email'] = $sa['client_email'] ?? 'MISSING';
    $checks['fcm_has_private_key'] = isset($sa['private_key']) && strlen($sa['private_key']) > 100;
} else {
    $checks['fcm_file_error'] = 'firebase-service-account.json not found at: ' . $saPath;
}

// 2. Check device_tokens table
try {
    $pdo = getConnection();
    $stmt = $pdo->query("SELECT COUNT(*) as count FROM device_tokens");
    $result = $stmt->fetch();
    $checks['device_tokens_table'] = 'EXISTS';
    $checks['device_tokens_count'] = $result['count'];
    
    // Show all tokens
    $stmt = $pdo->query("SELECT id, user_id, platform, LEFT(token, 30) as token_preview, created_at FROM device_tokens");
    $checks['device_tokens'] = $stmt->fetchAll();
} catch (Exception $e) {
    $checks['device_tokens_table'] = 'ERROR: ' . $e->getMessage();
}

// 3. Check push-helper.php
$helperPath = __DIR__ . '/../push-helper.php';
$checks['push_helper_exists'] = file_exists($helperPath);

// 4. Check push-notifications.php
$pushEndpoint = __DIR__ . '/push-notifications.php';
$checks['push_endpoint_exists'] = file_exists($pushEndpoint);

// 5. Check curl extension
$checks['curl_enabled'] = extension_loaded('curl');

// 6. Check openssl extension (needed for JWT signing)
$checks['openssl_enabled'] = extension_loaded('openssl');

// 7. PHP version
$checks['php_version'] = phpversion();

// 8. Try generating OAuth token (if SA exists)
if (file_exists($saPath)) {
    try {
        require_once $helperPath;
        $token = getFirebaseAccessToken($saPath);
        $checks['oauth_token_generated'] = $token ? true : false;
        $checks['oauth_token_preview'] = $token ? substr($token, 0, 30) . '...' : 'FAILED';
    } catch (Exception $e) {
        $checks['oauth_token_error'] = $e->getMessage();
    }
}

echo json_encode($checks, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
