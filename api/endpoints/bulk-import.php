<?php
/**
 * LoteClick API - Bulk Import Endpoint
 * Handles mass data import from Excel/CSV files.
 * 
 * Actions:
 *   POST ?action=clients    → Bulk import clients
 *   POST ?action=projects   → Bulk import projects
 *   POST ?action=partners   → Bulk import partners (resolves project by name)
 *   POST ?action=lots       → Bulk import lots (resolves project by name)
 *   POST ?action=sales      → Bulk import sales (resolves project, lot, client by name)
 *   POST ?action=payments   → Bulk import payments (resolves sale by project+lot)
 *   POST ?action=expenses   → Bulk import expenses (resolves project by name)
 *   GET  ?action=template   → Returns column definitions for templates
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../jwt.php';

$action = getParam('action', '');
$method = getMethod();

// All actions require authentication and admin role
$auth = requireAuth();

switch ($action) {
    case 'template':
        if ($method !== 'GET') jsonError('Método no permitido', 405);
        handleTemplate();
        break;
    case 'clients':
        if ($method !== 'POST') jsonError('Método no permitido', 405);
        handleImportClients();
        break;
    case 'projects':
        if ($method !== 'POST') jsonError('Método no permitido', 405);
        handleImportProjects();
        break;
    case 'partners':
        if ($method !== 'POST') jsonError('Método no permitido', 405);
        handleImportPartners();
        break;
    case 'lots':
        if ($method !== 'POST') jsonError('Método no permitido', 405);
        handleImportLots();
        break;
    case 'sales':
        if ($method !== 'POST') jsonError('Método no permitido', 405);
        handleImportSales();
        break;
    case 'payments':
        if ($method !== 'POST') jsonError('Método no permitido', 405);
        handleImportPayments();
        break;
    case 'expenses':
        if ($method !== 'POST') jsonError('Método no permitido', 405);
        handleImportExpenses();
        break;
    default:
        jsonError('Acción no válida', 400);
}

// ─── TEMPLATE DEFINITIONS ────────────────────────────────────────

function handleTemplate() {
    $templates = [
        'clients' => [
            'label' => 'Clientes',
            'columns' => [
                ['key' => 'nombre', 'label' => 'Nombre', 'required' => true, 'example' => 'Juan Pérez'],
                ['key' => 'documento', 'label' => 'Documento', 'required' => false, 'example' => '1234567890'],
                ['key' => 'telefono', 'label' => 'Teléfono', 'required' => false, 'example' => '3001234567'],
                ['key' => 'email', 'label' => 'Email', 'required' => false, 'example' => 'juan@email.com'],
                ['key' => 'direccion', 'label' => 'Dirección', 'required' => false, 'example' => 'Calle 10 #20-30'],
                ['key' => 'notas', 'label' => 'Notas', 'required' => false, 'example' => ''],
            ],
        ],
        'projects' => [
            'label' => 'Proyectos',
            'columns' => [
                ['key' => 'nombre', 'label' => 'Nombre', 'required' => true, 'example' => 'Bosque Medina'],
                ['key' => 'ubicacion', 'label' => 'Ubicación', 'required' => true, 'example' => 'Villavicencio, Meta'],
                ['key' => 'descripcion', 'label' => 'Descripción', 'required' => false, 'example' => 'Proyecto de 50 lotes'],
            ],
        ],
        'partners' => [
            'label' => 'Socios',
            'columns' => [
                ['key' => 'proyecto', 'label' => 'Proyecto', 'required' => true, 'example' => 'Bosque Medina'],
                ['key' => 'nombre', 'label' => 'Nombre', 'required' => true, 'example' => 'Carlos López'],
                ['key' => 'porcentaje', 'label' => 'Porcentaje (%)', 'required' => true, 'example' => '25'],
                ['key' => 'documento', 'label' => 'Documento', 'required' => false, 'example' => '9876543210'],
                ['key' => 'telefono', 'label' => 'Teléfono', 'required' => false, 'example' => '3109876543'],
            ],
        ],
        'lots' => [
            'label' => 'Lotes',
            'columns' => [
                ['key' => 'proyecto', 'label' => 'Proyecto', 'required' => true, 'example' => 'Bosque Medina'],
                ['key' => 'numero', 'label' => 'Número', 'required' => true, 'example' => '9'],
                ['key' => 'manzana', 'label' => 'Manzana / Etapa', 'required' => false, 'example' => '2'],
                ['key' => 'area', 'label' => 'Área (m²)', 'required' => false, 'example' => '200'],
                ['key' => 'precio', 'label' => 'Precio', 'required' => false, 'example' => '35000000'],
                ['key' => 'estado', 'label' => 'Estado', 'required' => false, 'example' => 'available'],
            ],
        ],
        'sales' => [
            'label' => 'Ventas',
            'columns' => [
                ['key' => 'proyecto', 'label' => 'Proyecto', 'required' => true, 'example' => 'Bosque Medina'],
                ['key' => 'numero_lote', 'label' => 'Nro Lote', 'required' => true, 'example' => '1'],
                ['key' => 'cliente', 'label' => 'Cliente (nombre)', 'required' => true, 'example' => 'Juan Pérez'],
                ['key' => 'precio_venta', 'label' => 'Precio Venta', 'required' => true, 'example' => '35000000'],
                ['key' => 'fecha_venta', 'label' => 'Fecha Venta (YYYY-MM-DD)', 'required' => true, 'example' => '2026-01-15'],
                ['key' => 'tipo_pago', 'label' => 'Tipo Pago (contado/credito)', 'required' => false, 'example' => 'credito'],
                ['key' => 'cuota_inicial', 'label' => 'Cuota Inicial', 'required' => false, 'example' => '5000000'],
                ['key' => 'num_cuotas', 'label' => 'Nro Cuotas', 'required' => false, 'example' => '36'],
            ],
        ],
        'payments' => [
            'label' => 'Pagos',
            'columns' => [
                ['key' => 'proyecto', 'label' => 'Proyecto', 'required' => true, 'example' => 'Bosque Medina'],
                ['key' => 'numero_lote', 'label' => 'Nro Lote', 'required' => true, 'example' => '1'],
                ['key' => 'monto', 'label' => 'Monto', 'required' => true, 'example' => '1000000'],
                ['key' => 'fecha_pago', 'label' => 'Fecha Pago (YYYY-MM-DD)', 'required' => true, 'example' => '2026-02-01'],
                ['key' => 'metodo', 'label' => 'Método (efectivo/transferencia/cheque/tarjeta/otro)', 'required' => false, 'example' => 'transferencia'],
                ['key' => 'notas', 'label' => 'Notas', 'required' => false, 'example' => 'Pago cuota 1'],
            ],
        ],
        'expenses' => [
            'label' => 'Gastos',
            'columns' => [
                ['key' => 'proyecto', 'label' => 'Proyecto', 'required' => true, 'example' => 'Bosque Medina'],
                ['key' => 'descripcion', 'label' => 'Descripción', 'required' => true, 'example' => 'Compra de materiales'],
                ['key' => 'monto', 'label' => 'Monto', 'required' => true, 'example' => '500000'],
                ['key' => 'categoria', 'label' => 'Categoría (infrastructure/legal/marketing/administrative/other)', 'required' => true, 'example' => 'infrastructure'],
                ['key' => 'fecha', 'label' => 'Fecha (YYYY-MM-DD)', 'required' => true, 'example' => '2026-03-01'],
                ['key' => 'notas', 'label' => 'Notas', 'required' => false, 'example' => ''],
            ],
        ],
    ];

    jsonResponse(['data' => $templates]);
}

// ─── HELPER: Resolve project name → ID ───────────────────────────

function resolveProjectId($pdo, $name) {
    $name = trim($name);
    if (empty($name)) return null;
    $stmt = $pdo->prepare("SELECT id FROM projects WHERE LOWER(name) = LOWER(?) LIMIT 1");
    $stmt->execute([$name]);
    $row = $stmt->fetch();
    return $row ? $row['id'] : null;
}

function resolveClientId($pdo, $name) {
    $name = trim($name);
    if (empty($name)) return null;
    $stmt = $pdo->prepare("SELECT id FROM clients WHERE LOWER(name) = LOWER(?) LIMIT 1");
    $stmt->execute([$name]);
    $row = $stmt->fetch();
    return $row ? $row['id'] : null;
}

function resolveLotId($pdo, $projectId, $lotNumber, $manzana = null) {
    if (empty($projectId) || $lotNumber === null) return null;
    $lotNumber = trim($lotNumber);
    if ($manzana !== null && $manzana !== '') {
        $stmt = $pdo->prepare("SELECT id FROM lots WHERE project_id = ? AND number = ? AND manzana = ? LIMIT 1");
        $stmt->execute([$projectId, $lotNumber, trim($manzana)]);
    } else {
        $stmt = $pdo->prepare("SELECT id FROM lots WHERE project_id = ? AND number = ? LIMIT 1");
        $stmt->execute([$projectId, $lotNumber]);
    }
    $row = $stmt->fetch();
    return $row ? $row['id'] : null;
}

function resolveSaleId($pdo, $projectId, $lotNumber) {
    if (empty($projectId) || $lotNumber === null) return null;
    $lotId = resolveLotId($pdo, $projectId, $lotNumber);
    if (!$lotId) return null;
    $stmt = $pdo->prepare("SELECT id FROM sales WHERE project_id = ? AND lot_id = ? LIMIT 1");
    $stmt->execute([$projectId, $lotId]);
    $row = $stmt->fetch();
    return $row ? $row['id'] : null;
}

function normalizePaymentMethod($method) {
    $map = [
        'efectivo' => 'cash', 'cash' => 'cash',
        'transferencia' => 'transfer', 'transfer' => 'transfer',
        'cheque' => 'check', 'check' => 'check',
        'tarjeta' => 'card', 'card' => 'card',
        'otro' => 'other', 'other' => 'other',
    ];
    return $map[strtolower(trim($method))] ?? 'cash';
}

function normalizePaymentType($type) {
    $map = [
        'contado' => 'cash', 'cash' => 'cash',
        'credito' => 'credit', 'crédito' => 'credit', 'credit' => 'credit',
    ];
    return $map[strtolower(trim($type))] ?? 'cash';
}

function normalizeLotStatus($status) {
    $map = [
        'disponible' => 'available', 'available' => 'available',
        'reservado' => 'reserved', 'reserved' => 'reserved',
        'vendido' => 'sold', 'sold' => 'sold',
    ];
    return $map[strtolower(trim($status))] ?? 'available';
}

function normalizeDate($date) {
    if (empty($date)) return null;
    // Handle Excel serial dates
    if (is_numeric($date)) {
        $unix = ($date - 25569) * 86400;
        return date('Y-m-d', $unix);
    }
    // Handle various date formats
    $parsed = strtotime($date);
    if ($parsed === false) return null;
    return date('Y-m-d', $parsed);
}

// ─── IMPORT: CLIENTS ─────────────────────────────────────────────

function handleImportClients() {
    global $auth;
    $body = getJsonBody();
    $rows = $body['rows'] ?? [];
    if (empty($rows)) jsonError('No hay datos para importar');

    $pdo = getConnection();
    $imported = 0;
    $errors = [];

    foreach ($rows as $i => $row) {
        $rowNum = $i + 2; // +2 because row 1 is header, and 0-indexed
        try {
            $name = trim($row['nombre'] ?? '');
            if (empty($name)) {
                $errors[] = ['row' => $rowNum, 'message' => 'Nombre es requerido'];
                continue;
            }

            // Check for duplicate
            $stmt = $pdo->prepare("SELECT id FROM clients WHERE LOWER(name) = LOWER(?)");
            $stmt->execute([$name]);
            if ($stmt->fetch()) {
                $errors[] = ['row' => $rowNum, 'message' => "Cliente '$name' ya existe"];
                continue;
            }

            $id = generateUUID();
            $stmt = $pdo->prepare(
                "INSERT INTO clients (id, name, document, phone, email, address, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
            );
            $stmt->execute([
                $id,
                $name,
                trim($row['documento'] ?? ''),
                trim($row['telefono'] ?? ''),
                trim($row['email'] ?? ''),
                trim($row['direccion'] ?? ''),
                trim($row['notas'] ?? ''),
                $auth['sub'],
            ]);
            $imported++;
        } catch (PDOException $e) {
            $errors[] = ['row' => $rowNum, 'message' => $e->getMessage()];
        }
    }

    jsonResponse(['data' => ['imported' => $imported, 'total' => count($rows), 'errors' => $errors]]);
}

// ─── IMPORT: PROJECTS ────────────────────────────────────────────

function handleImportProjects() {
    global $auth;
    $body = getJsonBody();
    $rows = $body['rows'] ?? [];
    if (empty($rows)) jsonError('No hay datos para importar');

    $pdo = getConnection();
    $imported = 0;
    $errors = [];

    foreach ($rows as $i => $row) {
        $rowNum = $i + 2;
        try {
            $name = trim($row['nombre'] ?? '');
            $location = trim($row['ubicacion'] ?? '');
            if (empty($name) || empty($location)) {
                $errors[] = ['row' => $rowNum, 'message' => 'Nombre y Ubicación son requeridos'];
                continue;
            }

            // Check for duplicate
            $stmt = $pdo->prepare("SELECT id FROM projects WHERE LOWER(name) = LOWER(?)");
            $stmt->execute([$name]);
            if ($stmt->fetch()) {
                $errors[] = ['row' => $rowNum, 'message' => "Proyecto '$name' ya existe"];
                continue;
            }

            $id = generateUUID();
            $stmt = $pdo->prepare(
                "INSERT INTO projects (id, name, location, description, created_by) VALUES (?, ?, ?, ?, ?)"
            );
            $stmt->execute([
                $id,
                $name,
                $location,
                trim($row['descripcion'] ?? ''),
                $auth['sub'],
            ]);
            $imported++;
        } catch (PDOException $e) {
            $errors[] = ['row' => $rowNum, 'message' => $e->getMessage()];
        }
    }

    jsonResponse(['data' => ['imported' => $imported, 'total' => count($rows), 'errors' => $errors]]);
}

// ─── IMPORT: PARTNERS ────────────────────────────────────────────

function handleImportPartners() {
    $body = getJsonBody();
    $rows = $body['rows'] ?? [];
    if (empty($rows)) jsonError('No hay datos para importar');

    $pdo = getConnection();
    $imported = 0;
    $errors = [];

    foreach ($rows as $i => $row) {
        $rowNum = $i + 2;
        try {
            $projectName = trim($row['proyecto'] ?? '');
            $name = trim($row['nombre'] ?? '');
            $percentage = floatval($row['porcentaje'] ?? 0);

            if (empty($projectName) || empty($name) || $percentage <= 0) {
                $errors[] = ['row' => $rowNum, 'message' => 'Proyecto, Nombre y Porcentaje son requeridos'];
                continue;
            }

            $projectId = resolveProjectId($pdo, $projectName);
            if (!$projectId) {
                $errors[] = ['row' => $rowNum, 'message' => "Proyecto '$projectName' no encontrado"];
                continue;
            }

            $id = generateUUID();
            $stmt = $pdo->prepare(
                "INSERT INTO partners (id, project_id, name, percentage, document, phone) VALUES (?, ?, ?, ?, ?, ?)"
            );
            $stmt->execute([
                $id,
                $projectId,
                $name,
                $percentage,
                trim($row['documento'] ?? ''),
                trim($row['telefono'] ?? ''),
            ]);
            $imported++;
        } catch (PDOException $e) {
            $errors[] = ['row' => $rowNum, 'message' => $e->getMessage()];
        }
    }

    jsonResponse(['data' => ['imported' => $imported, 'total' => count($rows), 'errors' => $errors]]);
}

// ─── IMPORT: LOTS ────────────────────────────────────────────────

function handleImportLots() {
    $body = getJsonBody();
    $rows = $body['rows'] ?? [];
    if (empty($rows)) jsonError('No hay datos para importar');

    $pdo = getConnection();
    $imported = 0;
    $errors = [];

    foreach ($rows as $i => $row) {
        $rowNum = $i + 2;
        try {
            $projectName = trim($row['proyecto'] ?? '');
            $number = $row['numero'] ?? '';
            $manzana = isset($row['manzana']) && trim($row['manzana']) !== '' ? trim($row['manzana']) : null;

            if (empty($projectName) || $number === '') {
                $errors[] = ['row' => $rowNum, 'message' => 'Proyecto y Número son requeridos'];
                continue;
            }

            $projectId = resolveProjectId($pdo, $projectName);
            if (!$projectId) {
                $errors[] = ['row' => $rowNum, 'message' => "Proyecto '$projectName' no encontrado"];
                continue;
            }

            // Check for duplicate lot (considering manzana)
            $numTrimmed = trim($number);
            if ($manzana !== null) {
                $stmt = $pdo->prepare("SELECT id FROM lots WHERE project_id = ? AND number = ? AND manzana = ?");
                $stmt->execute([$projectId, $numTrimmed, $manzana]);
            } else {
                $stmt = $pdo->prepare("SELECT id FROM lots WHERE project_id = ? AND number = ? AND manzana IS NULL");
                $stmt->execute([$projectId, $numTrimmed]);
            }
            if ($stmt->fetch()) {
                $mzLabel = $manzana ? " Mz/Etapa $manzana" : '';
                $errors[] = ['row' => $rowNum, 'message' => "Lote #$number$mzLabel ya existe en '$projectName'"];
                continue;
            }

            $id = generateUUID();
            $status = normalizeLotStatus($row['estado'] ?? 'available');
            $stmt = $pdo->prepare(
                "INSERT INTO lots (id, project_id, number, manzana, area, price, status) VALUES (?, ?, ?, ?, ?, ?, ?)"
            );
            $stmt->execute([
                $id,
                $projectId,
                trim($number),
                $manzana,
                floatval($row['area'] ?? 0) ?: null,
                floatval($row['precio'] ?? 0) ?: null,
                $status,
            ]);
            $imported++;
        } catch (PDOException $e) {
            $errors[] = ['row' => $rowNum, 'message' => $e->getMessage()];
        }
    }

    jsonResponse(['data' => ['imported' => $imported, 'total' => count($rows), 'errors' => $errors]]);
}

// ─── IMPORT: SALES ───────────────────────────────────────────────

function handleImportSales() {
    global $auth;
    $body = getJsonBody();
    $rows = $body['rows'] ?? [];
    if (empty($rows)) jsonError('No hay datos para importar');

    $pdo = getConnection();
    $imported = 0;
    $errors = [];

    foreach ($rows as $i => $row) {
        $rowNum = $i + 2;
        try {
            $projectName = trim($row['proyecto'] ?? '');
            $lotNumber = $row['numero_lote'] ?? '';
            $clientName = trim($row['cliente'] ?? '');
            $salePrice = floatval($row['precio_venta'] ?? 0);
            $saleDate = normalizeDate($row['fecha_venta'] ?? '');

            if (empty($projectName) || $lotNumber === '' || empty($clientName) || $salePrice <= 0 || !$saleDate) {
                $errors[] = ['row' => $rowNum, 'message' => 'Proyecto, Lote, Cliente, Precio y Fecha son requeridos'];
                continue;
            }

            $projectId = resolveProjectId($pdo, $projectName);
            if (!$projectId) {
                $errors[] = ['row' => $rowNum, 'message' => "Proyecto '$projectName' no encontrado"];
                continue;
            }

            $lotId = resolveLotId($pdo, $projectId, $lotNumber);
            if (!$lotId) {
                $errors[] = ['row' => $rowNum, 'message' => "Lote #$lotNumber no encontrado en '$projectName'"];
                continue;
            }

            $clientId = resolveClientId($pdo, $clientName);
            if (!$clientId) {
                $errors[] = ['row' => $rowNum, 'message' => "Cliente '$clientName' no encontrado. Impórtelo primero."];
                continue;
            }

            // Check if lot already sold
            $stmt = $pdo->prepare("SELECT id FROM sales WHERE lot_id = ?");
            $stmt->execute([$lotId]);
            if ($stmt->fetch()) {
                $errors[] = ['row' => $rowNum, 'message' => "Lote #$lotNumber ya tiene una venta registrada"];
                continue;
            }

            $paymentType = normalizePaymentType($row['tipo_pago'] ?? 'cash');
            $downPayment = floatval($row['cuota_inicial'] ?? 0);
            $numInstallments = intval($row['num_cuotas'] ?? 1);
            if ($numInstallments < 1) $numInstallments = 1;

            $id = generateUUID();
            $stmt = $pdo->prepare(
                "INSERT INTO sales (id, project_id, lot_id, client_id, sale_price, sale_date, payment_type, down_payment, installments, created_by) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            );
            $stmt->execute([
                $id, $projectId, $lotId, $clientId, $salePrice,
                $saleDate, $paymentType, $downPayment, $numInstallments, $auth['sub'],
            ]);

            // Update lot status to sold
            $pdo->prepare("UPDATE lots SET status = 'sold' WHERE id = ?")->execute([$lotId]);

            $imported++;
        } catch (PDOException $e) {
            $errors[] = ['row' => $rowNum, 'message' => $e->getMessage()];
        }
    }

    jsonResponse(['data' => ['imported' => $imported, 'total' => count($rows), 'errors' => $errors]]);
}

// ─── IMPORT: PAYMENTS ────────────────────────────────────────────

function handleImportPayments() {
    global $auth;
    $body = getJsonBody();
    $rows = $body['rows'] ?? [];
    if (empty($rows)) jsonError('No hay datos para importar');

    $pdo = getConnection();
    $imported = 0;
    $errors = [];

    foreach ($rows as $i => $row) {
        $rowNum = $i + 2;
        try {
            $projectName = trim($row['proyecto'] ?? '');
            $lotNumber = $row['numero_lote'] ?? '';
            $amount = floatval($row['monto'] ?? 0);
            $paymentDate = normalizeDate($row['fecha_pago'] ?? '');

            if (empty($projectName) || $lotNumber === '' || $amount <= 0 || !$paymentDate) {
                $errors[] = ['row' => $rowNum, 'message' => 'Proyecto, Lote, Monto y Fecha son requeridos'];
                continue;
            }

            $projectId = resolveProjectId($pdo, $projectName);
            if (!$projectId) {
                $errors[] = ['row' => $rowNum, 'message' => "Proyecto '$projectName' no encontrado"];
                continue;
            }

            $saleId = resolveSaleId($pdo, $projectId, $lotNumber);
            if (!$saleId) {
                $errors[] = ['row' => $rowNum, 'message' => "No se encontró venta para Lote #$lotNumber en '$projectName'"];
                continue;
            }

            $paymentMethod = normalizePaymentMethod($row['metodo'] ?? 'cash');

            $id = generateUUID();
            $stmt = $pdo->prepare(
                "INSERT INTO payments (id, sale_id, amount, payment_date, payment_method, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)"
            );
            $stmt->execute([
                $id, $saleId, $amount, $paymentDate,
                $paymentMethod, trim($row['notas'] ?? ''), $auth['sub'],
            ]);
            $imported++;
        } catch (PDOException $e) {
            $errors[] = ['row' => $rowNum, 'message' => $e->getMessage()];
        }
    }

    jsonResponse(['data' => ['imported' => $imported, 'total' => count($rows), 'errors' => $errors]]);
}

// ─── IMPORT: EXPENSES ────────────────────────────────────────────

function handleImportExpenses() {
    global $auth;
    $body = getJsonBody();
    $rows = $body['rows'] ?? [];
    if (empty($rows)) jsonError('No hay datos para importar');

    $pdo = getConnection();
    $imported = 0;
    $errors = [];

    foreach ($rows as $i => $row) {
        $rowNum = $i + 2;
        try {
            $projectName = trim($row['proyecto'] ?? '');
            $description = trim($row['descripcion'] ?? '');
            $amount = floatval($row['monto'] ?? 0);
            $category = strtolower(trim($row['categoria'] ?? 'other'));
            $date = normalizeDate($row['fecha'] ?? '');

            if (empty($projectName) || empty($description) || $amount <= 0 || !$date) {
                $errors[] = ['row' => $rowNum, 'message' => 'Proyecto, Descripción, Monto y Fecha son requeridos'];
                continue;
            }

            $projectId = resolveProjectId($pdo, $projectName);
            if (!$projectId) {
                $errors[] = ['row' => $rowNum, 'message' => "Proyecto '$projectName' no encontrado"];
                continue;
            }

            // Validate category
            $validCategories = ['infrastructure', 'legal', 'marketing', 'administrative', 'other',
                               'signatures', 'deeds', 'utilities'];
            if (!in_array($category, $validCategories)) {
                $category = 'other';
            }

            $id = generateUUID();
            $stmt = $pdo->prepare(
                "INSERT INTO expenses (id, project_id, description, amount, category, expense_date, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
            );
            $stmt->execute([
                $id, $projectId, $description, $amount,
                $category, $date, trim($row['notas'] ?? ''), $auth['sub'],
            ]);
            $imported++;
        } catch (PDOException $e) {
            $errors[] = ['row' => $rowNum, 'message' => $e->getMessage()];
        }
    }

    jsonResponse(['data' => ['imported' => $imported, 'total' => count($rows), 'errors' => $errors]]);
}
