<?php
/**
 * PredioClick API - Projects Endpoints (includes partners and lots)
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../jwt.php';

try {
    $auth = requireAuth();
    $action = getParam('action', '');
    $method = getMethod();

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

    $stmt = $pdo->prepare("SELECT * FROM lots WHERE project_id = ? ORDER BY number ASC");
    $stmt->execute([$id]);
    $project['lots'] = $stmt->fetchAll();

    return $project;
}

function getAllProjects() {
    $pdo = getConnection();
    $stmt = $pdo->query("SELECT * FROM projects ORDER BY created_at DESC");
    $projects = $stmt->fetchAll();

    foreach ($projects as &$p) {
        $stmt2 = $pdo->prepare("SELECT * FROM partners WHERE project_id = ?");
        $stmt2->execute([$p['id']]);
        $p['partners'] = $stmt2->fetchAll();

        $stmt3 = $pdo->prepare("SELECT * FROM lots WHERE project_id = ? ORDER BY number ASC");
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

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            "INSERT INTO projects (id, name, location, description) VALUES (?, ?, ?, ?)"
        );
        $stmt->execute([
            $id,
            $body['name'],
            $body['location'],
            $body['description'] ?? null
        ]);

        // Insert partners
        if (!empty($body['partners'])) {
            $stmt = $pdo->prepare(
                "INSERT INTO partners (id, project_id, name, percentage, document, phone) VALUES (?, ?, ?, ?, ?, ?)"
            );
            foreach ($body['partners'] as $p) {
                $stmt->execute([
                    generateUUID(),
                    $id,
                    $p['name'],
                    floatval($p['percentage'] ?? 0),
                    $p['document'] ?? null,
                    $p['phone'] ?? null
                ]);
            }
        }

        // Insert lots
        if (!empty($body['lots'])) {
            $stmt = $pdo->prepare(
                "INSERT INTO lots (id, project_id, number, area, price, status) VALUES (?, ?, ?, ?, ?, ?)"
            );
            foreach ($body['lots'] as $l) {
                $stmt->execute([
                    generateUUID(),
                    $id,
                    intval($l['number'] ?? 0),
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

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            "UPDATE projects SET name = ?, location = ?, description = ? WHERE id = ?"
        );
        $stmt->execute([
            $body['name'],
            $body['location'],
            $body['description'] ?? null,
            $id
        ]);

        // Update partners (delete and re-insert)
        if (isset($body['partners'])) {
            $pdo->prepare("DELETE FROM partners WHERE project_id = ?")->execute([$id]);
            if (!empty($body['partners'])) {
                $stmt = $pdo->prepare(
                    "INSERT INTO partners (id, project_id, name, percentage, document, phone) VALUES (?, ?, ?, ?, ?, ?)"
                );
                foreach ($body['partners'] as $p) {
                    $stmt->execute([
                        generateUUID(),
                        $id,
                        $p['name'],
                        floatval($p['percentage'] ?? 0),
                        $p['document'] ?? null,
                        $p['phone'] ?? null
                    ]);
                }
            }
        }

        // Update lots (delete and re-insert)
        if (isset($body['lots'])) {
            $pdo->prepare("DELETE FROM lots WHERE project_id = ?")->execute([$id]);
            if (!empty($body['lots'])) {
                $stmt = $pdo->prepare(
                    "INSERT INTO lots (id, project_id, number, area, price, status) VALUES (?, ?, ?, ?, ?, ?)"
                );
                foreach ($body['lots'] as $l) {
                    $stmt->execute([
                        $l['id'] ?? generateUUID(),
                        $id,
                        intval($l['number'] ?? 0),
                        !empty($l['area']) ? floatval($l['area']) : null,
                        !empty($l['price']) ? floatval($l['price']) : null,
                        $l['status'] ?? 'available'
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
