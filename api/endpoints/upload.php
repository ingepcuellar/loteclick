<?php
/**
 * LoteClick API - File Upload Endpoint
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../jwt.php';

$auth = requireAuth();
$method = getMethod();
$action = getParam('action', '');

if ($action === 'delete') {
    deleteFile();
    exit;
}

if ($method !== 'POST') jsonError('Método no permitido', 405);

// Handle file upload
if (empty($_FILES['file'])) {
    jsonError('No se recibió ningún archivo');
}

$file = $_FILES['file'];

if ($file['error'] !== UPLOAD_ERR_OK) {
    jsonError('Error en la subida del archivo: ' . $file['error']);
}

if ($file['size'] > MAX_FILE_SIZE) {
    jsonError('El archivo es demasiado grande. Máximo: 5MB');
}

// Validate file type
$allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mimeType = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

if (!in_array($mimeType, $allowedTypes)) {
    jsonError('Tipo de archivo no permitido. Solo: JPG, PNG, WebP, PDF');
}

// Create upload directory
$uploadDir = UPLOAD_DIR . 'receipts/' . date('Y') . '/' . date('m') . '/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

// Generate unique filename
$ext = pathinfo($file['name'], PATHINFO_EXTENSION);
$filename = generateUUID() . '.' . $ext;
$filepath = $uploadDir . $filename;

if (!move_uploaded_file($file['tmp_name'], $filepath)) {
    jsonError('Error al guardar el archivo', 500);
}

// Build public URL
$publicUrl = 'uploads/receipts/' . date('Y') . '/' . date('m') . '/' . $filename;

jsonResponse([
    'data' => [
        'url' => $publicUrl,
        'filename' => $filename,
        'size' => $file['size'],
        'type' => $mimeType
    ]
], 201);

function deleteFile() {
    if (getMethod() !== 'DELETE' && getMethod() !== 'POST') jsonError('Método no permitido', 405);

    $body = getJsonBody();
    $url = $body['url'] ?? $body['path'] ?? null;

    if (!$url) jsonError('URL del archivo requerida');

    // Security: only allow deleting from uploads directory
    $fullPath = __DIR__ . '/../' . $url;
    $realPath = realpath($fullPath);
    $uploadsDir = realpath(UPLOAD_DIR);

    if ($realPath && $uploadsDir && strpos($realPath, $uploadsDir) === 0 && file_exists($realPath)) {
        unlink($realPath);
        jsonResponse(['data' => ['deleted' => true]]);
    } else {
        jsonError('Archivo no encontrado', 404);
    }
}
