<?php
/**
 * LoteClick API - Contract Parameters Endpoints
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../jwt.php';

$auth = requireAuth();
$action = getParam('action', '');
$method = getMethod();

switch ($action) {
    case 'nextPromesa':
        getNextPromesa();
        break;
    default:
        switch ($method) {
            case 'GET':
                getContractParams();
                break;
            case 'PUT':
            case 'PATCH':
            case 'POST':
                if ($action === '') {
                    upsertContractParams();
                } else {
                    jsonError('Acción no válida', 400);
                }
                break;
            default:
                jsonError('Método no permitido', 405);
        }
}

/**
 * Get the single contract params record (or empty defaults)
 */
function getContractParams() {
    $pdo = getConnection();
    $stmt = $pdo->query("SELECT * FROM contract_params LIMIT 1");
    $params = $stmt->fetch();

    if (!$params) {
        // Return empty defaults
        jsonResponse(['data' => [
            'id' => null,
            'vendor_name' => '',
            'vendor_document' => '',
            'vendor_phone' => '',
            'vendor_address' => '',
            'matricula_inmobiliaria' => '',
            'porcentaje_cuota' => '0.052%',
            'ciudad' => 'Villavicencio - Meta',
            'notaria_nombre' => '',
            'notaria_ciudad' => '',
            'escritura_fecha' => null,
            'escritura_hora' => '03:00 PM',
            'titulo_propiedad' => '',
            'ultimo_numero_promesa' => 0
        ]]);
        return;
    }

    jsonResponse(['data' => $params]);
}

/**
 * Create or update contract params (single record)
 */
function upsertContractParams() {
    $pdo = getConnection();
    $body = getJsonBody();

    // Check if record exists
    $stmt = $pdo->query("SELECT id FROM contract_params LIMIT 1");
    $existing = $stmt->fetch();

    if ($existing) {
        // UPDATE
        $fields = [];
        $values = [];

        $allowed = [
            'vendor_name', 'vendor_document', 'vendor_phone', 'vendor_address',
            'matricula_inmobiliaria', 'porcentaje_cuota', 'ciudad',
            'notaria_nombre', 'notaria_ciudad', 'escritura_fecha', 'escritura_hora',
            'titulo_propiedad', 'ultimo_numero_promesa'
        ];

        // Also accept camelCase keys
        $camelMap = [
            'vendorName' => 'vendor_name',
            'vendorDocument' => 'vendor_document',
            'vendorPhone' => 'vendor_phone',
            'vendorAddress' => 'vendor_address',
            'matriculaInmobiliaria' => 'matricula_inmobiliaria',
            'porcentajeCuota' => 'porcentaje_cuota',
            'notariaNombre' => 'notaria_nombre',
            'notariaCiudad' => 'notaria_ciudad',
            'escrituraFecha' => 'escritura_fecha',
            'escrituraHora' => 'escritura_hora',
            'tituloPropiedad' => 'titulo_propiedad',
            'ultimoNumeroPromesa' => 'ultimo_numero_promesa'
        ];

        // Normalize camelCase to snake_case
        foreach ($camelMap as $camel => $snake) {
            if (isset($body[$camel]) && !isset($body[$snake])) {
                $body[$snake] = $body[$camel];
            }
        }

        foreach ($allowed as $field) {
            if (array_key_exists($field, $body)) {
                $fields[] = "$field = ?";
                $val = $body[$field];
                // Handle empty date
                if ($field === 'escritura_fecha' && empty($val)) {
                    $val = null;
                }
                $values[] = $val;
            }
        }

        if (empty($fields)) {
            jsonError('No hay campos para actualizar');
        }

        $values[] = $existing['id'];
        $sql = "UPDATE contract_params SET " . implode(', ', $fields) . " WHERE id = ?";
        $pdo->prepare($sql)->execute($values);

        // Return updated record
        $stmt = $pdo->prepare("SELECT * FROM contract_params WHERE id = ?");
        $stmt->execute([$existing['id']]);
        jsonResponse(['data' => $stmt->fetch()]);
    } else {
        // INSERT
        $id = generateUUID();

        $pdo->prepare(
            "INSERT INTO contract_params (id, vendor_name, vendor_document, vendor_phone, vendor_address,
             matricula_inmobiliaria, porcentaje_cuota, ciudad,
             notaria_nombre, notaria_ciudad, escritura_fecha, escritura_hora,
             titulo_propiedad, ultimo_numero_promesa)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )->execute([
            $id,
            $body['vendor_name'] ?? $body['vendorName'] ?? '',
            $body['vendor_document'] ?? $body['vendorDocument'] ?? '',
            $body['vendor_phone'] ?? $body['vendorPhone'] ?? '',
            $body['vendor_address'] ?? $body['vendorAddress'] ?? '',
            $body['matricula_inmobiliaria'] ?? $body['matriculaInmobiliaria'] ?? '',
            $body['porcentaje_cuota'] ?? $body['porcentajeCuota'] ?? '0.052%',
            $body['ciudad'] ?? 'Villavicencio - Meta',
            $body['notaria_nombre'] ?? $body['notariaNombre'] ?? '',
            $body['notaria_ciudad'] ?? $body['notariaCiudad'] ?? '',
            !empty($body['escritura_fecha'] ?? $body['escrituraFecha'] ?? '') ? ($body['escritura_fecha'] ?? $body['escrituraFecha']) : null,
            $body['escritura_hora'] ?? $body['escrituraHora'] ?? '03:00 PM',
            $body['titulo_propiedad'] ?? $body['tituloPropiedad'] ?? '',
            intval($body['ultimo_numero_promesa'] ?? $body['ultimoNumeroPromesa'] ?? 0)
        ]);

        $stmt = $pdo->prepare("SELECT * FROM contract_params WHERE id = ?");
        $stmt->execute([$id]);
        jsonResponse(['data' => $stmt->fetch()], 201);
    }
}

/**
 * Get next promesa number (increment and return)
 */
function getNextPromesa() {
    if (getMethod() !== 'POST') jsonError('Método no permitido', 405);

    $pdo = getConnection();

    // Get current record
    $stmt = $pdo->query("SELECT * FROM contract_params LIMIT 1");
    $params = $stmt->fetch();

    if (!$params) {
        // Create initial record
        $id = generateUUID();
        $pdo->prepare(
            "INSERT INTO contract_params (id, ultimo_numero_promesa) VALUES (?, 1)"
        )->execute([$id]);
        jsonResponse(['data' => ['numero_promesa' => 1]]);
        return;
    }

    // Increment
    $nextNum = intval($params['ultimo_numero_promesa']) + 1;
    $pdo->prepare(
        "UPDATE contract_params SET ultimo_numero_promesa = ? WHERE id = ?"
    )->execute([$nextNum, $params['id']]);

    jsonResponse(['data' => ['numero_promesa' => $nextNum]]);
}
