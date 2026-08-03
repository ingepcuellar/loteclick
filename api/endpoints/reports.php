<?php
/**
 * LoteClick API - Reports and Statements Endpoints
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../jwt.php';

$auth = requireAuth();
$action = getParam('action', '');
$method = getMethod();

if ($method !== 'GET') {
    jsonError('Método no permitido', 405);
}

switch ($action) {
    case 'statementByClient':
        statementByClient();
        break;
    case 'statementByProject':
        statementByProject();
        break;
    case 'expensesByCategory':
        expensesByCategory();
        break;
    case 'paymentsByMethod':
        paymentsByMethod();
        break;
    case 'salesByAgent':
        salesByAgent();
        break;
    case 'disbursements':
        getDisbursements();
        break;
    case 'desistimientosByPeriod':
        desistimientosByPeriod();
        break;
    default:
        jsonError('Acción no válida', 400);
}

function statementByClient() {
    $pdo = getConnection();
    $clientId = getParam('clientId');
    if (!$clientId) jsonError('clientId requerido');

    // Ventas del cliente (solo activas; las desistidas se muestran aparte)
    $stmt = $pdo->prepare(
        "SELECT s.*, p.name as project_name, l.number as lot_number,
                (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE sale_id = s.id) as total_paid
         FROM sales s
         JOIN projects p ON s.project_id = p.id
         JOIN lots l ON s.lot_id = l.id
         WHERE s.client_id = ?
           AND COALESCE(s.status, 'active') = 'active'"
    );
    $stmt->execute([$clientId]);
    $sales = $stmt->fetchAll();

    // Historial de pagos del cliente con método de pago
    $stmtPayments = $pdo->prepare(
        "SELECT p.*, s.sale_price, l.number as lot_number, pr.name as project_name
         FROM payments p
         JOIN sales s ON p.sale_id = s.id
         JOIN lots l ON s.lot_id = l.id
         JOIN projects pr ON s.project_id = pr.id
         WHERE s.client_id = ? ORDER BY p.payment_date DESC"
    );
    $stmtPayments->execute([$clientId]);
    $payments = $stmtPayments->fetchAll();

    jsonResponse([
        'data' => [
            'sales' => $sales,
            'payments' => $payments
        ]
    ]);
}

function statementByProject() {
    $pdo = getConnection();
    $projectId = getParam('projectId');
    if (!$projectId) jsonError('projectId requerido');

    // Resumen de ventas activas (excluye desistidas para no inflar ingresos)
    $stmt = $pdo->prepare(
        "SELECT COUNT(*) as total_sales, COALESCE(SUM(sale_price), 0) as total_value 
         FROM sales WHERE project_id = ? AND COALESCE(status, 'active') = 'active'"
    );
    $stmt->execute([$projectId]);
    $salesSummary = $stmt->fetch();

    // Lotes vendidos (sold + pending_initial = vendidos a crédito)
    $stmt = $pdo->prepare(
        "SELECT 
            COUNT(CASE WHEN status = 'sold' OR status = 'pending_initial' THEN 1 END) as lots_sold,
            COUNT(CASE WHEN status = 'available' THEN 1 END) as lots_available,
            COUNT(*) as lots_total
         FROM lots WHERE project_id = ?"
    );
    $stmt->execute([$projectId]);
    $lotsSummary = $stmt->fetch();

    // Resumen de ingresos con desglose por método de pago (solo ventas activas)
    $stmt = $pdo->prepare(
        "SELECT 
            COALESCE(SUM(p.amount), 0) as total_income,
            COALESCE(SUM(CASE WHEN p.payment_method = 'cash' OR p.payment_method IS NULL THEN p.amount ELSE 0 END), 0) as cash_income,
            COALESCE(SUM(CASE WHEN p.payment_method = 'transfer' THEN p.amount ELSE 0 END), 0) as transfer_income
         FROM payments p
         JOIN sales s ON p.sale_id = s.id
         WHERE s.project_id = ?
           AND COALESCE(s.status, 'active') = 'active'"
    );
    $stmt->execute([$projectId]);
    $income = $stmt->fetch();

    // Resumen de gastos
    $stmt = $pdo->prepare(
        "SELECT COALESCE(SUM(amount), 0) as total_expense
         FROM expenses WHERE project_id = ?"
    );
    $stmt->execute([$projectId]);
    $expense = $stmt->fetch()['total_expense'];

    jsonResponse([
        'data' => [
            'sales_summary' => $salesSummary,
            'lots_summary' => $lotsSummary,
            'total_income' => floatval($income['total_income']),
            'cash_income' => floatval($income['cash_income']),
            'transfer_income' => floatval($income['transfer_income']),
            'total_expense' => floatval($expense),
            'balance' => floatval($income['total_income']) - floatval($expense)
        ]
    ]);
}

function expensesByCategory() {
    $pdo = getConnection();
    $projectId = getParam('projectId');
    $startDate = getParam('startDate');
    $endDate = getParam('endDate');

    $where = [];
    $params = [];

    if ($projectId) {
        $where[] = "project_id = ?";
        $params[] = $projectId;
    }
    if ($startDate) {
        $where[] = "expense_date >= ?";
        $params[] = $startDate;
    }
    if ($endDate) {
        $where[] = "expense_date <= ?";
        $params[] = $endDate;
    }

    $whereClause = count($where) > 0 ? "WHERE " . implode(" AND ", $where) : "";

    $query = "SELECT category, COALESCE(SUM(amount), 0) as total_amount, COUNT(*) as tx_count 
              FROM expenses 
              $whereClause 
              GROUP BY category 
              ORDER BY total_amount DESC";

    $stmt = $pdo->prepare($query);
    $stmt->execute($params);
    jsonResponse(['data' => $stmt->fetchAll()]);
}

/**
 * Reporte de pagos desglosado por método (efectivo vs transferencia)
 * Responde a la pregunta del cliente: "¿qué ingresó en efectivo y qué en transferencia?"
 */
function paymentsByMethod() {
    $pdo = getConnection();
    $projectId = getParam('projectId');
    $startDate = getParam('startDate');
    $endDate = getParam('endDate');

    $where = ["1=1"];
    $params = [];

    if ($projectId) {
        $where[] = "s.project_id = ?";
        $params[] = $projectId;
    }
    if ($startDate) {
        $where[] = "p.payment_date >= ?";
        $params[] = $startDate;
    }
    if ($endDate) {
        $where[] = "p.payment_date <= ?";
        $params[] = $endDate;
    }

    $whereClause = implode(" AND ", $where);

    // Summary by method
    $stmt = $pdo->prepare(
        "SELECT 
            COALESCE(p.payment_method, 'cash') as method,
            COUNT(*) as count,
            COALESCE(SUM(p.amount), 0) as total
         FROM payments p
         JOIN sales s ON p.sale_id = s.id
         WHERE $whereClause
         GROUP BY COALESCE(p.payment_method, 'cash')
         ORDER BY total DESC"
    );
    $stmt->execute($params);
    $summary = $stmt->fetchAll();

    // Detail list
    $stmt2 = $pdo->prepare(
        "SELECT 
            p.id, p.payment_date, p.amount, 
            COALESCE(p.payment_method, 'cash') as payment_method,
            p.notes,
            c.name as client_name, c.document as client_document,
            l.number as lot_number,
            pr.name as project_name
         FROM payments p
         JOIN sales s ON p.sale_id = s.id
         JOIN clients c ON s.client_id = c.id
         JOIN lots l ON s.lot_id = l.id
         JOIN projects pr ON s.project_id = pr.id
         WHERE $whereClause
         ORDER BY p.payment_date DESC"
    );
    $stmt2->execute($params);
    $payments = $stmt2->fetchAll();

    // Totals
    $totalCash = 0;
    $totalTransfer = 0;
    $totalOther = 0;
    foreach ($summary as $row) {
        if ($row['method'] === 'cash') $totalCash = floatval($row['total']);
        elseif ($row['method'] === 'transfer') $totalTransfer = floatval($row['total']);
        else $totalOther += floatval($row['total']);
    }

    jsonResponse([
        'data' => [
            'summary' => $summary,
            'payments' => $payments,
            'totals' => [
                'cash' => $totalCash,
                'transfer' => $totalTransfer,
                'other' => $totalOther,
                'grand_total' => $totalCash + $totalTransfer + $totalOther
            ]
        ]
    ]);
}

/**
 * Reporte de ventas por comisionista
 */
function salesByAgent() {
    $pdo = getConnection();
    $projectId = getParam('projectId');

    $where = [
        "s.commission_agent IS NOT NULL AND s.commission_agent != ''",
        "COALESCE(s.status, 'active') = 'active'",  // Excluir ventas desistidas
    ];
    $params = [];

    if ($projectId) {
        $where[] = "s.project_id = ?";
        $params[] = $projectId;
    }

    $whereClause = implode(" AND ", $where);

    $stmt = $pdo->prepare(
        "SELECT 
            s.commission_agent as agent_name,
            COUNT(*) as total_sales,
            COALESCE(SUM(s.sale_price), 0) as total_amount,
            COALESCE(SUM(s.commission_amount), 0) as total_commission,
            GROUP_CONCAT(DISTINCT l.number ORDER BY l.number SEPARATOR ', ') as lot_numbers,
            GROUP_CONCAT(DISTINCT p.name ORDER BY p.name SEPARATOR ', ') as project_names
         FROM sales s
         JOIN lots l ON s.lot_id = l.id
         JOIN projects p ON s.project_id = p.id
         WHERE $whereClause
         GROUP BY s.commission_agent
         ORDER BY total_sales DESC"
    );
    $stmt->execute($params);
    $agents = $stmt->fetchAll();

    jsonResponse(['data' => $agents]);
}

/**
 * Reporte de préstamos/entregas a socios
 */
function getDisbursements() {
    $pdo = getConnection();
    $projectId = getParam('projectId');

    // Try disbursements table first
    try {
        $where = $projectId ? "WHERE project_id = ?" : "";
        $params = $projectId ? [$projectId] : [];
        $stmt = $pdo->prepare("SELECT d.*, p.name as project_name FROM disbursements d LEFT JOIN projects p ON d.project_id = p.id $where ORDER BY d.disbursement_date DESC");
        $stmt->execute($params);
        jsonResponse(['data' => $stmt->fetchAll()]);
    } catch (Exception $e) {
        // Fallback: get from expenses with category = partners/disbursement
        $where = $projectId ? "WHERE project_id = ? AND category IN ('partners', 'disbursement', 'partner_loan')" : "WHERE category IN ('partners', 'disbursement', 'partner_loan')";
        $params = $projectId ? [$projectId] : [];
        $stmt = $pdo->prepare("SELECT * FROM expenses $where ORDER BY expense_date DESC");
        $stmt->execute($params);
        jsonResponse(['data' => $stmt->fetchAll()]);
    }
}

/**
 * Desistimientos del período — para cierre de mes y reportes financieros
 * Retorna estadísticas agregadas por período (mes/año o rango de fechas)
 */
function desistimientosByPeriod() {
    $pdo = getConnection();
    $projectId = getParam('projectId');
    $startDate = getParam('startDate');
    $endDate   = getParam('endDate');

    $where  = ["1=1"];
    $params = [];

    if ($projectId) {
        $where[] = "project_id = ?";
        $params[] = $projectId;
    }
    if ($startDate) {
        $where[] = "desistimiento_date >= ?";
        $params[] = $startDate;
    }
    if ($endDate) {
        $where[] = "desistimiento_date <= ?";
        $params[] = $endDate;
    }

    $whereClause = implode(' AND ', $where);

    // Asegurar que la tabla existe antes de consultar
    try {
        $stmt = $pdo->prepare(
            "SELECT
                COUNT(*)                               AS cantidad,
                COALESCE(SUM(total_paid),      0)     AS total_recibido,
                COALESCE(SUM(amount_retained), 0)     AS total_retenido,
                COALESCE(SUM(total_paid - amount_retained), 0) AS total_devuelto
             FROM desistimientos
             WHERE $whereClause"
        );
        $stmt->execute($params);
        $summary = $stmt->fetch();

        // Detalle individual
        $stmt2 = $pdo->prepare(
            "SELECT id, desistimiento_date, client_name, project_name, lot_number,
                    sale_price, total_paid, amount_retained, reason
             FROM desistimientos
             WHERE $whereClause
             ORDER BY desistimiento_date DESC"
        );
        $stmt2->execute($params);
        $detail = $stmt2->fetchAll();

        jsonResponse([
            'data' => [
                'summary' => [
                    'cantidad'        => intval($summary['cantidad']),
                    'total_recibido'  => floatval($summary['total_recibido']),
                    'total_retenido'  => floatval($summary['total_retenido']),
                    'total_devuelto'  => floatval($summary['total_devuelto']),
                ],
                'detail' => $detail,
            ]
        ]);
    } catch (Exception $e) {
        // Tabla no existe aún
        jsonResponse(['data' => [
            'summary' => ['cantidad' => 0, 'total_recibido' => 0, 'total_retenido' => 0, 'total_devuelto' => 0],
            'detail'  => []
        ]]);
    }
}
