<?php
/* Listas de álbumes de cada usuario. */

const TIPO_PERSONALIZADA = 4;
const CAT_COLS_C = 'c.id_album, c.titulo, c.anio_lanzamiento, c.portada_hue, c.id_artista, c.artista, c.id_genero, c.genero, c.promedio, c.total_resenas';

function lista_propia(int $uid, ?int $idLista): ?array
{
    if ($idLista === null) {
        return null;
    }
    return row('SELECT id_lista, id_usuario, id_tipo, nombre FROM lista WHERE id_lista = ? AND id_usuario = ?', [$idLista, $uid]);
}

function nombre_lista_error(int $uid, string $nombre, int $exceptId): ?string
{
    if ($nombre === '') {
        return 'Ponle un nombre a la lista.';
    }
    if (slen($nombre) > 60) {
        return 'Máximo 60 caracteres.';
    }
    if (val('SELECT 1 FROM lista WHERE id_usuario = ? AND nombre = ? AND id_lista <> ?', [$uid, $nombre, $exceptId]) !== null) {
        return 'Ya tienes una lista con ese nombre.';
    }
    return null;
}

function op_listas(array $a, ?array $u): array
{
    $uid = $u['id_usuario'];
    $ls = rows('SELECT id_lista, nombre, id_tipo FROM lista WHERE id_usuario = ? ORDER BY id_lista', [$uid]);
    $items = rows('SELECT la.id_lista, ' . CAT_COLS_C . '
                   FROM lista_album la JOIN v_catalogo c ON c.id_album = la.id_album
                   WHERE la.id_lista IN (SELECT id_lista FROM lista WHERE id_usuario = ?)
                   ORDER BY la.fecha_agregado, c.id_album', [$uid]);
    $by = [];
    foreach ($items as $it) {
        $by[(int)$it['id_lista']][] = album_row($it);
    }
    $out = [];
    foreach ($ls as $l) {
        $out[] = [
            'id_lista'       => (int)$l['id_lista'],
            'nombre'         => $l['nombre'],
            'id_tipo'        => (int)$l['id_tipo'],
            'predeterminada' => (int)$l['id_tipo'] !== TIPO_PERSONALIZADA,
            'albumes'        => $by[(int)$l['id_lista']] ?? [],
        ];
    }
    return data_r($out);
}

function op_crearLista(array $a, ?array $u): array
{
    $uid = $u['id_usuario'];
    $nombre = s($a['nombre'] ?? '');
    $err = nombre_lista_error($uid, $nombre, 0);
    if ($err !== null) {
        return fail_r($err, ['nombre' => $err]);
    }
    $idAlbum = to_int($a['id_album'] ?? null) ?: null;
    $pdo = db();
    $pdo->beginTransaction();
    try {
        q('INSERT INTO lista (id_usuario, id_tipo, nombre) VALUES (?, ?, ?)', [$uid, TIPO_PERSONALIZADA, $nombre]);
        $id = last_id();
        if ($idAlbum !== null) {
            q('INSERT INTO lista_album (id_lista, id_album) SELECT ?, id_album FROM album WHERE id_album = ?', [$id, $idAlbum]);
        }
        $pdo->commit();
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        if ($e->getCode() === '23000') {
            return fail_r('Ya tienes una lista con ese nombre.', ['nombre' => 'Ya tienes una lista con ese nombre.']);
        }
        throw $e;
    }
    return ok_r(['lista' => ['id_lista' => $id, 'id_usuario' => $uid, 'id_tipo' => TIPO_PERSONALIZADA, 'nombre' => $nombre]]);
}

function op_renombrarLista(array $a, ?array $u): array
{
    $uid = $u['id_usuario'];
    $l = lista_propia($uid, to_int($a['id_lista'] ?? null));
    if ($l === null) {
        return fail_r('La lista no existe.');
    }
    if ((int)$l['id_tipo'] !== TIPO_PERSONALIZADA) {
        return fail_r('Las listas predeterminadas no se pueden renombrar.');
    }
    $nombre = s($a['nombre'] ?? '');
    $err = nombre_lista_error($uid, $nombre, (int)$l['id_lista']);
    if ($err !== null) {
        return fail_r($err, ['nombre' => $err]);
    }
    q('UPDATE lista SET nombre = ? WHERE id_lista = ?', [$nombre, (int)$l['id_lista']]);
    return ok_r();
}

function op_eliminarLista(array $a, ?array $u): array
{
    $l = lista_propia($u['id_usuario'], to_int($a['id_lista'] ?? null));
    if ($l === null) {
        return fail_r('La lista no existe.');
    }
    if ((int)$l['id_tipo'] !== TIPO_PERSONALIZADA) {
        return fail_r('Las listas predeterminadas no se pueden eliminar.');
    }
    q('DELETE FROM lista WHERE id_lista = ?', [(int)$l['id_lista']]);   // lista_album cae en cascada
    return ok_r();
}

function op_agregarALista(array $a, ?array $u): array
{
    $l = lista_propia($u['id_usuario'], to_int($a['id_lista'] ?? null));
    if ($l === null) {
        return fail_r('La lista no existe.');
    }
    $idAlbum = to_int($a['id_album'] ?? null);
    if ($idAlbum === null || val('SELECT 1 FROM album WHERE id_album = ?', [$idAlbum]) === null) {
        return fail_r('El álbum no existe.');
    }
    if (val('SELECT 1 FROM lista_album WHERE id_lista = ? AND id_album = ?', [(int)$l['id_lista'], $idAlbum]) !== null) {
        return fail_r('Ese álbum ya está en la lista.');
    }
    q('INSERT INTO lista_album (id_lista, id_album) VALUES (?, ?)', [(int)$l['id_lista'], $idAlbum]);
    return ok_r(['lista' => ['id_lista' => (int)$l['id_lista'], 'nombre' => $l['nombre']]]);
}

function op_quitarDeLista(array $a, ?array $u): array
{
    $l = lista_propia($u['id_usuario'], to_int($a['id_lista'] ?? null));
    if ($l === null) {
        return fail_r('La lista no existe.');
    }
    $idAlbum = to_int($a['id_album'] ?? null);
    if ($idAlbum !== null) {
        q('DELETE FROM lista_album WHERE id_lista = ? AND id_album = ?', [(int)$l['id_lista'], $idAlbum]);
    }
    return ok_r();
}
