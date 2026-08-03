<?php
/**
 * LoteClick API - Sales Endpoints
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../jwt.php';
require_once __DIR__ . '/../push-helper.php';

$auth = requireAuth();
$action = getParam('action', '');
$method = getMethod();

if ($action === 'byProject') {
    getSalesByProject();
    exit;
}

switch ($method) {
    case 'GET':
        $id = getParam('id');
        $id ? getSale($id) : getAllSales();
        break;
    case 'POST':
        createSale();
        break;
    case 'PUT':
    case 'PATCH':
        $id = getParam('id');
        if (!$id) jsonError('ID requerido');
        updateSale($id);
        break;
    case 'DELETE':
        requireRole('admin');
        $id = getParam('id');
        if (!$id) jsonError('ID requerido');
        deleteSale($id);
        break;
    default:
        jsonError('Método no permitido', 405);
}

function enrichSale($pdo, $sale) {
    // Get project info
    try {
        $stmt = $pdo->prepare("SELECT id, name, location FROM projects WHERE id = ?");
        $stmt->execute([$sale['project_id']]);
        $sale['project'] = $stmt->fetch() ?: null;
    } catch (Exception $e) { $sale['project'] = null; }

    // Get lot info (with manzana/etapa_name if columns exist)
    try {
        $stmt = $pdo->prepare("SELECT id, number, area, price, manzana, etapa_name FROM lots WHERE id = ?");
        $stmt->execute([$sale['lot_id']]);
        $sale['lot'] = $stmt->fetch() ?: null;
    } catch (Exception $e) {
        // Fallback without manzana/etapa_name if columns don't exist yet
        try {
            $stmt = $pdo->prepare("SELECT id, number, area, price FROM lots WHERE id = ?");
            $stmt->execute([$sale['lot_id']]);
            $sale['lot'] = $stmt->fetch() ?: null;
        } catch (Exception $e2) { $sale['lot'] = null; }
    }

    // Get client info
    try {
        $stmt = $pdo->prepare("SELECT id, name, document, phone, email, address FROM clients WHERE id = ?");
        $stmt->execute([$sale['client_id']]);
        $sale['client'] = $stmt->fetch() ?: null;
    } catch (Exception $e) { $sale['client'] = null; }

    // Get payments
    try {
        $stmt = $pdo->prepare("SELECT * FROM payments WHERE sale_id = ? ORDER BY payment_date DESC");
        $stmt->execute([$sale['id']]);
        $sale['payments'] = $stmt->fetchAll();
    } catch (Exception $e) { $sale['payments'] = []; }

    // Get sale_lots (table may not exist in all deployments)
    try {
        $stmt = $pdo->prepare("SELECT sl.*, l.area FROM sale_lots sl LEFT JOIN lots l ON sl.lot_id = l.id WHERE sl.sale_id = ? ORDER BY LENGTH(sl.lot_number) ASC, sl.lot_number ASC");
        $stmt->execute([$sale['id']]);
        $sale['sale_lots'] = $stmt->fetchAll();
    } catch (Exception $e) { $sale['sale_lots'] = []; }

    return $sale;
}


function getAllSales() {
    $pdo = getConnection();
    $stmt = $pdo->query("SELECT * FROM sales ORDER BY created_at DESC");
    $sales = $stmt->fetchAll();

    foreach ($sales as &$s) {
        $s = enrichSale($pdo, $s);
    }

    jsonResponse(['data' => $sales]);
}

function getSale($id) {
    $pdo = getConnection();
    $stmt = $pdo->prepare("SELECT * FROM sales WHERE id = ?");
    $stmt->execute([$id]);
    $sale = $stmt->fetch();
    if (!$sale) jsonError('Venta no encontrada', 404);

    $sale = enrichSale($pdo, $sale);
    jsonResponse(['data' => $sale]);
}

function getSalesByProject() {
    $pdo = getConnection();
    $projectId = getParam('projectId');
    if (!$projectId) jsonError('projectId requerido');

    $stmt = $pdo->prepare("SELECT * FROM sales WHERE project_id = ? ORDER BY sale_date DESC");
    $stmt->execute([$projectId]);
    $sales = $stmt->fetchAll();

    foreach ($sales as &$s) {
        $s = enrichSale($pdo, $s);
    }

    jsonResponse(['data' => $sales]);
}

function createSale() {
    $pdo = getConnection();
    $body = getJsonBody();
    $id = generateUUID();

    forceUppercase($body, ['notes', 'commission_agent']);

    // ✅ VALIDACIÓN: Verificar que el lote no esté ya vendido
    $checkLotId = $body['lot_id'] ?? $body['lotId'] ?? null;
    if ($checkLotId) {
        $checkStmt = $pdo->prepare("SELECT id, status FROM lots WHERE id = ?");
        $checkStmt->execute([$checkLotId]);
        $checkLot = $checkStmt->fetch();
        if ($checkLot && in_array($checkLot['status'], ['sold', 'pending_initial'])) {
            jsonError('Este lote ya fue vendido o tiene una venta en proceso. No se puede vender dos veces.', 409);
        }
    }

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            "INSERT INTO sales (id, project_id, lot_id, client_id, sale_price, sale_date, payment_type, down_payment, installments, notes, commission_agent, commission_agent_id, commission_amount, original_price, discount_amount, discount_authorized_by, discount_partner_name, discount_status, include_acometida, acometida_value, acometida_paid) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );

        $paymentType = $body['payment_type'] ?? $body['paymentType'] ?? 'cash';
        if ($paymentType === 'installments') $paymentType = 'credit';

        $discountAmount = isset($body['discount_amount']) ? floatval($body['discount_amount']) : 
                         (isset($body['discountAmount']) ? floatval($body['discountAmount']) : null);
        $discountAuthorizedBy = $body['discount_authorized_by'] ?? $body['discountAuthorizedBy'] ?? null;
        $discountPartnerName = $body['discount_partner_name'] ?? $body['discountPartnerName'] ?? null;
        $discountStatus = ($discountAmount && $discountAmount > 0) ? 'pending' : null;
        $originalPrice = $body['original_price'] ?? $body['originalPrice'] ?? null;
        if ($originalPrice) $originalPrice = floatval($originalPrice);

        $include_acometida = isset($body['include_acometida']) ? ($body['include_acometida'] ? 1 : 0) : 0;
        $acometida_value = isset($body['acometida_value']) ? floatval($body['acometida_value']) : 0;
        $acometida_paid = isset($body['acometida_paid']) ? ($body['acometida_paid'] ? 1 : 0) : 0;

        $stmt->execute([
            $id,
            $body['project_id'] ?? $body['projectId'],
            $body['lot_id'] ?? $body['lotId'],
            $body['client_id'] ?? $body['clientId'],
            floatval($body['sale_price'] ?? $body['totalPrice'] ?? 0),
            $body['sale_date'] ?? $body['saleDate'] ?? date('Y-m-d'),
            $paymentType,
            floatval($body['down_payment'] ?? $body['downPayment'] ?? 0),
            intval($body['installments'] ?? $body['numberOfInstallments'] ?? 1),
            $body['notes'] ?? null,
            $body['commission_agent'] ?? $body['commissionAgent'] ?? null,
            $body['commission_agent_id'] ?? $body['commissionAgentId'] ?? null,
            isset($body['commission_amount']) ? floatval($body['commission_amount']) : 
                (isset($body['commissionAmount']) ? floatval($body['commissionAmount']) : null),
            $originalPrice,
            $discountAmount,
            $discountAuthorizedBy,
            $discountPartnerName,
            $discountStatus,
            $include_acometida,
            $acometida_value,
            $acometida_paid
        ]);

        // Mark lot status: pending_initial for credit sales, sold for cash
        $lotId = $body['lot_id'] ?? $body['lotId'];
        $lotStatus = ($paymentType === 'credit') ? 'pending_initial' : 'sold';
        $pdo->prepare("UPDATE lots SET status = ? WHERE id = ?")->execute([$lotStatus, $lotId]);

        // Handle sale_lots for grouped multi-lot sales
        $saleLots = $body['sale_lots'] ?? $body['saleLots'] ?? [];
        if (!empty($saleLots)) {
            $slStmt = $pdo->prepare(
                "INSERT INTO sale_lots (id, sale_id, lot_id, lot_number, original_price, sale_price) VALUES (?, ?, ?, ?, ?, ?)"
            );
            foreach ($saleLots as $sl) {
                $slLotId = $sl['lot_id'] ?? $sl['lotId'];
                $slStmt->execute([
                    generateUUID(),
                    $id,
                    $slLotId,
                    $sl['lot_number'] ?? $sl['lotNumber'] ?? null,
                    floatval($sl['original_price'] ?? $sl['originalPrice'] ?? 0),
                    floatval($sl['sale_price'] ?? $sl['salePrice'] ?? 0)
                ]);
                // Mark each additional lot
                $pdo->prepare("UPDATE lots SET status = ? WHERE id = ?")->execute([$lotStatus, $slLotId]);
            }
        }

        // Create notification if discount was applied
        if ($discountAmount && $discountAmount > 0 && $discountAuthorizedBy) {
            $notifId = generateUUID();
            $clientName = $body['client_name'] ?? $body['clientName'] ?? 'Cliente';
            $lotNumber = $body['lot_number'] ?? $body['lotNumber'] ?? 'N/A';
            $salePrice = floatval($body['sale_price'] ?? $body['totalPrice'] ?? 0);
            
            // Look up the seller's name (who created this sale)
            global $auth;
            $sellerName = 'Desconocido';
            if (isset($auth['sub'])) {
                $sellerStmt = $pdo->prepare("SELECT name FROM profiles WHERE id = ?");
                $sellerStmt->execute([$auth['sub']]);
                $sellerRow = $sellerStmt->fetch();
                if ($sellerRow) $sellerName = $sellerRow['name'];
            }
            
            // Look up the real user ID by partner name (project partners use random IDs, not user IDs)
            $realUserId = $discountAuthorizedBy; // fallback to the project partner ID
            if ($discountPartnerName) {
                $userLookup = $pdo->prepare("SELECT id FROM profiles WHERE name = ? AND role = 'partner' LIMIT 1");
                $userLookup->execute([$discountPartnerName]);
                $foundUser = $userLookup->fetch();
                if ($foundUser) {
                    $realUserId = $foundUser['id'];
                }
            }
            
            $notifStmt = $pdo->prepare(
                "INSERT INTO notifications (id, recipient_type, recipient_id, type, title, message, reference_id, reference_type) 
                 VALUES (?, 'partner', ?, 'discount_request', ?, ?, ?, 'sale')"
            );
            $notifStmt->execute([
                $notifId,
                $realUserId,
                'Solicitud de Descuento',
                "Se ha aplicado un descuento de $" . number_format($discountAmount, 0, ',', '.') . " en la venta del Lote #$lotNumber. Precio original: $" . number_format($originalPrice, 0, ',', '.') . ", Precio de venta: $" . number_format($salePrice, 0, ',', '.') . ". Cliente: $clientName. Vendedor: $sellerName. La venta se realizó sin detener el proceso.",
                $id,
            ]);
            
            // Send push notification to the partner
            try {
                $pushMessage = "Descuento de $" . number_format($discountAmount, 0, ',', '.') . " en Lote #$lotNumber. Vendedor: $sellerName.";
                sendPushToUser($pdo, $realUserId, 'Solicitud de Descuento', $pushMessage, ['route' => '/notifications']);
            } catch (Exception $e) {
                // Push failure should not break the sale
                error_log('Push notification failed: ' . $e->getMessage());
            }
        }

        $pdo->commit();

        $stmt = $pdo->prepare("SELECT * FROM sales WHERE id = ?");
        $stmt->execute([$id]);
        $saleRow = $stmt->fetch();

        // Audit log
        $userName = $auth['name'] ?? $auth['email'] ?? 'Sistema';
        $lotNum = $body['lot_number'] ?? $body['lotNumber'] ?? 'N/A';
        $clientNm = $body['client_name'] ?? $body['clientName'] ?? '';
        logAudit($auth['sub'] ?? '', $userName, 'create', 'sale', $id, null, null,
            null, "Venta creada: Lote #$lotNum — Cliente $clientNm — $" . number_format(floatval($body['sale_price'] ?? $body['totalPrice'] ?? 0), 0, '.', '.'));

        jsonResponse(['data' => $saleRow], 201);

    } catch (Exception $e) {
        $pdo->rollBack();
        jsonError('Error al crear venta: ' . $e->getMessage(), 500);
    }
}

function updateSale($id) {
    global $auth;
    $pdo = getConnection();
    $body = getJsonBody();

    // Check role: only admin and treasurer can update sales
    $userRole = $auth['role'] ?? 'seller';
    $userRoles = [];
    if (is_string($userRole) && str_starts_with($userRole, '[')) {
        $userRoles = json_decode($userRole, true) ?: [$userRole];
    } elseif ($userRole === 'seller_treasurer') {
        $userRoles = ['seller', 'treasurer'];
    } else {
        $userRoles = [$userRole];
    }
    
    if (!in_array('admin', $userRoles) && !in_array('treasurer', $userRoles)) {
        jsonError('Solo administradores y tesoreros pueden editar ventas', 403);
    }

    forceUppercase($body, ['notes', 'commission_agent']);

    $paymentType = $body['payment_type'] ?? $body['paymentType'] ?? 'cash';
    if ($paymentType === 'installments') $paymentType = 'credit';

    $include_acometida = isset($body['include_acometida']) ? ($body['include_acometida'] ? 1 : 0) : 0;
    $acometida_value = isset($body['acometida_value']) ? floatval($body['acometida_value']) : 0;
    $acometida_paid = isset($body['acometida_paid']) ? ($body['acometida_paid'] ? 1 : 0) : 0;

    $fields = "project_id = ?, lot_id = ?, client_id = ?, sale_price = ?, sale_date = ?, 
         payment_type = ?, down_payment = ?, installments = ?, notes = ?, commission_agent = ?,
         commission_agent_id = ?, commission_amount = ?, original_price = ?, discount_amount = ?,
         discount_authorized_by = ?, discount_partner_name = ?, discount_status = ?";
    $params = [
        $body['project_id'] ?? $body['projectId'],
        $body['lot_id'] ?? $body['lotId'],
        $body['client_id'] ?? $body['clientId'],
        floatval($body['sale_price'] ?? $body['totalPrice'] ?? 0),
        $body['sale_date'] ?? $body['saleDate'],
        $paymentType,
        floatval($body['down_payment'] ?? $body['downPayment'] ?? 0),
        intval($body['installments'] ?? 1),
        $body['notes'] ?? null,
        $body['commission_agent'] ?? $body['commissionAgent'] ?? null,
        $body['commission_agent_id'] ?? $body['commissionAgentId'] ?? null,
        isset($body['commission_amount']) ? floatval($body['commission_amount']) : 
            (isset($body['commissionAmount']) ? floatval($body['commissionAmount']) : null),
        isset($body['original_price']) ? floatval($body['original_price']) : 
            (isset($body['originalPrice']) ? floatval($body['originalPrice']) : null),
        isset($body['discount_amount']) ? floatval($body['discount_amount']) : 
            (isset($body['discountAmount']) ? floatval($body['discountAmount']) : null),
        $body['discount_authorized_by'] ?? $body['discountAuthorizedBy'] ?? null,
        $body['discount_partner_name'] ?? $body['discountPartnerName'] ?? null,
        $body['discount_status'] ?? $body['discountStatus'] ?? null
    ];

    if (isset($body['include_acometida'])) {
        $fields .= ", include_acometida = ?, acometida_value = ?, acometida_paid = ?";
        $params[] = $include_acometida;
        $params[] = $acometida_value;
        $params[] = $acometida_paid;
    }
    
    // Add missing DB columns gracefully if not exist
    try { $pdo->exec("ALTER TABLE sales ADD COLUMN commission_paid TINYINT(1) DEFAULT 0"); } catch(Exception $e) {}
    
    if (isset($body['commission_paid'])) {
        $fields .= ", commission_paid = ?";
        $params[] = $body['commission_paid'] ? 1 : 0;
    }

    $params[] = $id;

    // Log changes
    $oldSale = $pdo->prepare("SELECT * FROM sales WHERE id = ?");
    $oldSale->execute([$id]);
    $oldData = $oldSale->fetch();

    $stmt = $pdo->prepare("UPDATE sales SET $fields WHERE id = ?");
    $stmt->execute($params);

    // Audit log
    global $auth;
    $userName = 'Unknown';
    if (isset($auth['sub'])) {
        $uStmt = $pdo->prepare("SELECT name FROM profiles WHERE id = ?");
        $uStmt->execute([$auth['sub']]);
        $uRow = $uStmt->fetch();
        if ($uRow) $userName = $uRow['name'];
    }
    
    // Compare key fields
    $trackFields = ['sale_price', 'client_id', 'lot_id', 'payment_type', 'notes', 'commission_agent', 'commission_amount', 'down_payment', 'installments'];
    if ($oldData) {
        foreach ($trackFields as $f) {
            $oldVal = $oldData[$f] ?? '';
            $newVal = $body[$f] ?? $body[lcfirst(str_replace('_', '', ucwords($f, '_')))] ?? $oldVal;
            if ((string)$oldVal !== (string)$newVal) {
                logAudit($auth['sub'] ?? '', $userName, 'update', 'sale', $id, $f, (string)$oldVal, (string)$newVal);
            }
        }
    }

    $stmt = $pdo->prepare("SELECT * FROM sales WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(['data' => $stmt->fetch()]);
}

function deleteSale($id) {
    $pdo = getConnection();

    // Get lot_id before deleting to mark it as available
    $stmt = $pdo->prepare("SELECT lot_id FROM sales WHERE id = ?");
    $stmt->execute([$id]);
    $sale = $stmt->fetch();

    if ($sale) {
        $pdo->prepare("UPDATE lots SET status = 'available' WHERE id = ?")->execute([$sale['lot_id']]);
    }

    // Also free lots in sale_lots (grouped multi-lot sales)
    $stmt = $pdo->prepare("SELECT lot_id FROM sale_lots WHERE sale_id = ?");
    $stmt->execute([$id]);
    $saleLots = $stmt->fetchAll();
    foreach ($saleLots as $sl) {
        $pdo->prepare("UPDATE lots SET status = 'available' WHERE id = ?")->execute([$sl['lot_id']]);
    }

    // Audit log before delete
    global $auth;
    $userName = 'Unknown';
    if (isset($auth['sub'])) {
        $uStmt = $pdo->prepare("SELECT name FROM profiles WHERE id = ?");
        $uStmt->execute([$auth['sub']]);
        $uRow = $uStmt->fetch();
        if ($uRow) $userName = $uRow['name'];
    }
    logAudit($auth['sub'] ?? '', $userName, 'delete', 'sale', $id, null, null, null, 'Venta eliminada');

    $pdo->prepare("DELETE FROM sales WHERE id = ?")->execute([$id]);
    jsonResponse(['data' => ['id' => $id, 'deleted' => true]]);
}
