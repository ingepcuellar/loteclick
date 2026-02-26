<?php
/**
 * PredioClick API - Authentication Endpoints
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../jwt.php';

$action = getParam('action', '');
$method = getMethod();

switch ($action) {
    case 'login':
        handleLogin();
        break;
    case 'me':
        handleMe();
        break;
    case 'register':
        handleRegister();
        break;
    case 'users':
        handleUsers();
        break;
    case 'update':
        handleUpdate();
        break;
    case 'delete':
        handleDelete();
        break;
    default:
        jsonError('Acción no válida', 400);
}

function handleLogin() {
    if (getMethod() !== 'POST') jsonError('Método no permitido', 405);

    $body = getJsonBody();
    $email = trim($body['email'] ?? '');
    $password = $body['password'] ?? '';

    if (empty($email) || empty($password)) {
        jsonError('Correo y contraseña son requeridos');
    }

    $pdo = getConnection();
    $stmt = $pdo->prepare("SELECT * FROM profiles WHERE email = ? AND is_active = 1");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password'])) {
        jsonError('Credenciales incorrectas', 401);
    }

    $token = generateJWT($user['id'], $user['role']);

    unset($user['password']);
    $user['is_active'] = (bool)$user['is_active'];
    if ($user['associated_projects']) {
        $user['associated_projects'] = json_decode($user['associated_projects'], true);
    } else {
        $user['associated_projects'] = [];
    }

    jsonResponse([
        'data' => [
            'token' => $token,
            'user' => $user
        ]
    ]);
}

function handleMe() {
    if (getMethod() !== 'GET') jsonError('Método no permitido', 405);

    $auth = requireAuth();
    $pdo = getConnection();
    $stmt = $pdo->prepare("SELECT * FROM profiles WHERE id = ?");
    $stmt->execute([$auth['sub']]);
    $user = $stmt->fetch();

    if (!$user) jsonError('Usuario no encontrado', 404);

    unset($user['password']);
    $user['is_active'] = (bool)$user['is_active'];
    if ($user['associated_projects']) {
        $user['associated_projects'] = json_decode($user['associated_projects'], true);
    } else {
        $user['associated_projects'] = [];
    }

    jsonResponse(['data' => $user]);
}

function handleRegister() {
    if (getMethod() !== 'POST') jsonError('Método no permitido', 405);

    $auth = requireAuth();
    $body = getJsonBody();

    $email = trim($body['email'] ?? '');
    $password = $body['password'] ?? '';
    $name = trim($body['name'] ?? '');
    $role = $body['role'] ?? 'seller';

    if (empty($email) || empty($password) || empty($name)) {
        jsonError('Nombre, correo y contraseña son requeridos');
    }

    $pdo = getConnection();

    // Check if email already exists
    $stmt = $pdo->prepare("SELECT id FROM profiles WHERE email = ?");
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        jsonError('El correo ya está registrado');
    }

    $id = generateUUID();
    $hashedPassword = password_hash($password, PASSWORD_BCRYPT);
    $associatedProjects = json_encode($body['associatedProjects'] ?? $body['associated_projects'] ?? []);

    try {
        $stmt = $pdo->prepare(
            "INSERT INTO profiles (id, name, email, password, role, is_active, associated_projects) VALUES (?, ?, ?, ?, ?, 1, ?)"
        );
        $stmt->execute([$id, $name, $email, $hashedPassword, $role, $associatedProjects]);
    } catch (PDOException $e) {
        jsonError('Error al crear usuario: ' . $e->getMessage(), 400);
    }

    $stmt = $pdo->prepare("SELECT * FROM profiles WHERE id = ?");
    $stmt->execute([$id]);
    $user = $stmt->fetch();
    unset($user['password']);
    $user['is_active'] = (bool)$user['is_active'];
    $user['associated_projects'] = json_decode($user['associated_projects'], true) ?: [];

    jsonResponse(['data' => $user], 201);
}

function handleUsers() {
    if (getMethod() !== 'GET') jsonError('Método no permitido', 405);

    $auth = requireAuth();
    $pdo = getConnection();
    $stmt = $pdo->query("SELECT * FROM profiles ORDER BY created_at DESC");
    $users = $stmt->fetchAll();

    foreach ($users as &$u) {
        unset($u['password']);
        $u['is_active'] = (bool)$u['is_active'];
        $u['associated_projects'] = json_decode($u['associated_projects'] ?? '[]', true) ?: [];
    }

    jsonResponse(['data' => $users]);
}

function handleUpdate() {
    if (getMethod() !== 'PUT' && getMethod() !== 'PATCH') jsonError('Método no permitido', 405);

    $auth = requireAuth();
    $body = getJsonBody();
    $userId = $body['id'] ?? getParam('id');

    if (!$userId) jsonError('ID de usuario requerido');

    $pdo = getConnection();

    $fields = [];
    $params = [];

    if (isset($body['name'])) { $fields[] = 'name = ?'; $params[] = $body['name']; }
    if (isset($body['role'])) { $fields[] = 'role = ?'; $params[] = $body['role']; }
    if (isset($body['is_active'])) { $fields[] = 'is_active = ?'; $params[] = $body['is_active'] ? 1 : 0; }
    if (isset($body['isActive'])) { $fields[] = 'is_active = ?'; $params[] = $body['isActive'] ? 1 : 0; }
    if (isset($body['associated_projects']) || isset($body['associatedProjects'])) {
        $fields[] = 'associated_projects = ?';
        $params[] = json_encode($body['associated_projects'] ?? $body['associatedProjects'] ?? []);
    }
    if (isset($body['password']) && !empty($body['password'])) {
        $fields[] = 'password = ?';
        $params[] = password_hash($body['password'], PASSWORD_BCRYPT);
    }

    if (empty($fields)) jsonError('No hay campos para actualizar');

    $params[] = $userId;
    $sql = "UPDATE profiles SET " . implode(', ', $fields) . " WHERE id = ?";
    $pdo->prepare($sql)->execute($params);

    $stmt = $pdo->prepare("SELECT * FROM profiles WHERE id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    unset($user['password']);
    $user['is_active'] = (bool)$user['is_active'];
    $user['associated_projects'] = json_decode($user['associated_projects'] ?? '[]', true) ?: [];

    jsonResponse(['data' => $user]);
}

function handleDelete() {
    if (getMethod() !== 'DELETE') jsonError('Método no permitido', 405);

    $auth = requireAuth();
    $userId = getParam('id');

    if (!$userId) jsonError('ID de usuario requerido');

    $pdo = getConnection();
    // Soft delete - deactivate instead of deleting
    $stmt = $pdo->prepare("UPDATE profiles SET is_active = 0 WHERE id = ?");
    $stmt->execute([$userId]);

    jsonResponse(['data' => ['id' => $userId, 'deleted' => true]]);
}
