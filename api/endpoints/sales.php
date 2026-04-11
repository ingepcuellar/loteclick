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
        $id = getParam('id');
        if (!$id) jsonError('ID requerido');
        deleteSale($id);
        break;
    default:
        jsonError('Método no permitido', 405);
}

function enrichSale($pdo, $sale) {
    // Get project info
    $stmt = $pdo->prepare("SELECT id, name, location FROM projects WHERE id = ?");
    $stmt->execute([$sale['project_id']]);
    $sale['project'] = $stmt->fetch() ?: null;

    // Get lot info
    $stmt = $pdo->prepare("SELECT id, number, area, price FROM lots WHERE id = ?");
    $stmt->execute([$sale['lot_id']]);
    $sale['lot'] = $stmt->fetch() ?: null;

    // Get client info
    $stmt = $pdo->prepare("SELECT id, name, document, phone, email, address FROM clients WHERE id = ?");
    $stmt->execute([$sale['client_id']]);
    $sale['client'] = $stmt->fetch() ?: null;

    // Get payments
    $stmt = $pdo->prepare("SELECT * FROM payments WHERE sale_id = ? ORDER BY payment_date DESC");
    $stmt->execute([$sale['id']]);
    $sale['payments'] = $stmt->fetchAll();

    // Get sale_lots (for grouped multi-lot sales)
    $stmt = $pdo->prepare("SELECT sl.*, l.area FROM sale_lots sl LEFT JOIN lots l ON sl.lot_id = l.id WHERE sl.sale_id = ? ORDER BY sl.lot_number");
    $stmt->execute([$sale['id']]);
    $saleLots = $stmt->fetchAll();
    $sale['sale_lots'] = $saleLots;

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

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            "INSERT INTO sales (id, project_id, lot_id, client_id, sale_price, sale_date, payment_type, down_payment, installments, notes, commission_agent, commission_agent_id, commission_amount, original_price, discount_amount, discount_authorized_by, discount_partner_name, discount_status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
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
            $discountStatus
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
        jsonResponse(['data' => $stmt->fetch()], 201);

    } catch (Exception $e) {
        $pdo->rollBack();
        jsonError('Error al crear venta: ' . $e->getMessage(), 500);
    }
}

function updateSale($id) {
    $pdo = getConnection();
    $body = getJsonBody();

    $paymentType = $body['payment_type'] ?? $body['paymentType'] ?? 'cash';
    if ($paymentType === 'installments') $paymentType = 'credit';

    $stmt = $pdo->prepare(
        "UPDATE sales SET project_id = ?, lot_id = ?, client_id = ?, sale_price = ?, sale_date = ?, 
         payment_type = ?, down_payment = ?, installments = ?, notes = ?, commission_agent = ?,
         commission_agent_id = ?, commission_amount = ?, original_price = ?, discount_amount = ?,
         discount_authorized_by = ?, discount_partner_name = ?, discount_status = ? WHERE id = ?"
    );
    $stmt->execute([
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
        $body['discount_status'] ?? $body['discountStatus'] ?? null,
        $id
    ]);

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

    $pdo->prepare("DELETE FROM sales WHERE id = ?")->execute([$id]);
    jsonResponse(['data' => ['id' => $id, 'deleted' => true]]);
}
