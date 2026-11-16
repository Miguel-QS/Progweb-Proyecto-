<?php
/* Sesión, registro, perfil y recomendaciones. */

const ROL_USUARIO = 1;
const ROL_ADMIN = 2;
const LISTAS_BASE = [[1, 'Quiero escuchar'], [2, 'Favoritos'], [3, 'Historial de escuchados']];

function op_me(array $a, ?array $u): array
{
    return data_r($u);
}

function op_login(array $a, ?array $u): array
{
    $correo = s($a['correo'] ?? '');
    $pass = is_string($a['password'] ?? null) ? $a['password'] : '';
    $errors = [];
    if ($correo === '') {
        $errors['correo'] = 'Ingresa tu correo electrónico.';
    }
    if ($pass === '') {
        $errors['password'] = 'Ingresa tu contraseña.';
    }
    if ($errors) {
        return fail_r('Revisa los campos marcados.', $errors);
    }
    $r = row('SELECT id_usuario, id_rol, nombre_usuario, correo, contrasena_hash, biografia, avatar_url, activo
              FROM usuario WHERE correo = ?', [$correo]);
    // Se verifica siempre contra un hash para que el tiempo no delate si el correo existe.
    $dummy = '$2y$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ01';
    $valid = password_verify($pass, $r['contrasena_hash'] ?? $dummy);
    if ($r === null || !$valid) {
        return fail_r('Correo o contraseña incorrectos.', ['general' => 'Correo o contraseña incorrectos.']);
    }
    if (!(int)$r['activo']) {
        $m = 'Tu cuenta está suspendida. Contacta al equipo de soporte.';
        return fail_r($m, ['general' => $m]);
    }
    if (password_needs_rehash($r['contrasena_hash'], PASSWORD_DEFAULT)) {
        run('UPDATE usuario SET contrasena_hash = ? WHERE id_usuario = ?', [password_hash($pass, PASSWORD_DEFAULT), (int)$r['id_usuario']]);
    }
    login_session((int)$r['id_usuario'], !empty($a['remember']));
    return ok_r(['usuario' => public_user($r)]);
}

function op_registrar(array $a, ?array $u): array
{
    $errors = [];
    $nombre = s($a['nombre_usuario'] ?? '');
    $correo = s($a['correo'] ?? '');
    $p1 = is_string($a['password'] ?? null) ? $a['password'] : '';
    $p2 = is_string($a['password2'] ?? null) ? $a['password2'] : '';

    if ($nombre === '') {
        $errors['nombre_usuario'] = 'Elige un nombre de usuario.';
    } elseif (slen($nombre) > 30) {
        $errors['nombre_usuario'] = 'Máximo 30 caracteres.';
    } elseif (val('SELECT 1 FROM usuario WHERE nombre_usuario = ?', [$nombre]) !== null) {
        $errors['nombre_usuario'] = 'Ese nombre de usuario ya está en uso.';
    }
    if ($correo === '') {
        $errors['correo'] = 'Ingresa tu correo electrónico.';
    } elseif (!filter_var($correo, FILTER_VALIDATE_EMAIL) || slen($correo) > 100) {
        $errors['correo'] = 'Escribe un correo válido (por ejemplo tu@ejemplo.com).';
    } elseif (val('SELECT 1 FROM usuario WHERE correo = ?', [$correo]) !== null) {
        $errors['correo'] = 'Ese correo ya tiene una cuenta.';
    }
    if ($p1 === '') {
        $errors['password'] = 'Elige una contraseña.';
    } elseif (slen($p1) < 8) {
        $errors['password'] = 'La contraseña debe tener al menos 8 caracteres.';
    } elseif (strlen($p1) > 72) {
        $errors['password'] = 'La contraseña no puede exceder 72 caracteres.'; // límite de bcrypt
    }
    if (!isset($errors['password']) && $p1 !== $p2) {
        $errors['password2'] = 'Las contraseñas no coinciden.';
    }
    if ($errors) {
        return fail_r('Revisa los campos marcados.', $errors);
    }

    $pdo = db();
    $pdo->beginTransaction();
    try {
        q('INSERT INTO usuario (id_rol, nombre_usuario, correo, contrasena_hash) VALUES (?, ?, ?, ?)',
            [ROL_USUARIO, $nombre, $correo, password_hash($p1, PASSWORD_DEFAULT)]);
        $id = last_id();
        foreach (LISTAS_BASE as $l) {
            q('INSERT INTO lista (id_usuario, id_tipo, nombre) VALUES (?, ?, ?)', [$id, $l[0], $l[1]]);
        }
        bitacora($id, 'USUARIO_REGISTRADO', $nombre . ' creó su cuenta');
        $pdo->commit();
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        if ($e->getCode() === '23000') {   // carrera: alguien ganó el nombre o el correo
            return fail_r('Revisa los campos marcados.', ['correo' => 'Ese correo o nombre de usuario ya está en uso.']);
        }
        throw $e;
    }
    login_session($id, false);
    $nuevo = row('SELECT id_usuario, id_rol, nombre_usuario, correo, biografia, avatar_url, activo FROM usuario WHERE id_usuario = ?', [$id]);
    return ok_r(['usuario' => public_user($nuevo)]);
}

function op_logout(array $a, ?array $u): array
{
    end_session();
    return ok_r();
}

function op_generosFavoritos(array $a, ?array $u): array
{
    $rs = rows('SELECT g.id_genero, g.nombre FROM usuario_genero ug JOIN genero g ON g.id_genero = ug.id_genero
                WHERE ug.id_usuario = ? ORDER BY g.id_genero', [$u['id_usuario']]);
    return data_r(array_map(fn($r) => ints($r, ['id_genero']), $rs));
}

function op_actualizarPerfil(array $a, ?array $u): array
{
    $errors = [];
    $bio = s($a['biografia'] ?? '');
    $av = s($a['avatar_url'] ?? '');
    if (slen($bio) > 300) {
        $errors['biografia'] = 'La biografía no puede exceder 300 caracteres.';
    }
    if ($av !== '' && (!preg_match('~^https?://\S+$~i', $av) || strlen($av) > 255)) {
        $errors['avatar_url'] = 'Escribe una URL de imagen válida (http:// o https://, máx. 255 caracteres).';
    }
    if ($errors) {
        return fail_r('Revisa los campos marcados.', $errors);
    }
    $gens = is_array($a['generos'] ?? null) ? $a['generos'] : [];
    $pdo = db();
    $pdo->beginTransaction();
    try {
        q('UPDATE usuario SET biografia = ?, avatar_url = ? WHERE id_usuario = ?', [$bio === '' ? null : $bio, $av === '' ? null : $av, $u['id_usuario']]);
        q('DELETE FROM usuario_genero WHERE id_usuario = ?', [$u['id_usuario']]);
        foreach ($gens as $g) {
            $gi = to_int($g);
            if ($gi !== null) {   // solo entra si el género existe
                q('INSERT IGNORE INTO usuario_genero (id_usuario, id_genero) SELECT ?, id_genero FROM genero WHERE id_genero = ?', [$u['id_usuario'], $gi]);
            }
        }
        $pdo->commit();
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
    return ok_r();
}

function op_recomendaciones(array $a, ?array $u): array
{
    $uid = $u['id_usuario'];
    $gens = rows('SELECT g.nombre FROM usuario_genero ug JOIN genero g ON g.id_genero = ug.id_genero
                  WHERE ug.id_usuario = ? ORDER BY g.id_genero', [$uid]);
    $albs = rows('SELECT ' . CAT_COLS . ' FROM v_catalogo
                  WHERE id_genero IN (SELECT id_genero FROM usuario_genero WHERE id_usuario = ?)
                    AND id_album NOT IN (SELECT id_album FROM resena WHERE id_usuario = ?)
                  ORDER BY (promedio IS NULL), promedio DESC, id_album LIMIT 10', [$uid, $uid]);
    return data_r(['generos' => array_column($gens, 'nombre'), 'albumes' => album_rows($albs)]);
}
