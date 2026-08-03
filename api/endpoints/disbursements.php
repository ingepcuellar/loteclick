<?php
/**
 * LoteClick API - Partner Disbursements Endpoints
 * Entregas de dinero a socios
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../jwt.php';

$auth = requireAuth();
$action = getParam('action', '');
$method = getMethod();

// Auto-migrate: ensure table and required columns exist
try {
    $pdoMig = getConnection();
    // Create table if it doesn't exist
    $pdoMig->exec("CREATE TABLE IF NOT EXISTS partner_disbursements (
        id VARCHAR(36) PRIMARY KEY,
        project_id VARCHAR(36) DEFAULT NULL,
        partner_id VARCHAR(36) DEFAULT NULL,
        amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        disbursement_date DATE DEFAULT NULL,
        receipt_image TEXT DEFAULT NULL,
        signature_image TEXT DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        created_by VARCHAR(36) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )");
    // Add any missing columns to existing tables
    $migs = [
        "ALTER TABLE partner_disbursements ADD COLUMN receipt_image TEXT DEFAULT NULL",
        "ALTER TABLE partner_disbursements ADD COLUMN signature_image TEXT DEFAULT NULL",
        "ALTER TABLE partner_disbursements ADD COLUMN notes TEXT DEFAULT NULL",
        "ALTER TABLE partner_disbursements ADD COLUMN created_by VARCHAR(36) DEFAULT NULL",
        // Ítem 1: flujo de aprobación
        "ALTER TABLE partner_disbursements ADD COLUMN status VARCHAR(20) DEFAULT 'pending'",
        "ALTER TABLE partner_disbursements ADD COLUMN accepted_at DATETIME DEFAULT NULL",
        "ALTER TABLE partner_disbursements ADD COLUMN accepted_by VARCHAR(36) DEFAULT NULL",
        // Modalidad de pago
        "ALTER TABLE partner_disbursements ADD COLUMN payment_method VARCHAR(20) DEFAULT 'cash'",
    ];
    foreach ($migs as $sql) {
        try { $pdoMig->exec($sql); } catch (Exception $e) {} // column already exists
    }
} catch (Exception $e) {}

if ($action === 'byProject') { getByProject(); exit; }
if ($action === 'byPartner') { getByPartner(); exit; }
if ($action === 'accept')    { acceptDisbursement(); exit; }

switch ($method) {
    case 'GET':
        $id = getParam('id');
        $id ? getDisbursement($id) : getAllDisbursements();
        break;
    case 'POST':
        createDisbursement();
        break;
    case 'PUT':
    case 'PATCH':
        $id = getParam('id');
        if (!$id) jsonError('ID requerido');
        updateDisbursement($id);
        break;
    case 'DELETE':
        $id = getParam('id');
        if (!$id) jsonError('ID requerido');
        deleteDisbursement($id);
        break;
    default:
        jsonError('Método no permitido', 405);
}

function enrichDisbursement($pdo, $d) {
    if (!empty($d['project_id'])) {
        try {
            $stmt = $pdo->prepare("SELECT id, name FROM projects WHERE id = ?");
            $stmt->execute([$d['project_id']]);
            $d['project'] = $stmt->fetch() ?: null;
        } catch (Exception $e) {
            $d['project'] = null;
        }
    }
    if (!empty($d['partner_id'])) {
        $d['partner'] = ['id' => $d['partner_id'], 'name' => 'Socio'];
        try {
            // Try the separate partners table first
            $pStmt = $pdo->prepare("SELECT id, name, document, phone FROM partners WHERE id = ?");
            $pStmt->execute([$d['partner_id']]);
            $found = $pStmt->fetch();
            if ($found) {
                $d['partner'] = $found;
            }
        } catch (Exception $e) {
            // partners table may not exist in this deployment, keep minimal info
        }
    }
    return $d;
}

function getAllDisbursements() {
    global $auth;
    $pdo = getConnection();

    // Si el usuario es socio, solo ve sus propias entregas
    $userRoles = getRolesFromAuth($auth);
    $isPartnerOnly = (in_array('partner', $userRoles) || in_array('partner_secondary', $userRoles))
                     && !in_array('admin', $userRoles);

    if ($isPartnerOnly) {
        $userId = $auth['sub'] ?? '';

        // Recolectar todos los IDs de partner que corresponden a este usuario.
        // Estrategia multi-capa para cubrir todos los casos posibles:
        // 1. Su profile ID directamente
        // 2. IDs en partners donde user_id = su profile ID
        // 3. IDs en partners donde name coincide con su nombre (si user_id no está asignado)
        $partnerIds = [$userId];

        // Obtener nombre del usuario
        $userName = '';
        try {
            $uStmt = $pdo->prepare("SELECT name FROM profiles WHERE id = ?");
            $uStmt->execute([$userId]);
            $uRow = $uStmt->fetch();
            $userName = $uRow['name'] ?? '';
        } catch (Exception $e) {}

        try {
            // Busca 1: por user_id
            $pStmt = $pdo->prepare("SELECT id FROM partners WHERE user_id = ?");
            $pStmt->execute([$userId]);
            $rows = $pStmt->fetchAll();
            foreach ($rows as $row) {
                if (!in_array($row['id'], $partnerIds)) $partnerIds[] = $row['id'];
            }

            // Busca 2: por nombre (cuando user_id es NULL)
            if ($userName) {
                $nStmt = $pdo->prepare("SELECT id FROM partners WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND (user_id IS NULL OR user_id = '')");
                $nStmt->execute([$userName]);
                $nRows = $nStmt->fetchAll();
                foreach ($nRows as $row) {
                    if (!in_array($row['id'], $partnerIds)) {
                        $partnerIds[] = $row['id'];
                        // Auto-vincular: actualizar user_id para futuras consultas
                        try {
                            $pdo->prepare("UPDATE partners SET user_id = ? WHERE id = ?")
                                ->execute([$userId, $row['id']]);
                        } catch (Exception $e) {}
                    }
                }
            }
        } catch (Exception $e) {}

        $placeholders = implode(',', array_fill(0, count($partnerIds), '?'));
        $stmt = $pdo->prepare("SELECT * FROM partner_disbursements WHERE partner_id IN ($placeholders) ORDER BY disbursement_date DESC");
        $stmt->execute($partnerIds);
    } else {
        // Admins y tesoreros ven todo, con filtros opcionales
        $month     = getParam('month', '');
        $partnerId = getParam('partner_id', '');
        $projectId = getParam('project_id', '');

        $where = [];
        $params = [];

        if ($month) {
            $where[] = "DATE_FORMAT(disbursement_date, '%Y-%m') = ?";
            $params[] = $month;
        }
        if ($partnerId) {
            $where[] = "partner_id = ?";
            $params[] = $partnerId;
        }
        if ($projectId) {
            $where[] = "project_id = ?";
            $params[] = $projectId;
        }

        $sql = "SELECT * FROM partner_disbursements";
        if ($where) $sql .= " WHERE " . implode(' AND ', $where);
        $sql .= " ORDER BY disbursement_date DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
    }

    $items = $stmt->fetchAll();
    foreach ($items as &$d) { $d = enrichDisbursement($pdo, $d); }
    jsonResponse(['data' => $items]);
}


function getDisbursement($id) {
    $pdo = getConnection();
    $stmt = $pdo->prepare("SELECT * FROM partner_disbursements WHERE id = ?");
    $stmt->execute([$id]);
    $d = $stmt->fetch();
    if (!$d) jsonError('Entrega no encontrada', 404);
    jsonResponse(['data' => enrichDisbursement($pdo, $d)]);
}

function getByProject() {
    $pdo = getConnection();
    $projectId = getParam('projectId');
    if (!$projectId) jsonError('projectId requerido');
    $stmt = $pdo->prepare("SELECT * FROM partner_disbursements WHERE project_id = ? ORDER BY disbursement_date DESC");
    $stmt->execute([$projectId]);
    $items = $stmt->fetchAll();
    foreach ($items as &$d) { $d = enrichDisbursement($pdo, $d); }
    jsonResponse(['data' => $items]);
}

function getByPartner() {
    $pdo = getConnection();
    $partnerId = getParam('partnerId');
    if (!$partnerId) jsonError('partnerId requerido');
    $stmt = $pdo->prepare("SELECT * FROM partner_disbursements WHERE partner_id = ? ORDER BY disbursement_date DESC");
    $stmt->execute([$partnerId]);
    $items = $stmt->fetchAll();
    foreach ($items as &$d) { $d = enrichDisbursement($pdo, $d); }
    jsonResponse(['data' => $items]);
}

function createDisbursement() {
    global $auth;
    // Solo admin y partner pueden crear entregas (tesorero = solo lectura)
    $userRoles = getRolesFromAuth($auth);
    if (!array_intersect($userRoles, ['admin', 'partner'])) {
        jsonError('No tienes permiso para registrar entregas', 403);
    }

    $pdo = getConnection();
    $body = getJsonBody();
    $id = generateUUID();

    try {
        $stmt = $pdo->prepare(
            "INSERT INTO partner_disbursements (id, project_id, partner_id, amount, disbursement_date, receipt_image, signature_image, notes, created_by) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            $id,
            $body['project_id'] ?? $body['projectId'] ?? null,
            $body['partner_id'] ?? $body['partnerId'] ?? null,
            floatval($body['amount'] ?? 0),
            $body['disbursement_date'] ?? $body['disbursementDate'] ?? date('Y-m-d'),
            $body['receipt_image'] ?? $body['receiptImage'] ?? null,
            $body['signature_image'] ?? $body['signatureImage'] ?? null,
            $body['notes'] ?? null,
            $auth['sub'] ?? null
        ]);
    } catch (PDOException $e) {
        jsonError('Error al registrar entrega: ' . $e->getMessage(), 500);
    }

    $stmt = $pdo->prepare("SELECT * FROM partner_disbursements WHERE id = ?");
    $stmt->execute([$id]);
    $d = $stmt->fetch();
    jsonResponse(['data' => enrichDisbursement($pdo, $d)], 201);
}

function updateDisbursement($id) {
    global $auth;
    $userRoles = getRolesFromAuth($auth);
    if (!array_intersect($userRoles, ['admin', 'partner'])) {
        jsonError('No tienes permiso para editar entregas', 403);
    }

    $pdo = getConnection();
    $body = getJsonBody();

    $stmt = $pdo->prepare(
        "UPDATE partner_disbursements SET project_id = ?, partner_id = ?, amount = ?, disbursement_date = ?, 
         receipt_image = ?, signature_image = ?, notes = ? WHERE id = ?"
    );
    $stmt->execute([
        $body['project_id'] ?? $body['projectId'],
        $body['partner_id'] ?? $body['partnerId'],
        floatval($body['amount'] ?? 0),
        $body['disbursement_date'] ?? $body['disbursementDate'],
        $body['receipt_image'] ?? $body['receiptImage'] ?? null,
        $body['signature_image'] ?? $body['signatureImage'] ?? null,
        $body['notes'] ?? null,
        $id
    ]);

    $stmt = $pdo->prepare("SELECT * FROM partner_disbursements WHERE id = ?");
    $stmt->execute([$id]);
    $d = $stmt->fetch();
    jsonResponse(['data' => enrichDisbursement($pdo, $d)]);
}

function deleteDisbursement($id) {
    global $auth;
    $userRoles = getRolesFromAuth($auth);
    if (!array_intersect($userRoles, ['admin', 'partner'])) {
        jsonError('No tienes permiso para eliminar entregas', 403);
    }

    $pdo = getConnection();
    $pdo->prepare("DELETE FROM partner_disbursements WHERE id = ?")->execute([$id]);
    jsonResponse(['data' => ['id' => $id, 'deleted' => true]]);
}

/**
 * Ítem 1: Socio receptor acepta la entrega
 * Solo el socio cuyo partner_id coincide con uno de sus IDs puede aceptar
 */
function acceptDisbursement() {
    global $auth;
    $id = getParam('id');
    if (!$id) jsonError('ID requerido');

    $pdo = getConnection();

    // Fetch the disbursement
    $stmt = $pdo->prepare("SELECT * FROM partner_disbursements WHERE id = ?");
    $stmt->execute([$id]);
    $d = $stmt->fetch();

    if (!$d) jsonError('Entrega no encontrada', 404);

    // Verify: recopilar todos los IDs de partner del usuario autenticado
    $userId = $auth['sub'] ?? '';
    $partnerIds = [$userId];

    // Obtener nombre del usuario
    $userName = '';
    try {
        $uStmt = $pdo->prepare("SELECT name FROM profiles WHERE id = ?");
        $uStmt->execute([$userId]);
        $uRow = $uStmt->fetch();
        $userName = $uRow['name'] ?? '';
    } catch (Exception $e) {}

    try {
        // Buscar por user_id
        $pStmt = $pdo->prepare("SELECT id FROM partners WHERE user_id = ?");
        $pStmt->execute([$userId]);
        foreach ($pStmt->fetchAll() as $row) {
            if (!in_array($row['id'], $partnerIds)) $partnerIds[] = $row['id'];
        }
        // Buscar por nombre (si user_id no está asignado)
        if ($userName) {
            $nStmt = $pdo->prepare("SELECT id FROM partners WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))");
            $nStmt->execute([$userName]);
            foreach ($nStmt->fetchAll() as $row) {
                if (!in_array($row['id'], $partnerIds)) $partnerIds[] = $row['id'];
            }
        }
    } catch (Exception $e) {}

    // Verificar que el partner_id de la entrega pertenece al usuario autenticado
    if (!in_array($d['partner_id'], $partnerIds)) {
        jsonError('Solo el socio receptor puede aceptar esta entrega', 403);
    }

    // Verificar que siga pendiente
    if (($d['status'] ?? 'pending') === 'accepted') {
        jsonError('Esta entrega ya fue aceptada', 409);
    }

    // Actualizar estado
    $upd = $pdo->prepare(
        "UPDATE partner_disbursements SET status = 'accepted', accepted_at = NOW(), accepted_by = ? WHERE id = ?"
    );
    $upd->execute([$userId, $id]);

    // Retornar registro actualizado
    $stmt = $pdo->prepare("SELECT * FROM partner_disbursements WHERE id = ?");
    $stmt->execute([$id]);
    $updated = $stmt->fetch();
    jsonResponse(['data' => enrichDisbursement($pdo, $updated)]);
}

