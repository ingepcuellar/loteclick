<?php
/**
 * J.V.J Constructores Inmobiliarios S.A.S - API Configuration
 */

// Error reporting (disable in production)
error_reporting(E_ALL);
ini_set('display_errors', 0);

// Database Configuration
define('DB_HOST', '207.174.214.13');
define('DB_NAME', 'jvjco2a0_DB');
define('DB_USER', 'jvjco2a0_admin');
define('DB_PASS', 'Admin2026*');

// JWT Secret
define('JWT_SECRET', 'JVJ_Constructores_jwt_secret_key_2026_secure');
define('JWT_EXPIRY', 86400 * 7); // 7 days

// Upload settings
define('UPLOAD_DIR', __DIR__ . '/uploads/');
define('MAX_FILE_SIZE', 5 * 1024 * 1024); // 5MB

// Firebase Cloud Messaging (Push Notifications)
define('FCM_SERVICE_ACCOUNT_PATH', __DIR__ . '/firebase-service-account.json');

// CORS Headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

/**
 * Get PDO database connection
 */
function getConnection() {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false
        ]);
    }
    return $pdo;
}

/**
 * Generate UUID v4
 */
function generateUUID() {
    $data = random_bytes(16);
    $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
    $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

/**
 * Send JSON response
 */
function jsonResponse($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Send error response
 */
function jsonError($message, $code = 400) {
    jsonResponse(['error' => $message], $code);
}

/**
 * Get JSON body from request
 */
function getJsonBody() {
    $body = file_get_contents('php://input');
    return json_decode($body, true) ?: [];
}

/**
 * Get request method
 */
function getMethod() {
    return $_SERVER['REQUEST_METHOD'];
}

/**
 * Get query parameter
 */
function getParam($key, $default = null) {
    return $_GET[$key] ?? $default;
}
