<?php
/* Tabla de operaciones: nombre => [nivel de acceso, función].
   Niveles: public · any (con sesión) · user (rol Usuario) · admin.
   Debe coincidir con assets/js/dispatch.js (el contrato de referencia). */

function ops_table(): array
{
    return [
        // sesión
        'me'        => ['public', 'op_me'],
        'login'     => ['public', 'op_login'],
        'registrar' => ['public', 'op_registrar'],
        'logout'    => ['public', 'op_logout'],
        // lecturas públicas
        'generos'          => ['public', 'op_generos'],
        'anios'            => ['public', 'op_anios'],
        'artistas'         => ['public', 'op_artistas'],
        'populares'        => ['public', 'op_populares'],
        'mejorCalificados' => ['public', 'op_mejorCalificados'],
        'buscar'           => ['public', 'op_buscar'],
        'detalleAlbum'     => ['public', 'op_detalleAlbum'],
        'detalleArtista'   => ['public', 'op_detalleArtista'],
        'acerca'           => ['public', 'op_acerca'],
        // usuario
        'generosFavoritos' => ['user', 'op_generosFavoritos'],
        'actualizarPerfil' => ['user', 'op_actualizarPerfil'],
        'recomendaciones'  => ['user', 'op_recomendaciones'],
        'resenaDe'         => ['user', 'op_resenaDe'],
        'guardarResena'    => ['user', 'op_guardarResena'],
        'eliminarResena'   => ['any', 'op_eliminarResena'],
        'misResenas'       => ['user', 'op_misResenas'],
        'listas'           => ['user', 'op_listas'],
        'crearLista'       => ['user', 'op_crearLista'],
        'renombrarLista'   => ['user', 'op_renombrarLista'],
        'eliminarLista'    => ['user', 'op_eliminarLista'],
        'agregarALista'    => ['user', 'op_agregarALista'],
        'quitarDeLista'    => ['user', 'op_quitarDeLista'],
        'crearReporte'     => ['user', 'op_crearReporte'],
        // administrador
        'topCalificados'     => ['admin', 'op_topCalificados'],
        'kpis'               => ['admin', 'op_kpis'],
        'actividad'          => ['admin', 'op_actividad'],
        'pendientes'         => ['admin', 'op_pendientes'],
        'reportesPendientes' => ['admin', 'op_reportesPendientes'],
        'usuarios'           => ['admin', 'op_usuarios'],
        'canciones'          => ['admin', 'op_canciones'],
        'moderar'            => ['admin', 'op_moderar'],
        'atenderReporte'     => ['admin', 'op_atenderReporte'],
        'setActivo'          => ['admin', 'op_setActivo'],
        'agregarGenero'      => ['admin', 'op_agregarGenero'],
        'renombrarGenero'    => ['admin', 'op_renombrarGenero'],
        'eliminarGenero'     => ['admin', 'op_eliminarGenero'],
        'guardarArtista'     => ['admin', 'op_guardarArtista'],
        'eliminarArtista'    => ['admin', 'op_eliminarArtista'],
        'guardarAlbum'       => ['admin', 'op_guardarAlbum'],
        'eliminarAlbum'      => ['admin', 'op_eliminarAlbum'],
        'guardarCancion'     => ['admin', 'op_guardarCancion'],
        'eliminarCancion'    => ['admin', 'op_eliminarCancion'],
    ];
}
