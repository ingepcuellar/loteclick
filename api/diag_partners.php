<?php
/**
 * Diagnóstico v2: socios vs proyectos (sin columna 'partners')
 * URL: https://loteclick.com/api/diag_partners.php
 * ELIMINAR después de usar.
 */
require_once __DIR__ . '/config.php';
header('Content-Type: text/html; charset=utf-8');
$pdo = getConnection();

echo "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Diag v2</title>
<style>
  body{font-family:monospace;background:#0f172a;color:#e2e8f0;padding:20px}
  h2{color:#6366f1;border-bottom:1px solid #334155;padding-bottom:8px}
  h3{color:#94a3b8}
  table{border-collapse:collapse;width:100%;margin-bottom:24px;font-size:12px}
  th{background:#1e293b;color:#6366f1;padding:6px 10px;text-align:left}
  td{padding:6px 10px;border-bottom:1px solid #1e293b;word-break:break-all}
  .ok{color:#22c55e;font-weight:bold} .err{color:#ef4444} .warn{color:#f59e0b}
  pre{background:#1e293b;padding:12px;border-radius:6px;overflow-x:auto;font-size:11px}
  .box{background:#1e293b;border-radius:8px;padding:16px;margin-bottom:16px}
</style></head><body>";

// ── 1. Columnas reales de la tabla projects ───────────────────────────────────
echo "<h2>1. Columnas de la tabla <code>projects</code></h2><div class='box'>";
try {
    $cols = $pdo->query("SHOW COLUMNS FROM projects")->fetchAll();
    $colNames = array_column($cols, 'Field');
    echo "<p><strong>Columnas:</strong> " . implode(' | ', $colNames) . "</p>";
    $partnersCols = array_filter($colNames, fn($c) => str_contains(strtolower($c), 'partner') || str_contains(strtolower($c), 'socio'));
    if ($partnersCols) {
        echo "<p class='ok'>Columnas relacionadas con socios: " . implode(', ', $partnersCols) . "</p>";
    } else {
        echo "<p class='warn'>No hay columna 'partners' en projects. Los socios deben estar en otra tabla.</p>";
    }
} catch(Exception $e) { echo "<p class='err'>".$e->getMessage()."</p>"; }
echo "</div>";

// ── 2. Tablas con "partner" en el nombre ──────────────────────────────────────
echo "<h2>2. Tablas con 'partner' o 'socio' en el nombre</h2><div class='box'>";
try {
    $tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
    $partnerTables = array_filter($tables, fn($t) =>
        str_contains(strtolower($t), 'partner') || str_contains(strtolower($t), 'socio') || str_contains(strtolower($t), 'project')
    );
    if ($partnerTables) {
        foreach ($partnerTables as $t) {
            echo "<p class='ok'>📋 <strong>$t</strong></p>";
            try {
                $tc = $pdo->query("SHOW COLUMNS FROM `$t`")->fetchAll();
                echo "<p style='margin-left:20px;color:#94a3b8;font-size:11px'>Columnas: " . implode(', ', array_column($tc, 'Field')) . "</p>";
                $count = $pdo->query("SELECT COUNT(*) FROM `$t`")->fetchColumn();
                echo "<p style='margin-left:20px;color:#94a3b8;font-size:11px'>Registros: $count</p>";
            } catch(Exception $e) {}
        }
    } else {
        echo "<p class='warn'>No hay tablas con esos nombres.</p>";
    }
} catch(Exception $e) { echo "<p class='err'>".$e->getMessage()."</p>"; }
echo "</div>";

// ── 3. Proyectos con sus IDs reales ──────────────────────────────────────────
echo "<h2>3. Proyectos en BD (IDs reales)</h2>";
$projects = [];
try {
    $projCols = array_column($pdo->query("SHOW COLUMNS FROM projects")->fetchAll(), 'Field');
    $selectCols = array_intersect(['id','name','status'], $projCols);
    // Add partner-related cols if they exist
    foreach ($projCols as $c) {
        if (str_contains(strtolower($c), 'partner') || str_contains(strtolower($c), 'socio')) {
            $selectCols[] = $c;
        }
    }
    $stmt = $pdo->query("SELECT " . implode(',', $selectCols) . " FROM projects ORDER BY name");
    $projects = $stmt->fetchAll();

    echo "<table><tr><th>ID</th><th>Nombre</th>" . (in_array('status',$projCols) ? "<th>Status</th>" : "") . "</tr>";
    foreach ($projects as $p) {
        echo "<tr><td style='color:#6366f1'>{$p['id']}</td><td><strong>{$p['name']}</strong></td>";
        if (in_array('status',$projCols)) echo "<td>{$p['status']}</td>";
        echo "</tr>";
    }
    echo "</table>";
} catch(Exception $e) { echo "<p class='err'>".$e->getMessage()."</p>"; }

// ── 4. ANDRÉS MARTINEZ: associated_projects vs project IDs ───────────────────
echo "<h2>4. ANDRÉS MARTINEZ — coincidencia associated_projects vs proyectos</h2><div class='box'>";
try {
    $stmt = $pdo->query("SELECT id, name, associated_projects FROM profiles WHERE name LIKE '%ANDR%' OR name LIKE '%andr%'");
    $andres = $stmt->fetchAll();
    foreach ($andres as $u) {
        echo "<h3>{$u['name']}</h3>";
        $ap = json_decode($u['associated_projects'] ?? '[]', true) ?: [];
        echo "<p>associated_projects en BD (" . count($ap) . " IDs):</p><pre>" . json_encode($ap, JSON_PRETTY_PRINT) . "</pre>";

        if ($ap && $projects) {
            echo "<table><tr><th>ID en associated_projects</th><th>¿Existe en projects?</th><th>Nombre proyecto</th></tr>";
            $projectIds = array_column($projects, 'id');
            foreach ($ap as $apId) {
                $found = array_search($apId, $projectIds);
                if ($found !== false) {
                    echo "<tr><td>{$apId}</td><td class='ok'>✅ SÍ</td><td>{$projects[$found]['name']}</td></tr>";
                } else {
                    echo "<tr><td>{$apId}</td><td class='err'>❌ NO existe en projects</td><td>—</td></tr>";
                }
            }
            echo "</table>";
        } elseif (empty($ap)) {
            echo "<p class='err'>associated_projects está vacío.</p>";
        }
    }
} catch(Exception $e) { echo "<p class='err'>".$e->getMessage()."</p>"; }
echo "</div>";

// ── 5. Todos los socios: associated_projects vacíos ──────────────────────────
echo "<h2>5. Todos los perfiles partner y estado de associated_projects</h2>";
try {
    $stmt = $pdo->query("SELECT id, name, role, associated_projects FROM profiles WHERE role LIKE '%partner%' ORDER BY name");
    $partners = $stmt->fetchAll();
    $projectIds = array_column($projects, 'id');
    echo "<table><tr><th>Nombre</th><th>Rol</th><th>IDs en associated_projects</th><th>Coinciden con proyectos?</th></tr>";
    foreach ($partners as $u) {
        $ap = json_decode($u['associated_projects'] ?? '[]', true) ?: [];
        $matches = array_filter($ap, fn($id) => in_array($id, $projectIds));
        $cls = empty($ap) ? 'err' : (count($matches) === count($ap) ? 'ok' : 'warn');
        $txt = empty($ap) ? '❌ Vacío' : (count($matches) . '/' . count($ap) . ' coinciden');
        echo "<tr><td><strong>{$u['name']}</strong></td><td>{$u['role']}</td>
              <td>" . count($ap) . " IDs</td>
              <td class='{$cls}'>{$txt}</td></tr>";
    }
    echo "</table>";
} catch(Exception $e) { echo "<p class='err'>".$e->getMessage()."</p>"; }

echo "<hr style='border-color:#334155;margin:32px 0'>
<p style='color:#64748b;font-size:11px'>⚠️ Eliminar: <code>api/diag_partners.php</code></p>
</body></html>";
