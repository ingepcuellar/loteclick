<?php
/**
 * LoteClick API - JWT Authentication
 */

require_once __DIR__ . '/config.php';

/**
 * Generate JWT token
 */
function generateJWT($userId, $role = 'seller') {
    $header = base64url_encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload = base64url_encode(json_encode([
        'sub' => $userId,
        'role' => $role,
        'iat' => time(),
        'exp' => time() + JWT_EXPIRY
    ]));
    $signature = base64url_encode(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    return "$header.$payload.$signature";
}

/**
 * Verify and decode JWT token
 */
function verifyJWT($token) {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;

    [$header, $payload, $signature] = $parts;
    $expectedSig = base64url_encode(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));

    if (!hash_equals($expectedSig, $signature)) return null;

    $data = json_decode(base64url_decode($payload), true);
    if (!$data || ($data['exp'] ?? 0) < time()) return null;

    return $data;
}

/**
 * Require authentication - returns user data or exits with 401
 */
function requireAuth() {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    
    if (empty($authHeader)) {
        jsonError('Token no proporcionado', 401);
    }

    $token = str_replace('Bearer ', '', $authHeader);
    $data = verifyJWT($token);

    if (!$data) {
        jsonError('Token inválido o expirado', 401);
    }

    return $data;
}

/**
 * Require specific role(s)
 * Supports both single role strings and JSON array roles
 */
function requireRole(...$roles) {
    $user = requireAuth();
    $userRole = $user['role'] ?? 'seller';

    // Parse multi-role: could be a JSON array string like '["seller","treasurer"]'
    $userRoles = [];
    if (is_string($userRole) && str_starts_with($userRole, '[')) {
        $parsed = json_decode($userRole, true);
        if (is_array($parsed)) {
            $userRoles = $parsed;
        } else {
            $userRoles = [$userRole];
        }
    } else {
        // Legacy: single string role or 'seller_treasurer'
        if ($userRole === 'seller_treasurer') {
            $userRoles = ['seller', 'treasurer'];
        } else {
            $userRoles = [$userRole];
        }
    }

    // Check if any of the user's roles match the required roles
    if (empty(array_intersect($userRoles, $roles))) {
        jsonError('No tienes permisos para esta acción', 403);
    }
    return $user;
}

/**
 * Base64 URL-safe encode
 */
function base64url_encode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

/**
 * Base64 URL-safe decode
 */
function base64url_decode($data) {
    return base64_decode(strtr($data, '-_', '+/'));
}
