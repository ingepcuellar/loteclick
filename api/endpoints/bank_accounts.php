<?php
require_once '../config.php';
require_once '../jwt.php';

$method = getMethod();
$pdo = getConnection();
$user = requireAuth();

try {
    switch ($method) {
        case 'GET':
            $stmt = $pdo->query("SELECT * FROM bank_accounts WHERE is_active = 1 ORDER BY created_at ASC");
            jsonResponse(['data' => $stmt->fetchAll()]);
            break;

    case 'POST':
        $data = getJsonBody();
        if (empty($data['bank_name']) || empty($data['account_type']) || empty($data['account_number'])) {
            jsonError("Datos de cuenta bancaria incompletos");
        }
        
        $bank_name = mb_strtoupper($data['bank_name'], 'UTF-8');
        $holder_name = !empty($data['holder_name']) ? mb_strtoupper($data['holder_name'], 'UTF-8') : null;

        $id = generateUUID();
        $stmt = $pdo->prepare("INSERT INTO bank_accounts (id, bank_name, account_type, account_number, holder_name) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$id, $bank_name, $data['account_type'], $data['account_number'], $holder_name]);

        jsonResponse(['id' => $id, 'message' => 'Cuenta creada correctamente'], 201);
        break;

    case 'DELETE':
        $id = getParam('id');
        if (!$id) jsonError("ID requerido");
        
        // Logical delete
        $stmt = $pdo->prepare("UPDATE bank_accounts SET is_active = 0 WHERE id = ?");
        $stmt->execute([$id]);
        jsonResponse(['message' => 'Cuenta eliminada (inactivada)']);
        break;

        default:
            jsonError("Method not allowed", 405);
    }
} catch (PDOException $e) {
    jsonError("Error de Base de Datos: " . $e->getMessage(), 500);
} catch (Throwable $e) {
    jsonError("Error del Servidor: " . $e->getMessage(), 500);
}
