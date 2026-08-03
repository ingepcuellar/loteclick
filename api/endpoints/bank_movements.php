<?php
/**
 * LoteClick API — Movimientos Bancarios & Conciliación (Ítem 4b)
 * CRUD para movimientos del banco + motor de conciliación contra pagos y gastos del sistema.
 * Acceso: solo admin y tesorero.
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../jwt.php';

$auth   = requireAuth();
$action = getParam('action', '');
$method = getMethod();

// =====================================================================
// SECURITY: solo admin y tesorero
// =====================================================================
$userRoles = getRolesFromAuth($auth);
if (!array_intersect($userRoles, ['admin', 'treasurer', 'tesorero'])) {
    jsonError('Acceso denegado. Solo administradores y tesoreros pueden acceder a la conciliación.', 403);
}

// =====================================================================
// AUTO-MIGRATE: crear tablas y columnas si no existen
// =====================================================================
try {
    $pdoMig = getConnection();

    // Tabla principal de movimientos
    $pdoMig->exec("CREATE TABLE IF NOT EXISTS bank_movements (
        id              VARCHAR(36)   NOT NULL PRIMARY KEY,
        project_id      VARCHAR(36)   DEFAULT NULL,
        bank_account_id VARCHAR(36)   DEFAULT NULL,
        fecha           DATE          NOT NULL,
        concepto        VARCHAR(255)  NOT NULL,
        valor           DECIMAL(15,2) NOT NULL DEFAULT 0,
        tipo            VARCHAR(10)   NOT NULL DEFAULT 'credito',
        conciliado      TINYINT(1)    NOT NULL DEFAULT 0,
        pago_id         VARCHAR(36)   DEFAULT NULL,
        gasto_id        VARCHAR(36)   DEFAULT NULL,
        notas           TEXT          DEFAULT NULL,
        created_by      VARCHAR(36)   DEFAULT NULL,
        created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
        updated_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Columna project_id en bank_accounts si no existe
    $migs = [
        "ALTER TABLE bank_accounts ADD COLUMN project_id VARCHAR(36) DEFAULT NULL",
        "ALTER TABLE bank_accounts ADD COLUMN is_active   TINYINT(1) DEFAULT 1",
        "ALTER TABLE bank_accounts ADD COLUMN created_at  TIMESTAMP  DEFAULT CURRENT_TIMESTAMP",
    ];
    foreach ($migs as $sql) {
        try { $pdoMig->exec($sql); } catch (Exception $e) { /* ya existe */ }
    }
} catch (Exception $e) { /* silencioso */ }

// =====================================================================
// ROUTER
// =====================================================================
if ($action === 'reconcile') { reconcileMovement(); exit; }
if ($action === 'summary')   { getConciliationSummary(); exit; }

switch ($method) {
    case 'GET':
        $id = getParam('id');
        $id ? getMovement($id) : getAllMovements();
        break;
    case 'POST':
        createMovement();
        break;
    case 'PUT':
    case 'PATCH':
        $id = getParam('id');
        if (!$id) jsonError('ID requerido', 400);
        updateMovement($id);
        break;
    case 'DELETE':
        $id = getParam('id');
        if (!$id) jsonError('ID requerido', 400);
        deleteMovement($id);
        break;
    default:
        jsonError('Método no permitido', 405);
}

// =====================================================================
// FUNCTIONS
// =====================================================================

function getAllMovements() {
    $pdo       = getConnection();
    $projectId = getParam('project_id', '');
    $accountId = getParam('account_id', '');
    $month     = getParam('month', '');   // YYYY-MM
    $tipo      = getParam('tipo', '');
    $conciliado = getParam('conciliado', '');

    $where  = [];
    $params = [];

    if ($projectId) {
        $where[]  = 'bm.project_id = ?';
        $params[] = $projectId;
    }
    if ($accountId) {
        $where[]  = 'bm.bank_account_id = ?';
        $params[] = $accountId;
    }
    if ($month) {
        $where[]  = "DATE_FORMAT(bm.fecha, '%Y-%m') = ?";
        $params[] = $month;
    }
    if ($tipo) {
        $where[]  = 'bm.tipo = ?';
        $params[] = $tipo;
    }
    if ($conciliado !== '') {
        $where[]  = 'bm.conciliado = ?';
        $params[] = (int)$conciliado;
    }

    $sql = "SELECT bm.*,
                   ba.bank_name, ba.account_number, ba.account_type,
                   p.name AS project_name
            FROM bank_movements bm
            LEFT JOIN bank_accounts ba ON ba.id = bm.bank_account_id
            LEFT JOIN projects p       ON p.id  = bm.project_id"
        . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
        . ' ORDER BY bm.fecha DESC, bm.created_at DESC';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    // Enriquecer: agregar info del pago/gasto vinculado
    foreach ($rows as &$row) {
        $row = enrichMovement($pdo, $row);
    }

    jsonResponse(['data' => $rows]);
}

function getMovement($id) {
    $pdo  = getConnection();
    $stmt = $pdo->prepare("SELECT bm.*, ba.bank_name, ba.account_number, p.name AS project_name
                            FROM bank_movements bm
                            LEFT JOIN bank_accounts ba ON ba.id = bm.bank_account_id
                            LEFT JOIN projects p       ON p.id  = bm.project_id
                            WHERE bm.id = ?");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) jsonError('Movimiento no encontrado', 404);
    jsonResponse(['data' => enrichMovement($pdo, $row)]);
}

function createMovement() {
    global $auth;
    $pdo  = getConnection();
    $data = getJsonBody();

    if (empty($data['fecha']))    jsonError('Fecha requerida', 400);
    if (empty($data['concepto'])) jsonError('Concepto requerido', 400);
    if (!isset($data['valor']))   jsonError('Valor requerido', 400);

    $tipo = in_array($data['tipo'] ?? '', ['credito', 'debito']) ? $data['tipo'] : 'credito';
    $id   = generateUUID();

    $stmt = $pdo->prepare(
        "INSERT INTO bank_movements
            (id, project_id, bank_account_id, fecha, concepto, valor, tipo, notas, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        $id,
        $data['project_id']      ?? null,
        $data['bank_account_id'] ?? null,
        $data['fecha'],
        trim($data['concepto']),
        abs((float)$data['valor']),
        $tipo,
        $data['notas'] ?? null,
        $auth['sub'] ?? null,
    ]);

    $stmt2 = $pdo->prepare("SELECT * FROM bank_movements WHERE id = ?");
    $stmt2->execute([$id]);
    jsonResponse(['data' => $stmt2->fetch()], 201);
}

function updateMovement($id) {
    $pdo  = getConnection();
    $data = getJsonBody();

    $fields = [];
    $params = [];

    $allowed = ['project_id','bank_account_id','fecha','concepto','valor','tipo','notas'];
    foreach ($allowed as $f) {
        if (array_key_exists($f, $data)) {
            $fields[] = "$f = ?";
            $val = $data[$f];
            if ($f === 'tipo' && !in_array($val, ['credito','debito'])) $val = 'credito';
            if ($f === 'valor') $val = abs((float)$val);
            $params[] = $val;
        }
    }

    if (empty($fields)) jsonError('Nada que actualizar', 400);

    $params[] = $id;
    $pdo->prepare("UPDATE bank_movements SET " . implode(', ', $fields) . ", updated_at = NOW() WHERE id = ?")
        ->execute($params);

    $stmt = $pdo->prepare("SELECT * FROM bank_movements WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(['data' => $stmt->fetch()]);
}

function deleteMovement($id) {
    $pdo = getConnection();
    $pdo->prepare("DELETE FROM bank_movements WHERE id = ?")->execute([$id]);
    jsonResponse(['data' => ['id' => $id, 'deleted' => true]]);
}

/**
 * PUT ?action=reconcile&id=X
 * Vincula el movimiento con un pago o gasto del sistema y lo marca como conciliado.
 * Body: { pago_id?: string, gasto_id?: string, force?: bool }
 */
function reconcileMovement() {
    $pdo  = getConnection();
    $id   = getParam('id');
    if (!$id) jsonError('ID requerido', 400);

    $data = getJsonBody();

    // Fetch movement
    $stmt = $pdo->prepare("SELECT * FROM bank_movements WHERE id = ?");
    $stmt->execute([$id]);
    $mov = $stmt->fetch();
    if (!$mov) jsonError('Movimiento no encontrado', 404);

    $pagoId  = $data['pago_id']  ?? null;
    $gastoId = $data['gasto_id'] ?? null;

    // Si es sin vincular (force = true), igual se marca conciliado
    $pdo->prepare(
        "UPDATE bank_movements
         SET conciliado = 1, pago_id = ?, gasto_id = ?, updated_at = NOW()
         WHERE id = ?"
    )->execute([$pagoId, $gastoId, $id]);

    $stmt2 = $pdo->prepare("SELECT * FROM bank_movements WHERE id = ?");
    $stmt2->execute([$id]);
    jsonResponse(['data' => $stmt2->fetch()]);
}

/**
 * GET ?action=summary&project_id=X&month=YYYY-MM
 * Devuelve resumen comparativo Sistema vs Banco para el panel de conciliación.
 */
function getConciliationSummary() {
    $pdo       = getConnection();
    $projectId = getParam('project_id', '');
    $month     = getParam('month', date('Y-m'));

    // --- BANCO ---
    $bWhere  = ["DATE_FORMAT(fecha, '%Y-%m') = ?"];
    $bParams = [$month];
    if ($projectId) { $bWhere[] = 'project_id = ?'; $bParams[] = $projectId; }
    $bSql = "SELECT
                SUM(CASE WHEN tipo='credito' THEN valor ELSE 0 END) AS total_creditos,
                SUM(CASE WHEN tipo='debito'  THEN valor ELSE 0 END) AS total_debitos,
                SUM(CASE WHEN conciliado = 1 THEN 1 ELSE 0 END)     AS conciliados,
                SUM(CASE WHEN conciliado = 0 THEN 1 ELSE 0 END)     AS pendientes,
                COUNT(*)                                             AS total_movimientos
             FROM bank_movements WHERE " . implode(' AND ', $bWhere);
    $bStmt = $pdo->prepare($bSql);
    $bStmt->execute($bParams);
    $banco = $bStmt->fetch();

    // --- SISTEMA: Pagos (créditos) ---
    $pWhere  = ["DATE_FORMAT(p.payment_date, '%Y-%m') = ? OR DATE_FORMAT(p.created_at, '%Y-%m') = ?"];
    $pParams = [$month, $month];

    if ($projectId) {
        // Cruzamos con ventas para filtrar por proyecto
        $pWhere[]  = "EXISTS (SELECT 1 FROM sales s WHERE s.id = (p.sale_id) AND s.project_id = ?)";
        $pParams[] = $projectId;
    }
    try {
        $pSql  = "SELECT COALESCE(SUM(p.amount), 0) AS total_pagos FROM payments p WHERE " . implode(' AND ', $pWhere);
        $pStmt = $pdo->prepare($pSql);
        $pStmt->execute($pParams);
        $sistemaPagos = (float)($pStmt->fetchColumn() ?: 0);
    } catch (Exception $e) { $sistemaPagos = 0; }

    // --- SISTEMA: Gastos (débitos) ---
    $gWhere  = ["DATE_FORMAT(created_at, '%Y-%m') = ?"];
    $gParams = [$month];
    if ($projectId) { $gWhere[] = 'project_id = ?'; $gParams[] = $projectId; }
    try {
        $gSql  = "SELECT COALESCE(SUM(amount), 0) AS total_gastos FROM expenses WHERE " . implode(' AND ', $gWhere);
        $gStmt = $pdo->prepare($gSql);
        $gStmt->execute($gParams);
        $sistemaGastos = (float)($gStmt->fetchColumn() ?: 0);
    } catch (Exception $e) { $sistemaGastos = 0; }

    $bancoCred = (float)($banco['total_creditos'] ?? 0);
    $bancoDebit = (float)($banco['total_debitos'] ?? 0);

    jsonResponse(['data' => [
        'mes'               => $month,
        'banco' => [
            'total_creditos'      => $bancoCred,
            'total_debitos'       => $bancoDebit,
            'saldo'               => $bancoCred - $bancoDebit,
            'conciliados'         => (int)($banco['conciliados'] ?? 0),
            'pendientes'          => (int)($banco['pendientes'] ?? 0),
            'total_movimientos'   => (int)($banco['total_movimientos'] ?? 0),
        ],
        'sistema' => [
            'total_pagos'         => $sistemaPagos,
            'total_gastos'        => $sistemaGastos,
            'saldo'               => $sistemaPagos - $sistemaGastos,
        ],
        'diferencias' => [
            'creditos'  => $bancoCred - $sistemaPagos,
            'debitos'   => $bancoDebit - $sistemaGastos,
        ],
    ]]);
}

/**
 * Sugiere pagos/gastos del sistema que podrían corresponder al movimiento bancario.
 * Criterio: mismo proyecto, ±7 días de fecha, monto dentro del 20% de diferencia.
 */
function getSuggestions($pdo, $mov) {
    $suggestions = ['pagos' => [], 'gastos' => []];
    $valor = (float)$mov['valor'];
    $fecha = $mov['fecha'];
    $pid   = $mov['project_id'];

    try {
        if ($mov['tipo'] === 'credito') {
            // Buscar pagos similares
            $pSql = "SELECT p.id, p.amount, p.payment_date, p.created_at,
                            c.name AS client_name
                     FROM payments p
                     LEFT JOIN sales s   ON s.id = (p.sale_id)
                     LEFT JOIN clients c ON c.id = s.client_id
                     WHERE ABS(DATEDIFF(COALESCE(p.payment_date, p.created_at), ?)) <= 7
                       AND ABS(p.amount - ?) / GREATEST(p.amount, 1) <= 0.20"
                   . ($pid ? " AND s.project_id = ?" : "")
                   . " LIMIT 5";
            $pParams = [$fecha, $valor];
            if ($pid) $pParams[] = $pid;
            $pStmt = $pdo->prepare($pSql);
            $pStmt->execute($pParams);
            $suggestions['pagos'] = $pStmt->fetchAll();
        } else {
            // Buscar gastos similares
            $gSql = "SELECT id, amount, description, created_at
                     FROM expenses
                     WHERE ABS(DATEDIFF(COALESCE(expense_date, created_at), ?)) <= 7
                       AND ABS(amount - ?) / GREATEST(amount, 1) <= 0.20"
                   . ($pid ? " AND project_id = ?" : "")
                   . " LIMIT 5";
            $gParams = [$fecha, $valor];
            if ($pid) $gParams[] = $pid;
            $gStmt = $pdo->prepare($gSql);
            $gStmt->execute($gParams);
            $suggestions['gastos'] = $gStmt->fetchAll();
        }
    } catch (Exception $e) {}

    return $suggestions;
}

function enrichMovement($pdo, $row) {
    $row['suggestions'] = getSuggestions($pdo, $row);

    // Nombre del pago/gasto vinculado si está conciliado
    if ($row['conciliado'] && $row['pago_id']) {
        try {
            $s = $pdo->prepare("SELECT p.amount, c.name AS client_name
                                 FROM payments p
                                 LEFT JOIN sales sl ON sl.id = p.sale_id
                                 LEFT JOIN clients c ON c.id = sl.client_id
                                 WHERE p.id = ?");
            $s->execute([$row['pago_id']]);
            $row['linked_payment'] = $s->fetch();
        } catch (Exception $e) {}
    }
    if ($row['conciliado'] && $row['gasto_id']) {
        try {
            $s = $pdo->prepare("SELECT id, amount, description FROM expenses WHERE id = ?");
            $s->execute([$row['gasto_id']]);
            $row['linked_expense'] = $s->fetch();
        } catch (Exception $e) {}
    }
    return $row;
}
