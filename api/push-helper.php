<?php
/**
 * PredioClick API - Push Helper
 * Sends push notifications via Firebase Cloud Messaging (FCM) HTTP v1 API
 * Uses Service Account JSON for authentication
 */

/**
 * Send push notification to a specific user via FCM v1
 */
function sendPushToUser($pdo, $userId, $title, $body, $data = []) {
    $serviceAccountPath = defined('FCM_SERVICE_ACCOUNT_PATH') ? FCM_SERVICE_ACCOUNT_PATH : null;
    if (!$serviceAccountPath || !file_exists($serviceAccountPath)) return false;
    
    // Get user's device tokens
    $stmt = $pdo->prepare("SELECT token FROM device_tokens WHERE user_id = ?");
    $stmt->execute([$userId]);
    $tokens = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    if (empty($tokens)) return false;
    
    // Get OAuth2 access token
    $accessToken = getFirebaseAccessToken($serviceAccountPath);
    if (!$accessToken) return false;
    
    // Get project ID from service account
    $sa = json_decode(file_get_contents($serviceAccountPath), true);
    $projectId = $sa['project_id'] ?? null;
    if (!$projectId) return false;
    
    $url = "https://fcm.googleapis.com/v1/projects/{$projectId}/messages:send";
    
    $sent = 0;
    foreach ($tokens as $token) {
        $payload = [
            'message' => [
                'token' => $token,
                'notification' => [
                    'title' => $title,
                    'body' => $body
                ],
                'apns' => [
                    'payload' => [
                        'aps' => [
                            'sound' => 'default',
                            'badge' => 1
                        ]
                    ]
                ],
                'data' => array_map('strval', $data)
            ]
        ];
        
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $accessToken,
                'Content-Type: application/json'
            ],
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10
        ]);
        
        $result = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode === 200) {
            $sent++;
        } else {
            error_log("FCM push failed (HTTP $httpCode): $result");
            // If token is invalid (404 or 400), remove it
            if ($httpCode === 404 || $httpCode === 400) {
                $pdo->prepare("DELETE FROM device_tokens WHERE token = ?")->execute([$token]);
            }
        }
    }
    
    return $sent > 0;
}

/**
 * Get Firebase OAuth2 access token using Service Account JWT
 */
function getFirebaseAccessToken($serviceAccountPath) {
    $sa = json_decode(file_get_contents($serviceAccountPath), true);
    if (!$sa) return null;
    
    $now = time();
    $header = base64UrlEncodeFcm(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
    $claims = base64UrlEncodeFcm(json_encode([
        'iss' => $sa['client_email'],
        'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
        'aud' => 'https://oauth2.googleapis.com/token',
        'iat' => $now,
        'exp' => $now + 3600
    ]));
    
    $signInput = "$header.$claims";
    $privateKey = openssl_pkey_get_private($sa['private_key']);
    if (!$privateKey) return null;
    
    openssl_sign($signInput, $signature, $privateKey, OPENSSL_ALGO_SHA256);
    $jwt = "$signInput." . base64UrlEncodeFcm($signature);
    
    // Exchange JWT for access token
    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query([
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion' => $jwt
        ]),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10
    ]);
    
    $response = json_decode(curl_exec($ch), true);
    curl_close($ch);
    
    return $response['access_token'] ?? null;
}

/**
 * Base64 URL-safe encode for FCM JWT
 */
function base64UrlEncodeFcm($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}
