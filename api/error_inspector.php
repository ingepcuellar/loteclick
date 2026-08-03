<?php
/**
 * LoteClick API - Error Inspector
 * Access this via browser to see server-side php error logs.
 */
header('Content-Type: text/plain; charset=utf-8');

echo "=== LOTECLICK SERVER-SIDE ERROR INSPECTOR ===\n\n";

$searchPaths = [
    __DIR__ . '/error_log',
    __DIR__ . '/endpoints/error_log',
    dirname(__DIR__) . '/error_log',
];

foreach ($searchPaths as $path) {
    echo "Checking: $path\n";
    if (file_exists($path)) {
        echo "✅ File exists! Size: " . filesize($path) . " bytes\n";
        echo "--- Last 50 lines of " . basename($path) . " ---\n";
        $lines = file($path);
        $lastLines = array_slice($lines, -50);
        foreach ($lastLines as $line) {
            echo $line;
        }
        echo "----------------------------------------\n\n";
    } else {
        echo "❌ File does not exist\n\n";
    }
}

echo "=== PHP INFO ===\n";
echo "PHP Version: " . phpversion() . "\n";
echo "Display Errors: " . ini_get('display_errors') . "\n";
echo "Log Errors: " . ini_get('log_errors') . "\n";
echo "Error Log Path: " . ini_get('error_log') . "\n";
if (ini_get('error_log') && file_exists(ini_get('error_log'))) {
    echo "✅ System error log exists! Last 20 lines:\n";
    $lines = file(ini_get('error_log'));
    foreach (array_slice($lines, -20) as $line) {
        echo $line;
    }
}
echo "\n=== END ===\n";
