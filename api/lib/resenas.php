<?php
/* Reseñas, reportes y moderación. */

function resena_row(int $id): ?array
{
    $r = row('SELECT id_resena, id_usuario, id_album, id_estado, calificacion, comentario, fecha_publicacion, fecha_edicion
              FROM resena WHERE id_resena = ?', [$id]);
    return $r === null ? null : ints($r, ['id_resena', 'id_usuario', 'id_album', 'id_estado', 'calificacion']);
}

function op_resenaDe(array $a, ?array $u): array
{
    $idAlbum = to_int($a['id_album'] ?? null);
    if ($idAlbum === null) {
        return data_r(null);
    }
    $id = val('SELECT id_resena FROM resena WHERE id_usuario = ? AND id_album = ?', [$u['id_usuario'], $idAlbum]);
    return data_r($id === null ? null : resena_row((int)$id));
}

function op_guardarResena(array $a, ?array $u): array
{
    $idAlbum = to_int($a['id_album'] ?? null);
    $al = $idAlbum === null ? null : row('SELECT id_album, titulo FROM album WHERE id_album = ?', [$idAlbum]);
    if ($al === null) {
        return fail_r('El álbum no existe.');
    }
    $cal = to_int($a['calificacion'] ?? null);
    if ($cal === null || $cal < 1 || $cal > 5) {
        return fail_r('Elige una calificación de 1 a 5 estrellas.', ['calificacion' => 'Elige de 1 a 5 estrellas.']);
    }
    $com = s($a['comentario'] ?? '');
    if (slen($com) > 1000) {
        return fail_r('El comentario no puede exceder 1000 caracteres.', ['comentario' => 'Máximo 1000 caracteres.']);
    }
    $com = $com === '' ? null : $com;

    $ex = val('SELECT id_resena FROM resena WHERE id_usuario = ? AND id_album = ?', [$u['id_usuario'], $idAlbum]);
    if ($ex !== null) {   // UPDATE: se conserva el estado de moderación
        q('UPDATE resena SET calificacion = ?, comentario = ?, fecha_edicion = NOW() WHERE id_resena = ?', [$cal, $com, (int)$ex]);
        bitacora($u['id_usuario'], 'RESENA_EDITADA', $u['nombre_usuario'] . ' editó su reseña de ' . $al['titulo']);
        return ok_r(['resena' => resena_row((int)$ex), 'accion' => 'actualizada']);
    }
    try {
        q("INSERT INTO resena (id_usuario, id_album, id_estado, calificacion, comentario)
           VALUES (?, ?, (SELECT id_estado FROM estado_resena WHERE nombre = 'Pendiente'), ?, ?)", [$u['id_usuario'], $idAlbum, $cal, $com]);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            return fail_r('Ya reseñaste este álbum. Recarga la página para editar tu reseña.');
        }
        throw $e;
    }
    $id = last_id();
    bitacora($u['id_usuario'], 'RESENA_PUBLICADA',
        $u['nombre_usuario'] . ' calificó ' . $al['titulo'] . ' con ' . $cal . ($cal === 1 ? ' estrella' : ' estrellas'));
    return ok_r(['resena' => resena_row($id), 'accion' => 'creada']);
}

function op_eliminarResena(array $a, ?array $u): array
{
    $id = to_int($a['id_resena'] ?? null);
    $r = $id === null ? null : row('SELECT r.id_resena, r.id_usuario, al.titulo FROM resena r
                                    JOIN album al ON al.id_album = r.id_album WHERE r.id_resena = ?', [$id]);
    if ($r === null) {
        return fail_r('La reseña no existe.');
    }
    if ((int)$r['id_usuario'] !== $u['id_usuario'] && $u['id_rol'] !== ROL_ADMIN) {
        return fail_r('No puedes eliminar esta reseña.');
    }
    q('DELETE FROM resena WHERE id_resena = ?', [$id]);   // los reportes de esa reseña caen en cascada
    bitacora($u['id_usuario'], 'RESENA_ELIMINADA', $u['nombre_usuario'] . ' eliminó una reseña de ' . $r['titulo']);
    return ok_r();
}

function op_misResenas(array $a, ?array $u): array
{
    $rs = rows('SELECT r.id_resena, r.id_album, al.titulo, r.calificacion, r.comentario, r.id_estado, e.nombre AS estado,
                       r.fecha_publicacion, r.fecha_edicion
                FROM resena r
                JOIN album al ON al.id_album = r.id_album
                JOIN estado_resena e ON e.id_estado = r.id_estado
                WHERE r.id_usuario = ?
                ORDER BY r.fecha_publicacion DESC, r.id_resena DESC', [$u['id_usuario']]);
    return data_r(array_map(fn($r) => ints($r, ['id_resena', 'id_album', 'calificacion', 'id_estado']), $rs));
}

function op_crearReporte(array $a, ?array $u): array
{
    $motivo = s($a['motivo'] ?? '');
    if ($motivo === '') {
        return fail_r('Cuéntanos el motivo del reporte.', ['motivo' => 'Escribe el motivo.']);
    }
    if (slen($motivo) > 255) {
        return fail_r('El motivo no puede exceder 255 caracteres.', ['motivo' => 'Máximo 255 caracteres.']);
    }
    $idResena = to_int($a['id_resena'] ?? null) ?: null;
    $idRep = to_int($a['id_usuario_reportado'] ?? null) ?: null;
    if (($idResena === null) === ($idRep === null)) {
        return fail_r('El reporte debe apuntar a una reseña o a un usuario, no a ambos.');
    }
    if ($idResena !== null) {
        $autor = val('SELECT id_usuario FROM resena WHERE id_resena = ?', [$idResena]);
        if ($autor === null) {
            return fail_r('La reseña no existe.');
        }
        if ((int)$autor === $u['id_usuario']) {
            return fail_r('No puedes reportar tu propia reseña.');
        }
        $dup = val('SELECT 1 FROM reporte WHERE id_usuario_reporta = ? AND id_resena = ?', [$u['id_usuario'], $idResena]);
    } else {
        if ($idRep === $u['id_usuario']) {
            return fail_r('Un usuario no puede reportarse a sí mismo.');
        }
        if (val('SELECT 1 FROM usuario WHERE id_usuario = ?', [$idRep]) === null) {
            return fail_r('El usuario no existe.');
        }
        $dup = val('SELECT 1 FROM reporte WHERE id_usuario_reporta = ? AND id_usuario_reportado = ?', [$u['id_usuario'], $idRep]);
    }
    if ($dup !== null) {
        return fail_r('Ya enviaste un reporte sobre este contenido.');
    }
    try {
        q('INSERT INTO reporte (id_usuario_reporta, id_resena, id_usuario_reportado, motivo) VALUES (?, ?, ?, ?)',
            [$u['id_usuario'], $idResena, $idRep, $motivo]);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            return fail_r('Ya enviaste un reporte sobre este contenido.');
        }
        throw $e;
    }
    return ok_r();
}

/* ---------- moderación (administrador) ---------- */
function op_pendientes(array $a, ?array $u): array
{
    $rs = rows("SELECT r.id_resena, us.nombre_usuario, al.titulo, r.calificacion, r.comentario
                FROM resena r
                JOIN usuario us ON us.id_usuario = r.id_usuario
                JOIN album al ON al.id_album = r.id_album
                JOIN estado_resena e ON e.id_estado = r.id_estado
                WHERE e.nombre = 'Pendiente' ORDER BY r.id_resena");
    return data_r(array_map(fn($r) => ints($r, ['id_resena', 'calificacion']), $rs));
}

function op_moderar(array $a, ?array $u): array
{
    $estado = s($a['estado'] ?? '');
    if ($estado !== 'Aprobada' && $estado !== 'Rechazada') {
        return fail_r('Estado no válido.');
    }
    $id = to_int($a['id_resena'] ?? null);
    $r = $id === null ? null : row('SELECT us.nombre_usuario, al.titulo FROM resena r
                                    JOIN usuario us ON us.id_usuario = r.id_usuario
                                    JOIN album al ON al.id_album = r.id_album WHERE r.id_resena = ?', [$id]);
    if ($r === null) {
        return fail_r('La reseña no existe.');
    }
    q('UPDATE resena SET id_estado = (SELECT id_estado FROM estado_resena WHERE nombre = ?) WHERE id_resena = ?', [$estado, $id]);
    bitacora($u['id_usuario'], 'MODERACION', 'admin ' . ($estado === 'Aprobada' ? 'aprobó' : 'rechazó') .
        ' la reseña de ' . $r['nombre_usuario'] . ' sobre ' . $r['titulo']);
    return ok_r();
}

function op_reportesPendientes(array $a, ?array $u): array
{
    $rs = rows('SELECT rp.id_reporte, rp.id_resena, rp.id_usuario_reportado, rp.motivo,
                       up.nombre_usuario AS por, rs.comentario AS r_comentario, ral.titulo AS r_titulo,
                       rsu.nombre_usuario AS r_autor, ru.nombre_usuario AS reportado
                FROM reporte rp
                LEFT JOIN usuario up  ON up.id_usuario  = rp.id_usuario_reporta
                LEFT JOIN resena  rs  ON rs.id_resena   = rp.id_resena
                LEFT JOIN album   ral ON ral.id_album   = rs.id_album
                LEFT JOIN usuario rsu ON rsu.id_usuario = rs.id_usuario
                LEFT JOIN usuario ru  ON ru.id_usuario  = rp.id_usuario_reportado
                WHERE rp.atendido = 0 ORDER BY rp.id_reporte');
    $out = [];
    foreach ($rs as $r) {
        if ($r['id_resena'] !== null) {
            $contenido = 'Reseña de «' . $r['r_titulo'] . '» por ' . $r['r_autor'] .
                ($r['r_comentario'] !== null && $r['r_comentario'] !== '' ? ': “' . $r['r_comentario'] . '”' : '') . ' — ' . $r['motivo'];
        } else {
            $contenido = 'Perfil de ' . $r['reportado'] . ' — ' . $r['motivo'];
        }
        $out[] = [
            'id_reporte'           => (int)$r['id_reporte'],
            'por'                  => $r['por'] ?? '(cuenta eliminada)',
            'tipo'                 => $r['id_resena'] !== null ? 'Reseña' : 'Usuario',
            'contenido'            => $contenido,
            'id_resena'            => $r['id_resena'] === null ? null : (int)$r['id_resena'],
            'id_usuario_reportado' => $r['id_usuario_reportado'] === null ? null : (int)$r['id_usuario_reportado'],
        ];
    }
    return data_r($out);
}

function op_atenderReporte(array $a, ?array $u): array
{
    $id = to_int($a['id_reporte'] ?? null);
    $rep = $id === null ? null : row('SELECT id_reporte, id_resena, id_usuario_reportado FROM reporte WHERE id_reporte = ? AND atendido = 0', [$id]);
    if ($rep === null) {
        return fail_r('El reporte no existe o ya fue atendido.');
    }
    $accion = s($a['accion'] ?? '');
    if ($accion === 'eliminar') {
        if ($rep['id_resena'] === null) {
            return fail_r('Solo se puede eliminar una reseña reportada.');
        }
        q('DELETE FROM resena WHERE id_resena = ?', [(int)$rep['id_resena']]);   // el reporte cae en cascada
        bitacora($u['id_usuario'], 'RESENA_ELIMINADA', 'admin eliminó una reseña reportada');
    } elseif ($accion === 'suspender') {
        if ($rep['id_usuario_reportado'] === null) {
            return fail_r('Solo se puede suspender a un usuario reportado.');
        }
        $t = row('SELECT id_usuario, id_rol, nombre_usuario FROM usuario WHERE id_usuario = ?', [(int)$rep['id_usuario_reportado']]);
        if ((int)$t['id_rol'] === ROL_ADMIN) {
            return fail_r('No se puede suspender a un administrador.');
        }
        q('UPDATE usuario SET activo = 0 WHERE id_usuario = ?', [(int)$t['id_usuario']]);
        q('UPDATE reporte SET atendido = 1 WHERE id_reporte = ?', [$id]);
        bitacora($u['id_usuario'], 'CUENTA_SUSPENDIDA', 'admin suspendió la cuenta de ' . $t['nombre_usuario']);
    } elseif ($accion === 'descartar') {
        q('UPDATE reporte SET atendido = 1 WHERE id_reporte = ?', [$id]);
        bitacora($u['id_usuario'], 'REPORTE_DESCARTADO', 'admin descartó el reporte #' . $id);
    } else {
        return fail_r('Acción no válida.');
    }
    return ok_r();
}
