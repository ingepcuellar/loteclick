<?php
/**
 * LoteClick API - Configuration
 */

// ── Output safety: capture any stray HTML before headers are sent ──────────
ob_start();

// Error reporting — always OFF for display in production (return JSON instead)
error_reporting(E_ALL);
ini_set('display_errors', 0);

// Catch fatal errors and return JSON (prevents HTML error pages leaking out)
register_shutdown_function(function () {
    $error = error_get_last();
    if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        ob_clean();
        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
        }
        echo json_encode(['error' => 'Fatal error: ' . $error['message']], JSON_UNESCAPED_UNICODE);
    }
    ob_end_flush();
});

// Global exception handler — always return JSON
set_exception_handler(function ($e) {
    ob_clean();
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'error'   => 'Internal Server Error',
        'message' => $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
    exit;
});

// Global error handler — convert PHP warnings/notices to exceptions
set_error_handler(function ($errno, $errstr) {
    if (error_reporting() & $errno) {
        throw new \ErrorException($errstr, 0, $errno);
    }
    return false;
});

// Database Configuration - UPDATE THESE VALUES
define('DB_HOST', 'localhost');
define('DB_NAME', 'lotecdc1_DB');
define('DB_USER', 'lotecdc1_admin');
define('DB_PASS', 'PredioClick2026*+');

// JWT Secret - CHANGE THIS IN PRODUCTION
define('JWT_SECRET', 'PredioClick_jwt_secret_key_change_this_2024');
define('JWT_EXPIRY', 86400 * 7); // 7 days

// Upload settings
define('UPLOAD_DIR', __DIR__ . '/uploads/');
define('MAX_FILE_SIZE', 5 * 1024 * 1024); // 5MB

// Firebase Cloud Messaging (Push Notifications)
// Place the Firebase service account JSON file in this directory
define('FCM_SERVICE_ACCOUNT_PATH', __DIR__ . '/firebase-service-account.json');

// CORS Headers — allow both www and non-www origins explicitly
$allowedOrigins = [
    'https://loteclick.com',
    'https://www.loteclick.com',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:4173',
    // Capacitor / App móvil iOS & Android
    'capacitor://localhost',
    'https://localhost',
    'ionic://localhost',
    'https://predioclick',       // iosScheme: PredioClick
    'capacitor://predioclick',
    'http://localhost',
];
$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($requestOrigin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: $requestOrigin");
} elseif ($requestOrigin === '') {
    // Sin Origin = petición directa (cURL, Postman, etc.) — responder normalmente
    header('Access-Control-Allow-Origin: https://loteclick.com');
} else {
    // Origin desconocido — fallback seguro
    header('Access-Control-Allow-Origin: https://www.loteclick.com');
}
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');
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
 * Forzar campos de un array a mayusculas
 */
function forceUppercase(&$array, $fields) {
    foreach ($fields as $field) {
        if (!empty($array[$field]) && is_string($array[$field])) {
            $array[$field] = mb_strtoupper($array[$field], 'UTF-8');
        }
    }
}

/**
 * Get query parameter
 */
function getParam($key, $default = null) {
    return $_GET[$key] ?? $default;
}

/**
 * Registra una entrada en el log de auditoría.
 * @param string $userId ID del usuario
 * @param string $userName Nombre del usuario
 * @param string $action Acción realizada: create, update, delete, generate_doc
 * @param string $entity Entidad afectada: client, sale, payment, project, expense, etc.
 * @param string|null $entityId ID de la entidad
 * @param string|null $fieldName Campo modificado (para ediciones)
 * @param string|null $oldValue Valor anterior
 * @param string|null $newValue Valor nuevo
 * @param string|null $details Descripción adicional
 */
function logAudit($userId, $userName, $action, $entity, $entityId = null, $fieldName = null, $oldValue = null, $newValue = null, $details = null) {
    try {
        $pdo = getConnection();
        $id = generateUUID();
        $stmt = $pdo->prepare(
            "INSERT INTO audit_logs (id, user_id, user_name, action, entity, entity_id, field_name, old_value, new_value, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([$id, $userId, $userName, $action, $entity, $entityId, $fieldName, $oldValue, $newValue, $details]);
    } catch (Exception $e) {
        // Log silently - audit should never break main flow
        error_log("Audit log error: " . $e->getMessage());
    }
}

/**
 * Extract roles array from JWT auth payload.
 * Supports single role string, JSON array string, and legacy 'seller_treasurer'.
 * Used by all endpoints for server-side RBAC enforcement (Ítem 11).
 */
function getRolesFromAuth(array $auth): array {
    $raw = $auth['role'] ?? 'seller';
    if (is_string($raw) && str_starts_with($raw, '[')) {
        $parsed = json_decode($raw, true);
        if (is_array($parsed)) return $parsed;
    }
    if ($raw === 'seller_treasurer') return ['seller', 'treasurer'];
    return [$raw];
}

