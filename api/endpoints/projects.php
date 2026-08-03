<?php
/**
 * LoteClick API - Projects Endpoints (includes partners and lots)
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../jwt.php';

try {
    $auth = requireAuth();
    $action = getParam('action', '');
    $method = getMethod();

    // Ensure columns exist for robust project creation and updates
    try {
        $pdo = getConnection();
        $pdo->exec("ALTER TABLE projects ADD COLUMN block_type VARCHAR(50) DEFAULT 'block'");
    } catch(Exception $e) {}
    try {
        $pdo = getConnection();
        $pdo->exec("ALTER TABLE projects ADD COLUMN logo_url TEXT DEFAULT NULL");
    } catch(Exception $e) {}
    
    // Ensure lots has etapa_id column
    try { $pdo->exec("ALTER TABLE lots ADD COLUMN etapa_id VARCHAR(100) DEFAULT NULL"); } catch(Exception $e) {}
    // Ensure lots number is VARCHAR and fix unique index
    try {
        $pdo = getConnection();
        $pdo->exec("ALTER TABLE lots MODIFY COLUMN number VARCHAR(50) NOT NULL");
    } catch(Exception $e) {}
    try {
        $pdo = getConnection();
        // Ignore error if index doesn't exist
        $pdo->exec("ALTER TABLE lots DROP INDEX uk_lot_project");
    } catch(Exception $e) {}
    try {
        $pdo = getConnection();
        $pdo->exec("ALTER TABLE lots ADD UNIQUE KEY uk_lot_project_manzana (project_id, number, manzana)");
    } catch(Exception $e) {}
    // #3 - Agregar columna user_id a partners si no existe (vincula socio con usuario del sistema)
    try {
        $pdo = getConnection();
        $pdo->exec("ALTER TABLE partners ADD COLUMN user_id VARCHAR(36) DEFAULT NULL");
    } catch(Exception $e) {}

switch ($method) {
    case 'GET':
        $id = getParam('id');
        if ($id) {
            getProject($id);
        } else {
            getAllProjects();
        }
        break;
    case 'POST':
        createProject();
        break;
    case 'PUT':
    case 'PATCH':
        $id = getParam('id');
        if (!$id) jsonError('ID requerido');
        updateProject($id);
        break;
    case 'DELETE':
        $id = getParam('id');
        if (!$id) jsonError('ID requerido');
        deleteProject($id);
        break;
    default:
        jsonError('Método no permitido', 405);
}
} catch (Exception $e) {
    jsonError('Server error: ' . $e->getMessage(), 500);
} catch (Error $e) {
    jsonError('Fatal error: ' . $e->getMessage(), 500);
}

function getProjectWithRelations($pdo, $id) {
    $stmt = $pdo->prepare("SELECT * FROM projects WHERE id = ?");
    $stmt->execute([$id]);
    $project = $stmt->fetch();
    if (!$project) return null;

    $stmt = $pdo->prepare("SELECT * FROM partners WHERE project_id = ?");
    $stmt->execute([$id]);
    $project['partners'] = $stmt->fetchAll();

    $stmt = $pdo->prepare("SELECT * FROM stages WHERE project_id = ? ORDER BY created_at ASC");
    $stmt->execute([$id]);
    $project['stages'] = $stmt->fetchAll();

    $stmt = $pdo->prepare("SELECT b.* FROM blocks b JOIN stages s ON b.stage_id = s.id WHERE s.project_id = ? ORDER BY b.created_at ASC");
    $stmt->execute([$id]);
    $project['blocks'] = $stmt->fetchAll();

    $stmt = $pdo->prepare("SELECT * FROM lots WHERE project_id = ? ORDER BY manzana ASC, LENGTH(number) ASC, number ASC");
    $stmt->execute([$id]);
    $project['lots'] = $stmt->fetchAll();

    return $project;
}

function getAllProjects() {
    $pdo = getConnection();

    // ✅ AUTO-SYNC 1: Fix primary lots (sales.lot_id) with NULL/empty/available status
    try {
        $pdo->prepare("
            UPDATE lots
            JOIN sales ON sales.lot_id = lots.id
            SET lots.status = IF(sales.payment_type = 'credit', 'pending_initial', 'sold')
            WHERE (lots.status IS NULL OR lots.status = '' OR lots.status = 'available')
            AND (sales.status IS NULL OR sales.status != 'desistida')
        ")->execute();
    } catch (Exception $e) { /* Non-critical */ }

    // ✅ AUTO-SYNC 2: Fix lots from sale_lots (grouped 'Venta Única' multi-lot sales)
    try {
        $pdo->prepare("
            UPDATE lots
            JOIN sale_lots ON sale_lots.lot_id = lots.id
            JOIN sales ON sales.id = sale_lots.sale_id
            SET lots.status = IF(sales.payment_type = 'credit', 'pending_initial', 'sold')
            WHERE (lots.status IS NULL OR lots.status = '' OR lots.status = 'available')
            AND (sales.status IS NULL OR sales.status != 'desistida')
        ")->execute();
    } catch (Exception $e) { /* Non-critical: sale_lots may not exist in all deployments */ }

    // ✅ AUTO-SYNC 3: Normalize remaining NULL/empty lots (no sale) to 'available'
    try {
        $pdo->prepare("
            UPDATE lots
            LEFT JOIN sales ON sales.lot_id = lots.id
            LEFT JOIN sale_lots ON sale_lots.lot_id = lots.id
            SET lots.status = 'available'
            WHERE (lots.status IS NULL OR lots.status = '')
            AND sales.id IS NULL
            AND sale_lots.id IS NULL
        ")->execute();
    } catch (Exception $e) { /* Non-critical */ }



    $stmt = $pdo->query("SELECT * FROM projects ORDER BY created_at DESC");
    $projects = $stmt->fetchAll();

    foreach ($projects as &$p) {
        $stmt2 = $pdo->prepare("SELECT * FROM partners WHERE project_id = ?");
        $stmt2->execute([$p['id']]);
        $p['partners'] = $stmt2->fetchAll();

        $stmtStage = $pdo->prepare("SELECT * FROM stages WHERE project_id = ? ORDER BY created_at ASC");
        $stmtStage->execute([$p['id']]);
        $p['stages'] = $stmtStage->fetchAll();

        $stmtBlock = $pdo->prepare("SELECT b.* FROM blocks b JOIN stages s ON b.stage_id = s.id WHERE s.project_id = ? ORDER BY b.created_at ASC");
        $stmtBlock->execute([$p['id']]);
        $p['blocks'] = $stmtBlock->fetchAll();

        $stmt3 = $pdo->prepare("SELECT * FROM lots WHERE project_id = ? ORDER BY manzana ASC, LENGTH(number) ASC, number ASC");
        $stmt3->execute([$p['id']]);
        $p['lots'] = $stmt3->fetchAll();
    }

    jsonResponse(['data' => $projects]);
}


function getProject($id) {
    $pdo = getConnection();
    $project = getProjectWithRelations($pdo, $id);
    if (!$project) jsonError('Proyecto no encontrado', 404);
    jsonResponse(['data' => $project]);
}

function createProject() {
    $pdo = getConnection();
    $body = getJsonBody();
    $id = generateUUID();

    forceUppercase($body, ['name', 'location', 'description']);

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            "INSERT INTO projects (id, name, location, description, block_type, logo_url) VALUES (?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            $id,
            $body['name'],
            $body['location'],
            $body['description'] ?? null,
            $body['block_type'] ?? null,
            $body['logo_url'] ?? null
        ]);

        // Insert partners
        if (!empty($body['partners'])) {
            $stmt = $pdo->prepare(
                "INSERT INTO partners (id, project_id, name, percentage, document, phone, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
            );
            foreach ($body['partners'] as $p) {
                $stmt->execute([
                    generateUUID(),
                    $id,
                    $p['name'],
                    floatval($p['percentage'] ?? 0),
                    $p['document'] ?? null,
                    $p['phone'] ?? null,
                    $p['userId'] ?? $p['user_id'] ?? null
                ]);
            }
        }

        // Insert stages
        if (!empty($body['stages'])) {
            $stmt = $pdo->prepare("INSERT INTO stages (id, project_id, name) VALUES (?, ?, ?)");
            foreach ($body['stages'] as $s) {
                $stmt->execute([
                    $s['id'],
                    $id,
                    mb_strtoupper($s['name'], 'UTF-8')
                ]);
            }
        }

        // Insert blocks
        if (!empty($body['blocks'])) {
            $stmt = $pdo->prepare("INSERT INTO blocks (id, stage_id, name) VALUES (?, ?, ?)");
            foreach ($body['blocks'] as $b) {
                $stmt->execute([
                    $b['id'],
                    $b['stage_id'],
                    mb_strtoupper($b['name'], 'UTF-8')
                ]);
            }
        }

        // Insert lots
        if (!empty($body['lots'])) {
            $stmt = $pdo->prepare(
                "INSERT INTO lots (id, project_id, block_id, etapa_id, number, manzana, area, price, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
            );
            foreach ($body['lots'] as $l) {
                $stmt->execute([
                    generateUUID(),
                    $id,
                    $l['block_id'] ?? null,
                    $l['stage_id'] ?? $l['etapa_id'] ?? null,
                    trim($l['number'] ?? ''),
                    !empty($l['manzana']) ? trim($l['manzana']) : null,
                    !empty($l['area']) ? floatval($l['area']) : null,
                    !empty($l['price']) ? floatval($l['price']) : null,
                    $l['status'] ?? 'available'
                ]);
            }
        }

        $pdo->commit();
        $project = getProjectWithRelations($pdo, $id);
        jsonResponse(['data' => $project], 201);

    } catch (Exception $e) {
        $pdo->rollBack();
        jsonError('Error al crear proyecto: ' . $e->getMessage(), 500);
    }
}

function updateProject($id) {
    $pdo = getConnection();
    $body = getJsonBody();

    forceUppercase($body, ['name', 'location', 'description']);

    $pdo->beginTransaction();
    try {
        // Prepare dynamic update query to include logo_url if present
        $fields = "name = ?, location = ?, description = ?, block_type = ?";
        $params = [
            $body['name'],
            $body['location'],
            $body['description'] ?? null,
            $body['block_type'] ?? null
        ];
        
        if (array_key_exists('logo_url', $body)) {
            $fields .= ", logo_url = ?";
            $params[] = $body['logo_url'];
        }
        $params[] = $id;

        $stmt = $pdo->prepare("UPDATE projects SET $fields WHERE id = ?");
        $stmt->execute($params);

        // Update partners (delete and re-insert)
        if (isset($body['partners'])) {
            $pdo->prepare("DELETE FROM partners WHERE project_id = ?")->execute([$id]);
            if (!empty($body['partners'])) {
                $stmt = $pdo->prepare(
                    "INSERT INTO partners (id, project_id, name, percentage, document, phone, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
                );
                foreach ($body['partners'] as $p) {
                    $stmt->execute([
                        generateUUID(),
                        $id,
                        $p['name'],
                        floatval($p['percentage'] ?? 0),
                        $p['document'] ?? null,
                        $p['phone'] ?? null,
                        $p['userId'] ?? $p['user_id'] ?? null
                    ]);
                }
            }
        }

        // Update stages
        if (isset($body['stages'])) {
            $pdo->prepare("DELETE FROM stages WHERE project_id = ?")->execute([$id]);
            if (!empty($body['stages'])) {
                $stmt = $pdo->prepare("INSERT INTO stages (id, project_id, name) VALUES (?, ?, ?)");
                foreach ($body['stages'] as $s) {
                    $stmt->execute([$s['id'], $id, mb_strtoupper($s['name'], 'UTF-8')]);
                }
            }
        }

        // Update blocks
        if (isset($body['blocks'])) {
            // Blocks cascade from stages, but just in case
            $pdo->prepare("DELETE b FROM blocks b JOIN stages s ON b.stage_id = s.id WHERE s.project_id = ?")->execute([$id]);
            if (!empty($body['blocks'])) {
                $stmt = $pdo->prepare("INSERT INTO blocks (id, stage_id, name) VALUES (?, ?, ?)");
                foreach ($body['blocks'] as $b) {
                    $stmt->execute([$b['id'], $b['stage_id'], mb_strtoupper($b['name'], 'UTF-8')]);
                }
            }
        }

        // Update lots — preserve status of sold/pending_initial lots
        if (isset($body['lots'])) {
            if (!empty($body['lots'])) {
                // Collect incoming lot IDs
                $incomingLotIds = array_map(fn($l) => $l['id'] ?? null, $body['lots']);
                $incomingLotIds = array_filter($incomingLotIds);

                // Get current lot statuses so we never reset sold/pending_initial
                $statusStmt = $pdo->prepare("SELECT id, status FROM lots WHERE project_id = ?");
                $statusStmt->execute([$id]);
                $currentStatuses = [];
                foreach ($statusStmt->fetchAll() as $row) {
                    $currentStatuses[$row['id']] = $row['status'];
                }

                // Delete lots that are no longer in the incoming list and are not sold
                if (!empty($incomingLotIds)) {
                    $placeholders = implode(',', array_fill(0, count($incomingLotIds), '?'));
                    $delStmt = $pdo->prepare(
                        "DELETE FROM lots WHERE project_id = ? AND id NOT IN ($placeholders) AND status NOT IN ('sold','pending_initial')"
                    );
                    $delStmt->execute(array_merge([$id], array_values($incomingLotIds)));
                } else {
                    // If no incoming lots, only delete available ones
                    $pdo->prepare("DELETE FROM lots WHERE project_id = ? AND status NOT IN ('sold','pending_initial')")->execute([$id]);
                }

                // Upsert each lot — preserve status for sold/pending_initial
                $stmt = $pdo->prepare(
                    "INSERT INTO lots (id, project_id, block_id, etapa_id, number, manzana, area, price, status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE
                        block_id = VALUES(block_id),
                        etapa_id = VALUES(etapa_id),
                        number = VALUES(number),
                        manzana = VALUES(manzana),
                        area = VALUES(area),
                        price = VALUES(price),
                        status = IF(status IN ('sold','pending_initial'), status, VALUES(status))"
                );
                foreach ($body['lots'] as $l) {
                    $lotId = $l['id'] ?? generateUUID();
                    // Preserve existing sold/pending_initial status
                    $existingStatus = $currentStatuses[$lotId] ?? null;
                    $finalStatus = ($existingStatus && in_array($existingStatus, ['sold','pending_initial']))
                        ? $existingStatus
                        : ($l['status'] ?? 'available');
                    $stmt->execute([
                        $lotId,
                        $id,
                        $l['block_id'] ?? null,
                        $l['stage_id'] ?? $l['etapa_id'] ?? null,
                        trim($l['number'] ?? ''),
                        !empty($l['manzana']) ? trim($l['manzana']) : null,
                        !empty($l['area']) ? floatval($l['area']) : null,
                        !empty($l['price']) ? floatval($l['price']) : null,
                        $finalStatus
                    ]);
                }
            }
        }

        $pdo->commit();
        $project = getProjectWithRelations($pdo, $id);
        jsonResponse(['data' => $project]);

    } catch (Exception $e) {
        $pdo->rollBack();
        jsonError('Error al actualizar proyecto: ' . $e->getMessage(), 500);
    }
}

function deleteProject($id) {
    $pdo = getConnection();
    $stmt = $pdo->prepare("DELETE FROM projects WHERE id = ?");
    $stmt->execute([$id]);
    jsonResponse(['data' => ['id' => $id, 'deleted' => true]]);
}
