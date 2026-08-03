<?php
/**
 * Script de recuperación de usuario admin
 * Crea el usuario administrador por defecto
 * 
 * ELIMINAR ESTE ARCHIVO DESPUÉS DE USAR
 */
require_once __DIR__ . '/../config.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $pdo = getConnection();
    
    $id = bin2hex(random_bytes(16));
    $email = 'admin@jvjconstructores.com';
    $password = password_hash('password', PASSWORD_BCRYPT);
    $name = 'Administrador';
    $role = 'admin';
    
    // Check if admin already exists
    $check = $pdo->prepare("SELECT id FROM profiles WHERE email = ?");
    $check->execute([$email]);
    
    if ($check->fetch()) {
        // Update password
        $pdo->prepare("UPDATE profiles SET password = ?, is_active = 1 WHERE email = ?")
            ->execute([$password, $email]);
        echo json_encode(['success' => true, 'message' => 'Admin ya existía, contraseña actualizada', 'email' => $email, 'password' => 'password']);
    } else {
        // Insert new admin
        $stmt = $pdo->prepare(
            "INSERT INTO profiles (id, name, email, password, role, is_active, associated_projects) VALUES (?, ?, ?, ?, ?, 1, '[]')"
        );
        $stmt->execute([$id, $name, $email, $password, $role]);
        echo json_encode(['success' => true, 'message' => 'Admin creado exitosamente', 'email' => $email, 'password' => 'password']);
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
