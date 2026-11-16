<?php
/* =====================================================================
   AlbumMatch — núcleo de la API: configuración, base de datos,
   respuestas JSON y sesión. Contrato completo: assets/js/dispatch.js
   ===================================================================== */

function config(): array
{
    static $cfg = null;
    if ($cfg === null) {
        $cfg = [
            'db_host' => '127.0.0.1',
            'db_port' => 3306,
            'db_name' => 'albummatch',
            'db_user' => 'root',      // en XAMPP; en producción usa database/usuario_app.sql
            'db_pass' => '',
            'session_days' => 30,     // duración de «Recordarme»
        ];
        $local = dirname(__DIR__) . '/config.local.php';
        if (is_file($local)) {
            $over = require $local;
            if (is_array($over)) {
                $cfg = array_merge($cfg, $over);
            }
        }
    }
    return $cfg;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $c = config();
        $dsn = 'mysql:host=' . $c['db_host'] . ';port=' . (int)$c['db_port'] . ';dbname=' . $c['db_name'] . ';charset=utf8mb4';
        $pdo = new PDO($dsn, $c['db_user'], $c['db_pass'], [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }
    return $pdo;
}

/** Ejecuta una consulta preparada (siempre con parámetros, nunca concatenando datos). */
function q(string $sql, array $params = []): PDOStatement
{
    $st = db()->prepare($sql);
    $st->execute($params);
    return $st;
}
function rows(string $sql, array $params = []): array
{
    return q($sql, $params)->fetchAll();
}
function row(string $sql, array $params = []): ?array
{
    $r = q($sql, $params)->fetch();
    return $r === false ? null : $r;
}
function val(string $sql, array $params = [])
{
    $r = q($sql, $params)->fetchColumn();
    return $r === false ? null : $r;
}
function run(string $sql, array $params = []): int
{
    return q($sql, $params)->rowCount();
}
function last_id(): int
{
    return (int)db()->lastInsertId();
}

/* ---------- respuestas ---------- */
function ok_r(array $extra = []): array
{
    return ['ok' => true] + $extra;
}
function fail_r(string $error, array $errors = [], ?string $code = null): array
{
    $r = ['ok' => false, 'error' => $error, 'errors' => (object)$errors];
    if ($code !== null) {
        $r['code'] = $code;
    }
    return $r;
}
function data_r($data): array
{
    return ['ok' => true, 'data' => $data];
}

/* ---------- texto ---------- */
function s($v): string
{
    return is_scalar($v) ? trim((string)$v) : '';
}
function slen(string $s): int
{
    return function_exists('mb_strlen') ? mb_strlen($s, 'UTF-8') : strlen($s);
}
function cut(string $s, int $n): string
{
    return function_exists('mb_substr') ? mb_substr($s, 0, $n, 'UTF-8') : substr($s, 0, $n);
}
/** Entero estricto: acepta 5 y "5", rechaza 5.5, "abc", null. */
function to_int($v): ?int
{
    if (is_int($v)) {
        return $v;
    }
    if (is_float($v) && floor($v) == $v) {
        return (int)$v;
    }
    if (is_string($v) && preg_match('/^-?\d+$/', trim($v))) {
        return (int)trim($v);
    }
    return null;
}
function ints(array $r, array $keys): array
{
    foreach ($keys as $k) {
        if (array_key_exists($k, $r) && $r[$k] !== null) {
            $r[$k] = (int)$r[$k];
        }
    }
    return $r;
}

/* ---------- bitácora ---------- */
function bitacora(?int $idUsuario, string $accion, string $detalle): void
{
    q('INSERT INTO bitacora (id_usuario, accion, detalle) VALUES (?, ?, ?)', [$idUsuario, cut($accion, 40), cut($detalle, 255)]);
}

/* ---------- sesión ---------- */
function is_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || ((int)($_SERVER['SERVER_PORT'] ?? 0) === 443);
}
function cookie_path(): string
{
    $p = str_replace('\\', '/', dirname(dirname($_SERVER['SCRIPT_NAME'] ?? '/api/index.php')));
    return ($p === '' || $p === '.') ? '/' : $p;
}
function cookie_opts(int $expires): array
{
    return ['expires' => $expires, 'path' => cookie_path(), 'secure' => is_https(), 'httponly' => true, 'samesite' => 'Lax'];
}
function start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.gc_maxlifetime', (string)(86400 * (int)config()['session_days']));
    session_name('albummatch');
    session_set_cookie_params(['lifetime' => 0, 'path' => cookie_path(), 'secure' => is_https(), 'httponly' => true, 'samesite' => 'Lax']);
    session_start();
}
function end_session(): void
{
    start_session();
    $_SESSION = [];
    setcookie(session_name(), '', cookie_opts(time() - 3600));
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_destroy();
    }
}
function login_session(int $idUsuario, bool $remember): void
{
    start_session();
    session_regenerate_id(true);            // evita fijación de sesión
    $_SESSION['uid'] = $idUsuario;
    if ($remember) {
        setcookie(session_name(), session_id(), cookie_opts(time() + 86400 * (int)config()['session_days']));
    }
}

/** Usuario de la sesión (null si no hay o si su cuenta fue suspendida). */
function current_user(): ?array
{
    if (session_status() !== PHP_SESSION_ACTIVE && empty($_COOKIE['albummatch'])) {
        return null;   // visitante sin cookie: no se abre sesión (ni se crean archivos de sesión)
    }
    start_session();
    $id = (int)($_SESSION['uid'] ?? 0);
    if ($id <= 0) {
        return null;
    }
    $u = row('SELECT id_usuario, id_rol, nombre_usuario, correo, biografia, avatar_url, activo FROM usuario WHERE id_usuario = ?', [$id]);
    if ($u === null || !(int)$u['activo']) {
        end_session();
        return null;
    }
    return public_user($u);
}
function public_user(array $u): array
{
    return [
        'id_usuario'     => (int)$u['id_usuario'],
        'id_rol'         => (int)$u['id_rol'],
        'nombre_usuario' => $u['nombre_usuario'],
        'correo'         => $u['correo'],
        'biografia'      => $u['biografia'],
        'avatar_url'     => $u['avatar_url'],
        'activo'         => (int)$u['activo'],
    ];
}
