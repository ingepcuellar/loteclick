<?php
/**
 * LoteClick API - Notification Diagnostic
 * TEMPORARY - Remove after debugging
 */
require_once __DIR__ . '/../config.php';

$pdo = getConnection();

// 1. Count all notifications
$allCount = $pdo->query("SELECT COUNT(*) as cnt FROM notifications")->fetch();

// 2. Get the 5 most recent notifications (all columns)
$recent = $pdo->query("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 5")->fetchAll();

// 3. Get all partner USERS (from profiles table)
$partnerUsers = $pdo->query("SELECT id, name, email, role FROM profiles WHERE role = 'partner'")->fetchAll();

// 4. Get project partners (from partners table)
$projectPartners = $pdo->query("SELECT * FROM partners LIMIT 20")->fetchAll();

// 5. Check for discount notifications
$discountNotifs = $pdo->query("SELECT * FROM notifications WHERE type = 'discount_request' ORDER BY created_at DESC LIMIT 5")->fetchAll();

// 6. Sales with discounts (use SELECT * to avoid column name issues)
$discountSales = $pdo->query("SELECT * FROM sales WHERE discount_amount IS NOT NULL AND discount_amount > 0 ORDER BY created_at DESC LIMIT 3")->fetchAll();

// 7. Show sales table column names
$salesColumns = $pdo->query("SHOW COLUMNS FROM sales")->fetchAll();

jsonResponse([
    'data' => [
        'total_notifications' => $allCount['cnt'],
        'recent_notifications' => $recent,
        'partner_users_in_profiles' => $partnerUsers,
        'project_partners_table' => $projectPartners,
        'discount_notifications' => $discountNotifs,
        'discount_sales' => $discountSales,
        'sales_columns' => $salesColumns
    ]
]);
