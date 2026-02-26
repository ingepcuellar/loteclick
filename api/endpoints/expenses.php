<?php
/**
 * PredioClick API - Expenses Endpoints
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../jwt.php';

$auth = requireAuth();
$action = getParam('action', '');
$method = getMethod();

if ($action === 'byProject') { getExpensesByProject(); exit; }
if ($action === 'byCategory') { getExpensesByCategory(); exit; }
if ($action === 'totalByProject') { getTotalByProject(); exit; }

switch ($method) {
    case 'GET':
        $id = getParam('id');
        $id ? getExpense($id) : getAllExpenses();
        break;
    case 'POST':
        createExpense();
        break;
    case 'PUT':
    case 'PATCH':
        $id = getParam('id');
        if (!$id) jsonError('ID requerido');
        updateExpense($id);
        break;
    case 'DELETE':
        $id = getParam('id');
        if (!$id) jsonError('ID requerido');
        deleteExpense($id);
        break;
    default:
        jsonError('Método no permitido', 405);
}

function enrichExpense($pdo, $expense) {
    if ($expense['project_id']) {
        $stmt = $pdo->prepare("SELECT id, name FROM projects WHERE id = ?");
        $stmt->execute([$expense['project_id']]);
        $expense['project'] = $stmt->fetch() ?: null;
    }
    if ($expense['partner_id']) {
        $stmt = $pdo->prepare("SELECT id, name FROM partners WHERE id = ?");
        $stmt->execute([$expense['partner_id']]);
        $expense['partner'] = $stmt->fetch() ?: null;
    }
    return $expense;
}

function getAllExpenses() {
    $pdo = getConnection();
    $stmt = $pdo->query("SELECT * FROM expenses ORDER BY expense_date DESC");
    $expenses = $stmt->fetchAll();
    foreach ($expenses as &$e) { $e = enrichExpense($pdo, $e); }
    jsonResponse(['data' => $expenses]);
}

function getExpense($id) {
    $pdo = getConnection();
    $stmt = $pdo->prepare("SELECT * FROM expenses WHERE id = ?");
    $stmt->execute([$id]);
    $expense = $stmt->fetch();
    if (!$expense) jsonError('Gasto no encontrado', 404);
    jsonResponse(['data' => enrichExpense($pdo, $expense)]);
}

function getExpensesByProject() {
    $pdo = getConnection();
    $projectId = getParam('projectId');
    if (!$projectId) jsonError('projectId requerido');
    $stmt = $pdo->prepare("SELECT * FROM expenses WHERE project_id = ? ORDER BY expense_date DESC");
    $stmt->execute([$projectId]);
    $expenses = $stmt->fetchAll();
    foreach ($expenses as &$e) { $e = enrichExpense($pdo, $e); }
    jsonResponse(['data' => $expenses]);
}

function getExpensesByCategory() {
    $pdo = getConnection();
    $category = getParam('category');
    if (!$category) jsonError('category requerido');
    $stmt = $pdo->prepare("SELECT * FROM expenses WHERE category = ? ORDER BY expense_date DESC");
    $stmt->execute([$category]);
    $expenses = $stmt->fetchAll();
    foreach ($expenses as &$e) { $e = enrichExpense($pdo, $e); }
    jsonResponse(['data' => $expenses]);
}

function getTotalByProject() {
    $pdo = getConnection();
    $projectId = getParam('projectId');
    if (!$projectId) jsonError('projectId requerido');
    $stmt = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE project_id = ?");
    $stmt->execute([$projectId]);
    jsonResponse(['data' => floatval($stmt->fetch()['total'])]);
}

function createExpense() {
    $pdo = getConnection();
    $body = getJsonBody();
    $id = generateUUID();

    $stmt = $pdo->prepare(
        "INSERT INTO expenses (id, project_id, partner_id, description, amount, category, expense_date, notes, attachment) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        $id,
        $body['project_id'] ?? $body['projectId'],
        $body['partner_id'] ?? $body['partnerId'] ?? null,
        $body['description'],
        floatval($body['amount'] ?? 0),
        $body['category'] ?? 'other',
        $body['expense_date'] ?? $body['date'] ?? date('Y-m-d'),
        $body['notes'] ?? null,
        $body['attachment'] ?? null
    ]);

    $stmt = $pdo->prepare("SELECT * FROM expenses WHERE id = ?");
    $stmt->execute([$id]);
    $expense = $stmt->fetch();
    jsonResponse(['data' => enrichExpense($pdo, $expense)], 201);
}

function updateExpense($id) {
    $pdo = getConnection();
    $body = getJsonBody();

    $stmt = $pdo->prepare(
        "UPDATE expenses SET project_id = ?, partner_id = ?, description = ?, amount = ?, category = ?, expense_date = ?, notes = ?, attachment = ? WHERE id = ?"
    );
    $stmt->execute([
        $body['project_id'] ?? $body['projectId'],
        $body['partner_id'] ?? $body['partnerId'] ?? null,
        $body['description'],
        floatval($body['amount'] ?? 0),
        $body['category'] ?? 'other',
        $body['expense_date'] ?? $body['date'],
        $body['notes'] ?? null,
        $body['attachment'] ?? null,
        $id
    ]);

    $stmt = $pdo->prepare("SELECT * FROM expenses WHERE id = ?");
    $stmt->execute([$id]);
    $expense = $stmt->fetch();
    jsonResponse(['data' => enrichExpense($pdo, $expense)]);
}

function deleteExpense($id) {
    $pdo = getConnection();
    $pdo->prepare("DELETE FROM expenses WHERE id = ?")->execute([$id]);
    jsonResponse(['data' => ['id' => $id, 'deleted' => true]]);
}
