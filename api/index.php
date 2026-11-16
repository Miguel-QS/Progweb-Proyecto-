<?php
/* =====================================================================
   AlbumMatch — API (punto de entrada único)
   POST /api/index.php   {"op": "...", "args": {...}}
   Contrato: assets/js/dispatch.js · Pruebas: tests/api_contract.py
   ===================================================================== */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

require __DIR__ . '/lib/core.php';
require __DIR__ . '/lib/catalogo.php';
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/resenas.php';
require __DIR__ . '/lib/listas.php';
require __DIR__ . '/lib/admin.php';
require __DIR__ . '/lib/ops.php';

function out(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    out(405, fail_r('Método no permitido.'));
}
// Defensa contra CSRF: solo JSON (un formulario de otro sitio no puede enviarlo) y mismo origen.
if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) {
    out(415, fail_r('Content-Type debe ser application/json.'));
}
if (!empty($_SERVER['HTTP_ORIGIN'])) {
    $o = parse_url($_SERVER['HTTP_ORIGIN']);
    $oh = ($o['host'] ?? '') . (isset($o['port']) ? ':' . $o['port'] : '');
    if (strcasecmp($oh, $_SERVER['HTTP_HOST'] ?? '') !== 0) {
        out(403, fail_r('Origen no permitido.'));
    }
}
$raw = file_get_contents('php://input');
if ($raw === false || strlen($raw) > 200000) {
    out(413, fail_r('Petición demasiado grande.'));
}
$in = json_decode($raw, true);
if (!is_array($in) || !isset($in['op']) || !is_string($in['op'])) {
    out(400, fail_r('Petición no válida.'));
}
$args = isset($in['args']) && is_array($in['args']) ? $in['args'] : [];

try {
    $ops = ops_table();
    if (!array_key_exists($in['op'], $ops)) {
        out(404, fail_r('Operación desconocida.'));
    }
    [$nivel, $fn] = $ops[$in['op']];
    $u = current_user();
    if ($nivel !== 'public') {
        if ($u === null) {
            out(401, fail_r('Inicia sesión para continuar.', [], 'auth'));
        }
        if (($nivel === 'user' && $u['id_rol'] !== ROL_USUARIO) || ($nivel === 'admin' && $u['id_rol'] !== ROL_ADMIN)) {
            out(403, fail_r('No tienes permisos para esta acción.', [], 'forbidden'));
        }
    }
    out(200, $fn($args, $u));
} catch (Throwable $e) {
    error_log('[AlbumMatch] ' . $e->getMessage() . ' en ' . $e->getFile() . ':' . $e->getLine());
    out(500, fail_r('Error del servidor. Revisa la conexión a la base de datos (api/config.local.php) y el registro de errores de PHP.'));
}
