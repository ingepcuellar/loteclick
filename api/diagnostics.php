<?php
/**
 * Diagnostic script - DELETE AFTER USE
 * Tests the projects endpoint directly
 */
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h2>PredioClick API Diagnostics</h2>";

// Test 1: Config loads
echo "<h3>1. Loading config...</h3>";
try {
    require_once __DIR__ . '/config.php';
    echo "✅ Config loaded OK<br>";
} catch (Exception $e) {
    echo "❌ Config error: " . $e->getMessage() . "<br>";
    exit;
}

// Test 2: Database connection
echo "<h3>2. Database connection...</h3>";
try {
    $pdo = getConnection();
    echo "✅ Connected to database<br>";
} catch (Exception $e) {
    echo "❌ DB error: " . $e->getMessage() . "<br>";
    exit;
}

// Test 3: Tables exist
echo "<h3>3. Checking tables...</h3>";
$tables = ['profiles', 'projects', 'partners', 'lots', 'clients', 'sales', 'payments', 'expenses', 'installments'];
foreach ($tables as $table) {
    try {
        $stmt = $pdo->query("SELECT COUNT(*) as c FROM $table");
        $count = $stmt->fetch()['c'];
        echo "✅ Table '$table' exists ($count rows)<br>";
    } catch (Exception $e) {
        echo "❌ Table '$table' MISSING: " . $e->getMessage() . "<br>";
    }
}

// Test 4: JWT library
echo "<h3>4. Loading JWT...</h3>";
try {
    require_once __DIR__ . '/jwt.php';
    echo "✅ JWT loaded OK<br>";
} catch (Exception $e) {
    echo "❌ JWT error: " . $e->getMessage() . "<br>";
}

// Test 5: PHP version and extensions
echo "<h3>5. PHP Environment</h3>";
echo "PHP Version: " . phpversion() . "<br>";
echo "PDO MySQL: " . (extension_loaded('pdo_mysql') ? '✅' : '❌') . "<br>";
echo "JSON: " . (extension_loaded('json') ? '✅' : '❌') . "<br>";
echo "OpenSSL: " . (extension_loaded('openssl') ? '✅' : '❌') . "<br>";

echo "<br><strong>⚠️ DELETE THIS FILE AFTER DIAGNOSTICS</strong>";
