<?php
/* Lecturas públicas: catálogo, detalle de álbum y de artista. */

const CAT_COLS = 'id_album, titulo, anio_lanzamiento, portada_hue, id_artista, artista, id_genero, genero, promedio, total_resenas';

function album_row(array $r): array
{
    return [
        'id_album'         => (int)$r['id_album'],
        'titulo'           => $r['titulo'],
        'anio_lanzamiento' => (int)$r['anio_lanzamiento'],
        'portada_hue'      => (int)$r['portada_hue'],
        'id_artista'       => (int)$r['id_artista'],
        'artista'          => $r['artista'],
        'id_genero'        => (int)$r['id_genero'],
        'genero'           => $r['genero'],
        'promedio'         => $r['promedio'] === null ? null : (float)$r['promedio'],
        'total_resenas'    => (int)$r['total_resenas'],
    ];
}
function album_rows(array $rs): array
{
    return array_map('album_row', $rs);
}
/** Límite entero acotado para los LIMIT (se inserta ya validado, no como parámetro). */
function lim($v, int $default, int $max = 50): int
{
    $n = to_int($v);
    if ($n === null || $n < 1) {
        return $default;
    }
    return min($n, $max);
}

function op_generos(array $a, ?array $u): array
{
    return data_r(array_map(fn($r) => ints($r, ['id_genero']), rows('SELECT id_genero, nombre FROM genero ORDER BY nombre')));
}

function op_anios(array $a, ?array $u): array
{
    return data_r(array_map('intval', array_column(rows('SELECT DISTINCT anio_lanzamiento FROM album ORDER BY anio_lanzamiento DESC'), 'anio_lanzamiento')));
}

function artistas_lista(): array
{
    $rs = rows('SELECT a.id_artista, a.nombre, a.id_genero, g.nombre AS genero, a.pais, a.biografia
                FROM artista a JOIN genero g ON g.id_genero = a.id_genero ORDER BY a.nombre');
    return array_map(fn($r) => ints($r, ['id_artista', 'id_genero']), $rs);
}
function op_artistas(array $a, ?array $u): array
{
    return data_r(artistas_lista());
}

function op_populares(array $a, ?array $u): array
{
    $n = lim($a['n'] ?? null, 5);
    return data_r(album_rows(rows('SELECT ' . CAT_COLS . ' FROM v_catalogo
        ORDER BY total_resenas DESC, (promedio IS NULL), promedio DESC, id_album LIMIT ' . $n)));
}

function op_mejorCalificados(array $a, ?array $u): array
{
    $n = lim($a['n'] ?? null, 5);
    return data_r(album_rows(rows('SELECT ' . CAT_COLS . ' FROM v_catalogo WHERE total_resenas > 0
        ORDER BY promedio DESC, total_resenas DESC, id_album LIMIT ' . $n)));
}

function op_buscar(array $a, ?array $u): array
{
    $where = [];
    $p = [];
    $txt = s($a['q'] ?? '');
    if ($txt !== '') {
        $like = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $txt) . '%';
        $where[] = '(titulo LIKE ? OR artista LIKE ?)';
        $p[] = $like;
        $p[] = $like;
    }
    $g = to_int($a['id_genero'] ?? null);
    if ($g !== null && $g > 0) {
        $where[] = 'id_genero = ?';
        $p[] = $g;
    }
    $y = to_int($a['anio'] ?? null);
    if ($y !== null && $y > 0) {
        $where[] = 'anio_lanzamiento = ?';
        $p[] = $y;
    }
    $m = to_int($a['minCal'] ?? null);
    if ($m !== null && $m > 0) {
        $where[] = 'promedio >= ?';     // un promedio NULL nunca cumple
        $p[] = $m;
    }
    $sql = 'SELECT ' . CAT_COLS . ' FROM v_catalogo' . ($where ? ' WHERE ' . implode(' AND ', $where) : '') . ' ORDER BY id_album';
    return data_r(album_rows(rows($sql, $p)));
}

function op_detalleAlbum(array $a, ?array $u): array
{
    $id = to_int($a['id'] ?? null);
    if ($id === null) {
        return data_r(null);
    }
    $al = row('SELECT ' . CAT_COLS . ' FROM v_catalogo WHERE id_album = ?', [$id]);
    if ($al === null) {
        return data_r(null);
    }
    $can = rows('SELECT id_cancion, id_album, numero_pista, titulo, duracion_seg, es_sencillo
                 FROM cancion WHERE id_album = ? ORDER BY numero_pista', [$id]);
    $res = rows("SELECT r.id_resena, r.id_usuario, u.nombre_usuario, r.calificacion, r.comentario, r.fecha_publicacion
                 FROM resena r
                 JOIN usuario u ON u.id_usuario = r.id_usuario
                 JOIN estado_resena e ON e.id_estado = r.id_estado
                 WHERE r.id_album = ? AND e.nombre = 'Aprobada'
                 ORDER BY r.fecha_publicacion DESC, r.id_resena DESC", [$id]);
    return data_r([
        'album'     => album_row($al),
        'canciones' => array_map(fn($r) => ints($r, ['id_cancion', 'id_album', 'numero_pista', 'duracion_seg', 'es_sencillo']), $can),
        'resenas'   => array_map(fn($r) => ints($r, ['id_resena', 'id_usuario', 'calificacion']), $res),
    ]);
}

function op_detalleArtista(array $a, ?array $u): array
{
    $id = to_int($a['id'] ?? null);
    if ($id === null) {
        return data_r(null);
    }
    $ar = row('SELECT a.id_artista, a.nombre, a.pais, a.biografia, a.id_genero, g.nombre AS genero
               FROM artista a JOIN genero g ON g.id_genero = a.id_genero WHERE a.id_artista = ?', [$id]);
    if ($ar === null) {
        return data_r(null);
    }
    $albs = rows('SELECT ' . CAT_COLS . ' FROM v_catalogo WHERE id_artista = ? ORDER BY anio_lanzamiento DESC, id_album DESC', [$id]);
    return data_r(['artista' => ints($ar, ['id_artista', 'id_genero']), 'albumes' => album_rows($albs)]);
}

function op_acerca(array $a, ?array $u): array
{
    return data_r([
        'albumes'  => (int)val('SELECT COUNT(*) FROM album'),
        'usuarios' => (int)val('SELECT COUNT(*) FROM usuario WHERE activo = 1'),
    ]);
}
