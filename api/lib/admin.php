<?php
/* Operaciones del administrador: KPIs, cuentas, géneros, artistas, álbumes y canciones. */

function op_topCalificados(array $a, ?array $u): array
{
    $n = lim($a['n'] ?? null, 10);
    return data_r(album_rows(rows('SELECT ' . CAT_COLS . ' FROM v_catalogo ORDER BY total_resenas DESC, id_album LIMIT ' . $n)));
}

function op_kpis(array $a, ?array $u): array
{
    return data_r([
        'albumes'    => (int)val('SELECT COUNT(*) FROM album'),
        'usuarios'   => (int)val('SELECT COUNT(*) FROM usuario'),
        'pendientes' => (int)val("SELECT COUNT(*) FROM resena r JOIN estado_resena e ON e.id_estado = r.id_estado WHERE e.nombre = 'Pendiente'"),
    ]);
}

function op_actividad(array $a, ?array $u): array
{
    $n = lim($a['n'] ?? null, 5);
    $rs = rows('SELECT id_bitacora, id_usuario, accion, detalle, fecha FROM bitacora ORDER BY fecha DESC, id_bitacora DESC LIMIT ' . $n);
    return data_r(array_map(fn($r) => ints($r, ['id_bitacora', 'id_usuario']), $rs));
}

function op_usuarios(array $a, ?array $u): array
{
    $rs = rows('SELECT us.id_usuario, us.nombre_usuario, us.correo, r.nombre AS rol, us.activo
                FROM usuario us JOIN rol r ON r.id_rol = us.id_rol ORDER BY us.id_usuario');
    return data_r(array_map(function ($r) {
        $r = ints($r, ['id_usuario']);
        $r['activo'] = (bool)(int)$r['activo'];
        return $r;
    }, $rs));
}

function op_setActivo(array $a, ?array $u): array
{
    $id = to_int($a['id_usuario'] ?? null);
    $t = $id === null ? null : row('SELECT id_usuario, id_rol, nombre_usuario FROM usuario WHERE id_usuario = ?', [$id]);
    if ($t === null) {
        return fail_r('La cuenta no existe.');
    }
    if ((int)$t['id_rol'] === ROL_ADMIN) {
        return fail_r('No se puede suspender a un administrador.');
    }
    $activo = !empty($a['activo']);
    q('UPDATE usuario SET activo = ? WHERE id_usuario = ?', [$activo ? 1 : 0, $id]);
    bitacora($u['id_usuario'], $activo ? 'CUENTA_REACTIVADA' : 'CUENTA_SUSPENDIDA',
        'admin ' . ($activo ? 'reactivó' : 'suspendió') . ' la cuenta de ' . $t['nombre_usuario']);
    return ok_r();
}

/* ---------- géneros ---------- */
function nombre_genero_error(string $nombre, int $exceptId): ?string
{
    if ($nombre === '') {
        return 'Escribe el nombre del género.';
    }
    if (slen($nombre) > 50) {
        return 'Máximo 50 caracteres.';
    }
    if (val('SELECT 1 FROM genero WHERE nombre = ? AND id_genero <> ?', [$nombre, $exceptId]) !== null) {
        return 'Ese género ya existe.';
    }
    return null;
}
function op_agregarGenero(array $a, ?array $u): array
{
    $nombre = s($a['nombre'] ?? '');
    $err = nombre_genero_error($nombre, 0);
    if ($err !== null) {
        return fail_r($err);
    }
    try {
        q('INSERT INTO genero (nombre) VALUES (?)', [$nombre]);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            return fail_r('Ese género ya existe.');
        }
        throw $e;
    }
    bitacora($u['id_usuario'], 'ALTA_GENERO', 'admin agregó el género ' . $nombre);
    return ok_r();
}
function op_renombrarGenero(array $a, ?array $u): array
{
    $id = to_int($a['id_genero'] ?? null);
    $g = $id === null ? null : row('SELECT id_genero, nombre FROM genero WHERE id_genero = ?', [$id]);
    if ($g === null) {
        return fail_r('El género no existe.');
    }
    $nombre = s($a['nombre'] ?? '');
    $err = nombre_genero_error($nombre, $id);
    if ($err !== null) {
        return fail_r($err);
    }
    q('UPDATE genero SET nombre = ? WHERE id_genero = ?', [$nombre, $id]);
    bitacora($u['id_usuario'], 'MOD_GENERO', 'admin renombró el género ' . $g['nombre'] . ' a ' . $nombre);
    return ok_r();
}
function op_eliminarGenero(array $a, ?array $u): array
{
    $id = to_int($a['id_genero'] ?? null);
    $g = $id === null ? null : row('SELECT id_genero, nombre FROM genero WHERE id_genero = ?', [$id]);
    if ($g === null) {
        return fail_r('El género no existe.');
    }
    $uso = (int)val('SELECT (SELECT COUNT(*) FROM artista WHERE id_genero = ?) + (SELECT COUNT(*) FROM album WHERE id_genero = ?)', [$id, $id]);
    if ($uso > 0) {
        return fail_r('No se puede eliminar «' . $g['nombre'] . '» porque está en uso por artistas o álbumes.');
    }
    q('DELETE FROM genero WHERE id_genero = ?', [$id]);   // usuario_genero cae en cascada
    bitacora($u['id_usuario'], 'BAJA_GENERO', 'admin eliminó el género ' . $g['nombre']);
    return ok_r();
}

/* ---------- artistas ---------- */
function op_guardarArtista(array $a, ?array $u): array
{
    $id = to_int($a['id_artista'] ?? null) ?: null;
    $ex = $id === null ? null : row('SELECT id_artista, id_genero FROM artista WHERE id_artista = ?', [$id]);
    if ($id !== null && $ex === null) {
        return fail_r('El artista no existe.');
    }
    $errors = [];
    $nombre = s($a['nombre'] ?? '');
    $pais = s($a['pais'] ?? '');
    $bio = s($a['biografia'] ?? '');
    $idG = to_int($a['id_genero'] ?? null);

    if ($nombre === '') {
        $errors['nombre'] = 'Escribe el nombre del artista.';
    } elseif (slen($nombre) > 100) {
        $errors['nombre'] = 'Máximo 100 caracteres.';
    } elseif (val('SELECT 1 FROM artista WHERE nombre = ? AND id_artista <> ?', [$nombre, $id ?? 0]) !== null) {
        $errors['nombre'] = 'Ya existe un artista con ese nombre.';
    }
    if ($idG === null || val('SELECT 1 FROM genero WHERE id_genero = ?', [$idG]) === null) {
        $errors['id_genero'] = 'Elige un género.';
    }
    if (slen($pais) > 60) {
        $errors['pais'] = 'Máximo 60 caracteres.';
    }
    if (slen($bio) > 1000) {
        $errors['biografia'] = 'Máximo 1000 caracteres.';
    }
    if ($ex !== null && !isset($errors['id_genero']) && (int)$ex['id_genero'] !== $idG
        && val('SELECT 1 FROM album WHERE id_artista = ? LIMIT 1', [$id]) !== null) {
        $errors['id_genero'] = 'No se puede cambiar el género de un artista con álbumes (cada álbum conserva el género de su artista).';
    }
    if ($errors) {
        return fail_r('Revisa los campos marcados.', $errors);
    }
    $pais = $pais === '' ? null : $pais;
    $bio = $bio === '' ? null : $bio;
    try {
        if ($ex !== null) {
            q('UPDATE artista SET nombre = ?, id_genero = ?, pais = ?, biografia = ? WHERE id_artista = ?', [$nombre, $idG, $pais, $bio, $id]);
            bitacora($u['id_usuario'], 'MOD_ARTISTA', 'admin modificó al artista ' . $nombre);
        } else {
            q('INSERT INTO artista (id_genero, nombre, pais, biografia) VALUES (?, ?, ?, ?)', [$idG, $nombre, $pais, $bio]);
            bitacora($u['id_usuario'], 'ALTA_ARTISTA', 'admin añadió al artista ' . $nombre);
        }
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            return fail_r('Revisa los campos marcados.', ['nombre' => 'Ya existe un artista con ese nombre.']);
        }
        throw $e;
    }
    return ok_r();
}

function op_eliminarArtista(array $a, ?array $u): array
{
    $id = to_int($a['id_artista'] ?? null);
    $ar = $id === null ? null : row('SELECT id_artista, nombre FROM artista WHERE id_artista = ?', [$id]);
    if ($ar === null) {
        return fail_r('El artista no existe.');
    }
    if (val('SELECT 1 FROM album WHERE id_artista = ? LIMIT 1', [$id]) !== null) {
        return fail_r('No se puede eliminar a «' . $ar['nombre'] . '» porque todavía tiene álbumes. Elimina o reasigna sus álbumes primero.');
    }
    q('DELETE FROM artista WHERE id_artista = ?', [$id]);
    bitacora($u['id_usuario'], 'BAJA_ARTISTA', 'admin eliminó al artista ' . $ar['nombre']);
    return ok_r();
}

/* ---------- álbumes ---------- */
function op_guardarAlbum(array $a, ?array $u): array
{
    $id = to_int($a['id_album'] ?? null) ?: null;
    $ex = $id === null ? null : row('SELECT id_album FROM album WHERE id_album = ?', [$id]);
    if ($id !== null && $ex === null) {
        return fail_r('El álbum no existe.');
    }
    $errors = [];
    $titulo = s($a['titulo'] ?? '');
    $idA = to_int($a['id_artista'] ?? null);
    $ar = $idA === null ? null : row('SELECT id_artista, id_genero FROM artista WHERE id_artista = ?', [$idA]);
    $anio = to_int($a['anio'] ?? null);
    $hue = to_int($a['hue'] ?? null);

    if ($titulo === '') {
        $errors['titulo'] = 'Escribe el título del álbum.';
    } elseif (slen($titulo) > 100) {
        $errors['titulo'] = 'Máximo 100 caracteres.';
    }
    if ($ar === null) {
        $errors['id_artista'] = 'Elige un artista.';
    }
    if ($anio === null || $anio < 1900 || $anio > 2100) {
        $errors['anio'] = 'El año debe estar entre 1900 y 2100.';
    }
    if ($hue === null || $hue < 0 || $hue > 360) {
        $errors['hue'] = 'El tono debe estar entre 0 y 360.';
    }
    if (!isset($errors['titulo']) && $ar !== null
        && val('SELECT 1 FROM album WHERE id_artista = ? AND titulo = ? AND id_album <> ?', [$idA, $titulo, $id ?? 0]) !== null) {
        $errors['titulo'] = 'Ese artista ya tiene un álbum con ese título.';
    }
    if ($errors) {
        return fail_r('Revisa los campos marcados.', $errors);
    }
    $idGenero = (int)$ar['id_genero'];   // el álbum hereda el género de su artista
    try {
        if ($ex !== null) {
            q('UPDATE album SET id_artista = ?, id_genero = ?, titulo = ?, anio_lanzamiento = ?, portada_hue = ? WHERE id_album = ?',
                [$idA, $idGenero, $titulo, $anio, $hue, $id]);
            bitacora($u['id_usuario'], 'MOD_ALBUM', 'admin modificó el álbum ' . $titulo);
        } else {
            q('INSERT INTO album (id_artista, id_genero, titulo, anio_lanzamiento, portada_hue) VALUES (?, ?, ?, ?, ?)',
                [$idA, $idGenero, $titulo, $anio, $hue]);
            bitacora($u['id_usuario'], 'ALTA_ALBUM', 'admin añadió el álbum ' . $titulo);
        }
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            return fail_r('Revisa los campos marcados.', ['titulo' => 'Ese artista ya tiene un álbum con ese título.']);
        }
        throw $e;
    }
    return ok_r();
}

function op_eliminarAlbum(array $a, ?array $u): array
{
    $id = to_int($a['id_album'] ?? null);
    $al = $id === null ? null : row('SELECT id_album, titulo FROM album WHERE id_album = ?', [$id]);
    if ($al === null) {
        return fail_r('El álbum no existe.');
    }
    q('DELETE FROM album WHERE id_album = ?', [$id]);   // canciones, reseñas (y sus reportes) y lista_album caen en cascada
    bitacora($u['id_usuario'], 'BAJA_ALBUM', 'admin eliminó el álbum ' . $al['titulo']);
    return ok_r();
}

/* ---------- canciones ---------- */
function op_canciones(array $a, ?array $u): array
{
    $id = to_int($a['id_album'] ?? null);
    if ($id === null) {
        return data_r([]);
    }
    $rs = rows('SELECT id_cancion, id_album, numero_pista, titulo, duracion_seg, es_sencillo
                FROM cancion WHERE id_album = ? ORDER BY numero_pista', [$id]);
    return data_r(array_map(fn($r) => ints($r, ['id_cancion', 'id_album', 'numero_pista', 'duracion_seg', 'es_sencillo']), $rs));
}

function op_guardarCancion(array $a, ?array $u): array
{
    $idAlbum = to_int($a['id_album'] ?? null);
    $al = $idAlbum === null ? null : row('SELECT id_album, titulo FROM album WHERE id_album = ?', [$idAlbum]);
    if ($al === null) {
        return fail_r('El álbum no existe.');
    }
    $idC = to_int($a['id_cancion'] ?? null) ?: null;
    $ex = $idC === null ? null : row('SELECT id_cancion, id_album FROM cancion WHERE id_cancion = ?', [$idC]);
    if ($idC !== null && ($ex === null || (int)$ex['id_album'] !== $idAlbum)) {
        return fail_r('La canción no existe.');
    }
    $errors = [];
    $titulo = s($a['titulo'] ?? '');
    $dur = to_int($a['duracion_seg'] ?? null);
    if ($titulo === '') {
        $errors['titulo'] = 'Escribe el título de la canción.';
    } elseif (slen($titulo) > 100) {
        $errors['titulo'] = 'Máximo 100 caracteres.';
    }
    if ($dur === null || $dur <= 0 || $dur > 65535) {
        $errors['duracion'] = 'La duración debe tener el formato mm:ss y ser mayor a 0.';
    }
    if ($ex === null && (int)val('SELECT COUNT(*) FROM cancion WHERE id_album = ?', [$idAlbum]) >= 255) {
        $errors['titulo'] = 'Un álbum admite hasta 255 canciones.';
    }
    if ($errors) {
        return fail_r('Revisa los campos marcados.', $errors);
    }
    $sen = !empty($a['es_sencillo']) ? 1 : 0;
    if ($ex !== null) {
        q('UPDATE cancion SET titulo = ?, duracion_seg = ?, es_sencillo = ? WHERE id_cancion = ?', [$titulo, $dur, $sen, $idC]);
    } else {
        q('INSERT INTO cancion (id_album, numero_pista, titulo, duracion_seg, es_sencillo)
           SELECT ?, COALESCE(MAX(numero_pista), 0) + 1, ?, ?, ? FROM cancion WHERE id_album = ?', [$idAlbum, $titulo, $dur, $sen, $idAlbum]);
    }
    bitacora($u['id_usuario'], 'MOD_TRACKLIST', 'admin actualizó el tracklist de ' . $al['titulo']);
    return ok_r();
}

function op_eliminarCancion(array $a, ?array $u): array
{
    $id = to_int($a['id_cancion'] ?? null);
    $c = $id === null ? null : row('SELECT c.id_cancion, c.id_album, al.titulo FROM cancion c JOIN album al ON al.id_album = c.id_album WHERE c.id_cancion = ?', [$id]);
    if ($c === null) {
        return fail_r('La canción no existe.');
    }
    $pdo = db();
    $pdo->beginTransaction();
    try {
        q('DELETE FROM cancion WHERE id_cancion = ?', [$id]);
        // renumera sin huecos, en orden ascendente (respeta la llave única id_album + numero_pista)
        $ids = array_column(rows('SELECT id_cancion FROM cancion WHERE id_album = ? ORDER BY numero_pista', [(int)$c['id_album']]), 'id_cancion');
        foreach ($ids as $i => $cid) {
            q('UPDATE cancion SET numero_pista = ? WHERE id_cancion = ?', [$i + 1, (int)$cid]);
        }
        $pdo->commit();
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
    bitacora($u['id_usuario'], 'MOD_TRACKLIST', 'admin actualizó el tracklist de ' . $c['titulo']);
    return ok_r();
}
