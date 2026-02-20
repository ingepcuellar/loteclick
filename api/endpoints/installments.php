<?php
/**
 * LoteClick API - Installments Endpoints
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../jwt.php';

$auth = requireAuth();
$action = getParam('action', '');
$method = getMethod();

switch ($action) {
    case 'bySale':
        getInstallmentsBySale();
        break;
    case 'generate':
        generateInstallments();
        break;
    case 'markAsPaid':
        markAsPaid();
        break;
    case 'markAsPartial':
        markAsPartial();
        break;
    case 'recalculate':
        recalculateInstallments();
        break;
    case 'restructure':
        restructureInstallments();
        break;
    case 'calculateRestructure':
        calculateRestructure();
        break;
    case 'autoRedistribute':
        autoRedistributeInstallments();
        break;
    case 'overdue':
        getOverdueInstallments();
        break;
    case 'deleteBySale':
        deleteBySale();
        break;
    default:
        // Standard CRUD
        switch ($method) {
            case 'GET':
                $id = getParam('id');
                $id ? getInstallment($id) : getAllInstallments();
                break;
            case 'PUT':
            case 'PATCH':
                $id = getParam('id');
                if (!$id) jsonError('ID requerido');
                updateInstallment($id);
                break;
            case 'DELETE':
                $id = getParam('id');
                if (!$id) jsonError('ID requerido');
                deleteInstallment($id);
                break;
            default:
                jsonError('Acción no válida', 400);
        }
}

function getAllInstallments() {
    $pdo = getConnection();
    $stmt = $pdo->query("SELECT * FROM installments ORDER BY due_date ASC");
    jsonResponse(['data' => $stmt->fetchAll()]);
}

function getInstallment($id) {
    $pdo = getConnection();
    $stmt = $pdo->prepare("SELECT * FROM installments WHERE id = ?");
    $stmt->execute([$id]);
    $inst = $stmt->fetch();
    if (!$inst) jsonError('Cuota no encontrada', 404);
    jsonResponse(['data' => $inst]);
}

function getInstallmentsBySale() {
    $pdo = getConnection();
    $saleId = getParam('saleId');
    if (!$saleId) jsonError('saleId requerido');

    $stmt = $pdo->prepare("SELECT * FROM installments WHERE sale_id = ? ORDER BY installment_number ASC");
    $stmt->execute([$saleId]);
    jsonResponse(['data' => $stmt->fetchAll()]);
}

function generateInstallments() {
    if (getMethod() !== 'POST') jsonError('Método no permitido', 405);

    $body = getJsonBody();
    $saleId = $body['saleId'] ?? $body['sale_id'] ?? null;
    $totalAmount = floatval($body['totalAmount'] ?? 0);
    $numInstallments = intval($body['numInstallments'] ?? 0);
    $startDate = $body['startDate'] ?? date('Y-m-d');
    $downPayment = floatval($body['downPayment'] ?? 0);

    if (!$saleId || $numInstallments <= 0) {
        jsonError('saleId y numInstallments son requeridos');
    }

    $pdo = getConnection();

    // Delete existing installments for this sale
    $pdo->prepare("DELETE FROM installments WHERE sale_id = ?")->execute([$saleId]);

    $installmentAmount = round($totalAmount / $numInstallments, 2);
    $installments = [];

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            "INSERT INTO installments (id, sale_id, installment_number, amount, due_date, status, paid_amount) 
             VALUES (?, ?, ?, ?, ?, ?, ?)"
        );

        // Installment #0: Down payment (cuota inicial / enganche)
        if ($downPayment > 0) {
            $downId = generateUUID();
            $stmt->execute([$downId, $saleId, 0, $downPayment, $startDate, 'pending', 0]);
            $installments[] = [
                'id' => $downId,
                'sale_id' => $saleId,
                'installment_number' => 0,
                'amount' => $downPayment,
                'due_date' => $startDate,
                'status' => 'pending',
                'paid_amount' => 0
            ];
        }

        // Regular installments #1 to #N
        for ($i = 1; $i <= $numInstallments; $i++) {
            $dueDate = date('Y-m-d', strtotime("$startDate +$i months"));

            // Last installment gets the remainder to avoid rounding issues
            $amount = ($i === $numInstallments)
                ? round($totalAmount - ($installmentAmount * ($numInstallments - 1)), 2)
                : $installmentAmount;

            $instId = generateUUID();
            $stmt->execute([$instId, $saleId, $i, $amount, $dueDate, 'pending', 0]);

            $installments[] = [
                'id' => $instId,
                'sale_id' => $saleId,
                'installment_number' => $i,
                'amount' => $amount,
                'due_date' => $dueDate,
                'status' => 'pending',
                'paid_amount' => 0
            ];
        }

        $pdo->commit();
        jsonResponse(['data' => $installments], 201);
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonError('Error al generar cuotas: ' . $e->getMessage(), 500);
    }
}

function markAsPaid() {
    if (getMethod() !== 'POST' && getMethod() !== 'PATCH') jsonError('Método no permitido', 405);

    $body = getJsonBody();
    $id = $body['id'] ?? getParam('id');
    $paymentId = $body['paymentId'] ?? $body['payment_id'] ?? null;

    if (!$id) jsonError('ID requerido');

    $pdo = getConnection();
    
    // Get the installment first to check if it's #0 (down payment)
    $stmt = $pdo->prepare("SELECT * FROM installments WHERE id = ?");
    $stmt->execute([$id]);
    $installment = $stmt->fetch();
    if (!$installment) jsonError('Cuota no encontrada', 404);

    $stmt = $pdo->prepare(
        "UPDATE installments SET status = 'paid', paid_amount = amount, paid_date = CURDATE(), payment_id = ? WHERE id = ?"
    );
    $stmt->execute([$paymentId, $id]);

    // If installment #0 (down payment) was paid, transition lot status to 'sold'
    if (intval($installment['installment_number']) === 0) {
        $saleId = $installment['sale_id'];
        $stmt = $pdo->prepare("SELECT lot_id FROM sales WHERE id = ?");
        $stmt->execute([$saleId]);
        $sale = $stmt->fetch();
        if ($sale) {
            $pdo->prepare("UPDATE lots SET status = 'sold' WHERE id = ? AND status = 'pending_initial'")->execute([$sale['lot_id']]);
        }
    }

    $stmt = $pdo->prepare("SELECT * FROM installments WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(['data' => $stmt->fetch()]);
}

function markAsPartial() {
    if (getMethod() !== 'POST' && getMethod() !== 'PATCH') jsonError('Método no permitido', 405);

    $body = getJsonBody();
    $id = $body['id'] ?? getParam('id');
    $paidAmount = floatval($body['paidAmount'] ?? $body['paid_amount'] ?? 0);

    if (!$id) jsonError('ID requerido');

    $pdo = getConnection();
    $stmt = $pdo->prepare(
        "UPDATE installments SET status = 'partial', paid_amount = ?, paid_date = CURDATE() WHERE id = ?"
    );
    $stmt->execute([$paidAmount, $id]);

    $stmt = $pdo->prepare("SELECT * FROM installments WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(['data' => $stmt->fetch()]);
}

function recalculateInstallments() {
    if (getMethod() !== 'POST') jsonError('Método no permitido', 405);

    $body = getJsonBody();
    $saleId = $body['saleId'] ?? $body['sale_id'];
    if (!$saleId) jsonError('saleId requerido');

    $pdo = getConnection();

    // Get total paid
    $stmt = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE sale_id = ?");
    $stmt->execute([$saleId]);
    $totalPaid = floatval($stmt->fetch()['total']);

    // Get sale total
    $stmt = $pdo->prepare("SELECT sale_price, down_payment FROM sales WHERE id = ?");
    $stmt->execute([$saleId]);
    $sale = $stmt->fetch();
    if (!$sale) jsonError('Venta no encontrada', 404);

    $remaining = floatval($sale['sale_price']) - $totalPaid;

    // Get pending installments
    $stmt = $pdo->prepare("SELECT * FROM installments WHERE sale_id = ? AND status IN ('pending', 'partial') ORDER BY installment_number ASC");
    $stmt->execute([$saleId]);
    $pendingInstallments = $stmt->fetchAll();

    if (empty($pendingInstallments) || $remaining <= 0) {
        jsonResponse(['data' => []]);
        return;
    }

    $newAmount = round($remaining / count($pendingInstallments), 2);
    $updated = [];

    $pdo->beginTransaction();
    try {
        $stmtUpdate = $pdo->prepare("UPDATE installments SET amount = ?, paid_amount = 0, status = 'pending' WHERE id = ?");

        foreach ($pendingInstallments as $i => $inst) {
            $amount = ($i === count($pendingInstallments) - 1)
                ? round($remaining - ($newAmount * (count($pendingInstallments) - 1)), 2)
                : $newAmount;

            $stmtUpdate->execute([$amount, $inst['id']]);
            $inst['amount'] = $amount;
            $inst['status'] = 'pending';
            $inst['paid_amount'] = 0;
            $updated[] = $inst;
        }

        $pdo->commit();
        jsonResponse(['data' => $updated]);
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonError('Error al recalcular cuotas: ' . $e->getMessage(), 500);
    }
}

function restructureInstallments() {
    if (getMethod() !== 'POST') jsonError('Método no permitido', 405);

    $body = getJsonBody();
    $saleId = $body['saleId'] ?? $body['sale_id'];
    $newNumInstallments = intval($body['newNumInstallments'] ?? 0);
    $startDate = $body['startDate'] ?? date('Y-m-d');

    if (!$saleId || $newNumInstallments <= 0) {
        jsonError('saleId y newNumInstallments son requeridos');
    }

    $pdo = getConnection();

    // Get remaining balance
    $stmt = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE sale_id = ?");
    $stmt->execute([$saleId]);
    $totalPaid = floatval($stmt->fetch()['total']);

    $stmt = $pdo->prepare("SELECT sale_price FROM sales WHERE id = ?");
    $stmt->execute([$saleId]);
    $sale = $stmt->fetch();
    if (!$sale) jsonError('Venta no encontrada', 404);

    $remaining = floatval($sale['sale_price']) - $totalPaid;

    // Delete all pending installments
    $pdo->prepare("DELETE FROM installments WHERE sale_id = ? AND status IN ('pending', 'partial', 'overdue')")->execute([$saleId]);

    // Get max installment number
    $stmt = $pdo->prepare("SELECT COALESCE(MAX(installment_number), 0) as maxNum FROM installments WHERE sale_id = ?");
    $stmt->execute([$saleId]);
    $startNum = intval($stmt->fetch()['maxNum']) + 1;

    $installmentAmount = round($remaining / $newNumInstallments, 2);
    $installments = [];

    $pdo->beginTransaction();
    try {
        $stmtInsert = $pdo->prepare(
            "INSERT INTO installments (id, sale_id, installment_number, amount, due_date, status, paid_amount) 
             VALUES (?, ?, ?, ?, ?, 'pending', 0)"
        );

        for ($i = 0; $i < $newNumInstallments; $i++) {
            $num = $startNum + $i;
            $dueDate = date('Y-m-d', strtotime("$startDate +" . ($i + 1) . " months"));
            $amount = ($i === $newNumInstallments - 1)
                ? round($remaining - ($installmentAmount * ($newNumInstallments - 1)), 2)
                : $installmentAmount;

            $instId = generateUUID();
            $stmtInsert->execute([$instId, $saleId, $num, $amount, $dueDate]);

            $installments[] = [
                'id' => $instId,
                'sale_id' => $saleId,
                'installment_number' => $num,
                'amount' => $amount,
                'due_date' => $dueDate,
                'status' => 'pending',
                'paid_amount' => 0
            ];
        }

        $pdo->commit();
        jsonResponse(['data' => $installments], 201);
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonError('Error al reestructurar cuotas: ' . $e->getMessage(), 500);
    }
}

function updateInstallment($id) {
    $pdo = getConnection();
    $body = getJsonBody();

    $fields = [];
    $params = [];

    if (isset($body['amount'])) { $fields[] = 'amount = ?'; $params[] = floatval($body['amount']); }
    if (isset($body['due_date'])) { $fields[] = 'due_date = ?'; $params[] = $body['due_date']; }
    if (isset($body['dueDate'])) { $fields[] = 'due_date = ?'; $params[] = $body['dueDate']; }
    if (isset($body['status'])) { $fields[] = 'status = ?'; $params[] = $body['status']; }
    if (isset($body['paid_amount'])) { $fields[] = 'paid_amount = ?'; $params[] = floatval($body['paid_amount']); }
    if (isset($body['paidAmount'])) { $fields[] = 'paid_amount = ?'; $params[] = floatval($body['paidAmount']); }
    if (isset($body['paid_date'])) { $fields[] = 'paid_date = ?'; $params[] = $body['paid_date']; }
    if (isset($body['payment_id'])) { $fields[] = 'payment_id = ?'; $params[] = $body['payment_id']; }

    if (empty($fields)) jsonError('No hay campos para actualizar');

    $params[] = $id;
    $pdo->prepare("UPDATE installments SET " . implode(', ', $fields) . " WHERE id = ?")->execute($params);

    $stmt = $pdo->prepare("SELECT * FROM installments WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(['data' => $stmt->fetch()]);
}

function deleteInstallment($id) {
    $pdo = getConnection();
    $pdo->prepare("DELETE FROM installments WHERE id = ?")->execute([$id]);
    jsonResponse(['data' => ['id' => $id, 'deleted' => true]]);
}

function deleteBySale() {
    if (getMethod() !== 'DELETE' && getMethod() !== 'POST') jsonError('Método no permitido', 405);

    $saleId = getParam('saleId') ?? (getJsonBody()['saleId'] ?? null);
    if (!$saleId) jsonError('saleId requerido');

    $pdo = getConnection();
    $pdo->prepare("DELETE FROM installments WHERE sale_id = ?")->execute([$saleId]);
    jsonResponse(['data' => ['sale_id' => $saleId, 'deleted' => true]]);
}

function calculateRestructure() {
    if (getMethod() !== 'POST') jsonError('Método no permitido', 405);

    $body = getJsonBody();
    $saleId = $body['saleId'] ?? $body['sale_id'];
    $paymentAmount = floatval($body['paymentAmount'] ?? 0);

    if (!$saleId || $paymentAmount <= 0) {
        jsonError('saleId y paymentAmount son requeridos');
    }

    $pdo = getConnection();

    // Get sale info
    $stmt = $pdo->prepare("SELECT * FROM sales WHERE id = ?");
    $stmt->execute([$saleId]);
    $sale = $stmt->fetch();
    if (!$sale) jsonError('Venta no encontrada', 404);

    // Get pending installments
    $stmt = $pdo->prepare(
        "SELECT * FROM installments WHERE sale_id = ? AND status IN ('pending', 'partial') ORDER BY installment_number ASC"
    );
    $stmt->execute([$saleId]);
    $pendingInstallments = $stmt->fetchAll();

    if (empty($pendingInstallments)) {
        jsonResponse(['data' => ['needsRestructure' => false, 'reason' => 'No pending installments']]);
        return;
    }

    $firstInstAmount = floatval($pendingInstallments[0]['amount']);
    
    // Check if payment exactly matches an installment
    if (abs($paymentAmount - $firstInstAmount) < 0.01) {
        jsonResponse(['data' => ['needsRestructure' => false, 'reason' => 'Payment matches installment amount']]);
        return;
    }

    // Payment doesn't match — needs restructure
    $totalPending = array_sum(array_map(function($i) { return floatval($i['amount']); }, $pendingInstallments));
    $remainingAfterPayment = $totalPending - $paymentAmount;
    $numPending = count($pendingInstallments);
    $isOverpayment = $paymentAmount > $firstInstAmount;

    if ($isOverpayment) {
        // OVERPAYMENT: paid more than expected
        $fullInstallmentsCovered = floor($paymentAmount / $firstInstAmount);
        
        // Option 1: Reduce number of installments (keep same amount per installment)
        $reduceTimeNewCount = ($firstInstAmount > 0) ? max(1, ceil($remainingAfterPayment / $firstInstAmount)) : 0;
        $reduceTimeSaved = max(0, $numPending - $reduceTimeNewCount - 1);
        
        // Option 2: Reduce installment amount (keep same number of remaining installments)
        $reducePaymentNewCount = max(1, $numPending - 1);
        $reducePaymentNewAmount = ($reducePaymentNewCount > 0) ? round($remainingAfterPayment / $reducePaymentNewCount, 2) : 0;
        $reducePaymentSaved = $firstInstAmount - $reducePaymentNewAmount;

        jsonResponse(['data' => [
            'needsRestructure' => true,
            'paymentAmount' => $paymentAmount,
            'type' => 'overpayment',
            'remainingAfterPayment' => round($remainingAfterPayment, 2),
            'reduceTime' => [
                'label' => 'Reducir Tiempo',
                'description' => "Mantener cuota de " . number_format($firstInstAmount, 0, ',', '.') . " y reducir a $reduceTimeNewCount cuotas (ahorras $reduceTimeSaved meses)",
                'savedTime' => intval($reduceTimeSaved),
                'newNumInstallments' => intval($reduceTimeNewCount),
                'installmentAmount' => $firstInstAmount
            ],
            'reducePayment' => [
                'label' => 'Reducir Cuota',
                'description' => "Mantener $reducePaymentNewCount cuotas y pagar " . number_format($reducePaymentNewAmount, 0, ',', '.') . " por cuota",
                'savedAmount' => round(max(0, $reducePaymentSaved), 2),
                'newNumInstallments' => intval($reducePaymentNewCount),
                'installmentAmount' => $reducePaymentNewAmount
            ]
        ]]);
    } else {
        // UNDERPAYMENT: paid less than expected
        $deficit = $firstInstAmount - $paymentAmount;
        
        // Option 1: Add more time (keep same installment amount, add installments)
        $addTimeNewCount = ($firstInstAmount > 0) ? max(1, ceil($remainingAfterPayment / $firstInstAmount)) : $numPending;
        $addTimeExtra = max(0, $addTimeNewCount - ($numPending - 1));
        
        // Option 2: Increase installment amount (keep same number of remaining installments)  
        $keepCountNewCount = max(1, $numPending - 1);
        $keepCountNewAmount = ($keepCountNewCount > 0) ? round($remainingAfterPayment / $keepCountNewCount, 2) : 0;
        $keepCountIncrease = $keepCountNewAmount - $firstInstAmount;

        jsonResponse(['data' => [
            'needsRestructure' => true,
            'paymentAmount' => $paymentAmount,
            'type' => 'underpayment',
            'remainingAfterPayment' => round($remainingAfterPayment, 2),
            'reduceTime' => [
                'label' => 'Aumentar Tiempo',
                'description' => "Mantener cuota de " . number_format($firstInstAmount, 0, ',', '.') . " y extender a $addTimeNewCount cuotas (+$addTimeExtra meses)",
                'savedTime' => intval(-$addTimeExtra),
                'newNumInstallments' => intval($addTimeNewCount),
                'installmentAmount' => $firstInstAmount
            ],
            'reducePayment' => [
                'label' => 'Aumentar Cuota',
                'description' => "Mantener $keepCountNewCount cuotas y pagar " . number_format($keepCountNewAmount, 0, ',', '.') . " por cuota (+" . number_format(max(0, $keepCountIncrease), 0, ',', '.') . " más)",
                'savedAmount' => round(-max(0, $keepCountIncrease), 2),
                'newNumInstallments' => intval($keepCountNewCount),
                'installmentAmount' => $keepCountNewAmount
            ]
        ]]);
    }
}

function getOverdueInstallments() {
    $pdo = getConnection();

    $stmt = $pdo->query(
        "SELECT i.*, s.sale_price, s.project_id, s.lot_id, s.client_id,
                c.name as client_name, c.document as client_document, c.phone as client_phone,
                p.name as project_name,
                l.number as lot_number,
                DATEDIFF(CURDATE(), i.due_date) as days_overdue
         FROM installments i
         JOIN sales s ON i.sale_id = s.id
         JOIN clients c ON s.client_id = c.id
         JOIN projects p ON s.project_id = p.id
         JOIN lots l ON s.lot_id = l.id
         WHERE i.status IN ('pending', 'partial') AND i.due_date < CURDATE()
         ORDER BY i.due_date ASC"
    );

    jsonResponse(['data' => $stmt->fetchAll()]);
}

function autoRedistributeInstallments() {
    if (getMethod() !== 'POST') jsonError('Método no permitido', 405);

    $body = getJsonBody();
    $saleId = $body['saleId'] ?? $body['sale_id'];
    $paymentAmount = floatval($body['paymentAmount'] ?? 0);
    $paymentId = $body['paymentId'] ?? $body['payment_id'] ?? null;

    if (!$saleId || $paymentAmount <= 0) {
        jsonError('saleId y paymentAmount son requeridos');
    }

    $pdo = getConnection();

    // Get pending installments ordered by number
    $stmt = $pdo->prepare(
        "SELECT * FROM installments WHERE sale_id = ? AND status IN ('pending', 'partial') ORDER BY installment_number ASC"
    );
    $stmt->execute([$saleId]);
    $pendingInstallments = $stmt->fetchAll();

    if (empty($pendingInstallments)) {
        jsonResponse(['data' => ['message' => 'No pending installments to redistribute']]);
        return;
    }

    $pdo->beginTransaction();
    try {
        // 1. Mark the first pending installment as paid
        $firstInstallment = $pendingInstallments[0];
        $expectedAmount = floatval($firstInstallment['amount']);

        $pdo->prepare(
            "UPDATE installments SET status = 'paid', paid_amount = ?, paid_date = CURDATE(), payment_id = ? WHERE id = ?"
        )->execute([$paymentAmount, $paymentId, $firstInstallment['id']]);

        // If installment #0 (down payment) was paid, transition lot status to 'sold'
        if (intval($firstInstallment['installment_number']) === 0) {
            $stmt = $pdo->prepare("SELECT lot_id FROM sales WHERE id = ?");
            $stmt->execute([$saleId]);
            $sale = $stmt->fetch();
            if ($sale) {
                $pdo->prepare("UPDATE lots SET status = 'sold' WHERE id = ? AND status = 'pending_initial'")->execute([$sale['lot_id']]);
            }
        }

        // 2. Calculate the difference
        $difference = $expectedAmount - $paymentAmount; // positive = underpaid, negative = overpaid
        $remainingInstallments = array_slice($pendingInstallments, 1);
        $numRemaining = count($remainingInstallments);

        if ($numRemaining > 0 && abs($difference) > 0.01) {
            if ($difference > 0) {
                // =============================================
                // UNDERPAYMENT: add difference to NEXT installment only
                // =============================================
                $nextInst = $remainingInstallments[0];
                $newAmount = round(floatval($nextInst['amount']) + $difference, 2);
                $pdo->prepare(
                    "UPDATE installments SET amount = ? WHERE id = ?"
                )->execute([$newAmount, $nextInst['id']]);

            } else {
                // =============================================
                // OVERPAYMENT: subtract excess from LAST installment toward first
                // =============================================
                $excess = abs($difference); // positive amount to subtract

                // Process from last to first
                for ($i = $numRemaining - 1; $i >= 0 && $excess > 0.01; $i--) {
                    $inst = $remainingInstallments[$i];
                    $instAmount = floatval($inst['amount']);

                    if ($excess >= $instAmount) {
                        // Excess covers entire installment — delete it
                        $pdo->prepare("DELETE FROM installments WHERE id = ?")->execute([$inst['id']]);
                        $excess -= $instAmount;
                    } else {
                        // Partial reduction — reduce the installment amount
                        $newAmount = round($instAmount - $excess, 2);
                        $pdo->prepare(
                            "UPDATE installments SET amount = ? WHERE id = ?"
                        )->execute([$newAmount, $inst['id']]);
                        $excess = 0;
                    }
                }
            }
        }

        $pdo->commit();

        // Return updated installments
        $stmt = $pdo->prepare(
            "SELECT * FROM installments WHERE sale_id = ? ORDER BY installment_number ASC"
        );
        $stmt->execute([$saleId]);

        jsonResponse(['data' => [
            'message' => 'Cuotas redistribuidas automáticamente',
            'paidInstallment' => $firstInstallment['id'],
            'type' => $difference > 0 ? 'underpayment' : 'overpayment',
            'difference' => round(abs($difference), 2),
            'remainingInstallments' => $numRemaining,
            'installments' => $stmt->fetchAll()
        ]]);
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonError('Error al redistribuir cuotas: ' . $e->getMessage(), 500);
    }
}
