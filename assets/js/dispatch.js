/* =====================================================================
   AlbumMatch — dispatch.js
   Contrato de la API (referencia). Cada operación indica quién puede
   llamarla y qué devuelve. api/index.php (PHP) implementa EXACTAMENTE
   este mismo contrato; este archivo se usa en el modo demostración
   (GitHub Pages) y en el servidor de pruebas tests/mock_server.js.

   Petición:  POST  {"op": "nombre", "args": {...}}
   Respuesta: lecturas  -> {"ok":true, "data": ...}
              escrituras-> {"ok":true, ...extras}  |  {"ok":false,"error":"...","errors":{campo:"..."}}
   Estados:   401 {code:"auth"} sin sesión · 403 {code:"forbidden"} sin permiso · 404 operación desconocida
   Niveles:   public · any (con sesión) · user (rol Usuario) · admin
   El usuario que actúa SIEMPRE sale de la sesión, nunca de los argumentos.
   ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AlbumDispatch = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function create(store) {
    var C = store.consts;

    function pub(u) {
      return u ? { id_usuario: u.id_usuario, id_rol: u.id_rol, nombre_usuario: u.nombre_usuario, correo: u.correo,
        biografia: u.biografia, avatar_url: u.avatar_url, activo: u.activo } : null;
    }
    function num(v, d) { var n = Number(v); return isFinite(n) && v !== '' && v !== null ? n : d; }

    // s = sesión: { get(), set(id, remember), clear() }
    var OPS = {
      /* --- sesión --- */
      me:       { lvl: 'public', kind: 'r', run: function (a, u) { return pub(u); } },
      login:    { lvl: 'public', kind: 'w', run: function (a, u, s) {
        var r = store.login(a.correo, a.password);
        if (r.ok) { s.set(r.usuario.id_usuario, !!a.remember); r.usuario = pub(r.usuario); }
        return r;
      } },
      registrar: { lvl: 'public', kind: 'w', run: function (a, u, s) {
        var r = store.registrar(a);
        if (r.ok) { s.set(r.usuario.id_usuario, false); r.usuario = pub(r.usuario); }
        return r;
      } },
      logout:   { lvl: 'public', kind: 'w', run: function (a, u, s) { s.clear(); return { ok: true }; } },

      /* --- lecturas públicas --- */
      generos:        { lvl: 'public', kind: 'r', run: function () { return store.generos(); } },
      anios:          { lvl: 'public', kind: 'r', run: function () { return store.anios(); } },
      artistas:       { lvl: 'public', kind: 'r', run: function () { return store.artistas(); } },
      populares:      { lvl: 'public', kind: 'r', run: function (a) { return store.populares(num(a.n, 5)); } },
      mejorCalificados: { lvl: 'public', kind: 'r', run: function (a) { return store.mejorCalificados(num(a.n, 5)); } },
      buscar:         { lvl: 'public', kind: 'r', run: function (a) { return store.buscar({ q: a.q, id_genero: a.id_genero, anio: a.anio, minCal: a.minCal }); } },
      detalleAlbum:   { lvl: 'public', kind: 'r', run: function (a) { return store.detalleAlbum(num(a.id, 0)); } },
      detalleArtista: { lvl: 'public', kind: 'r', run: function (a) { return store.detalleArtista(num(a.id, 0)); } },
      acerca:         { lvl: 'public', kind: 'r', run: function () { return store.acerca(); } },

      /* --- usuario --- */
      generosFavoritos: { lvl: 'user', kind: 'r', run: function (a, u) {
        return store.generosFavoritos(u.id_usuario).map(function (id) { return store.genero(id); });
      } },
      actualizarPerfil: { lvl: 'user', kind: 'w', run: function (a, u) { return store.actualizarPerfil(u.id_usuario, a); } },
      recomendaciones:  { lvl: 'user', kind: 'r', run: function (a, u) { return store.recomendaciones(u.id_usuario); } },
      resenaDe:         { lvl: 'user', kind: 'r', run: function (a, u) { return store.resenaDe(u.id_usuario, num(a.id_album, 0)); } },
      guardarResena:    { lvl: 'user', kind: 'w', run: function (a, u) {
        return store.guardarResena({ id_usuario: u.id_usuario, id_album: num(a.id_album, 0), calificacion: a.calificacion, comentario: a.comentario });
      } },
      eliminarResena:   { lvl: 'any', kind: 'w', run: function (a, u) { return store.eliminarResena(num(a.id_resena, 0), u.id_usuario); } },
      misResenas:       { lvl: 'user', kind: 'r', run: function (a, u) { return store.misResenas(u.id_usuario); } },
      listas:           { lvl: 'user', kind: 'r', run: function (a, u) { return store.listas(u.id_usuario); } },
      crearLista:       { lvl: 'user', kind: 'w', run: function (a, u) { return store.crearLista(u.id_usuario, a.nombre, a.id_album ? num(a.id_album, 0) : null); } },
      renombrarLista:   { lvl: 'user', kind: 'w', run: function (a, u) { return store.renombrarLista(u.id_usuario, num(a.id_lista, 0), a.nombre); } },
      eliminarLista:    { lvl: 'user', kind: 'w', run: function (a, u) { return store.eliminarLista(u.id_usuario, num(a.id_lista, 0)); } },
      agregarALista:    { lvl: 'user', kind: 'w', run: function (a, u) { return store.agregarALista(u.id_usuario, num(a.id_lista, 0), num(a.id_album, 0)); } },
      quitarDeLista:    { lvl: 'user', kind: 'w', run: function (a, u) { return store.quitarDeLista(u.id_usuario, num(a.id_lista, 0), num(a.id_album, 0)); } },
      crearReporte:     { lvl: 'user', kind: 'w', run: function (a, u) {
        return store.crearReporte({ id_usuario_reporta: u.id_usuario, id_resena: a.id_resena ? num(a.id_resena, 0) : null,
          id_usuario_reportado: a.id_usuario_reportado ? num(a.id_usuario_reportado, 0) : null, motivo: a.motivo });
      } },

      /* --- administrador --- */
      topCalificados:   { lvl: 'admin', kind: 'r', run: function (a) { return store.topCalificados(num(a.n, 10)); } },
      kpis:             { lvl: 'admin', kind: 'r', run: function () { return store.kpis(); } },
      actividad:        { lvl: 'admin', kind: 'r', run: function (a) { return store.actividad(num(a.n, 5)); } },
      pendientes:       { lvl: 'admin', kind: 'r', run: function () { return store.pendientes(); } },
      reportesPendientes: { lvl: 'admin', kind: 'r', run: function () { return store.reportesPendientes(); } },
      usuarios:         { lvl: 'admin', kind: 'r', run: function () { return store.usuarios(); } },
      canciones:        { lvl: 'admin', kind: 'r', run: function (a) { return store.canciones(num(a.id_album, 0)); } },
      moderar:          { lvl: 'admin', kind: 'w', run: function (a, u) { return store.moderar(num(a.id_resena, 0), a.estado, u.id_usuario); } },
      atenderReporte:   { lvl: 'admin', kind: 'w', run: function (a, u) { return store.atenderReporte(num(a.id_reporte, 0), a.accion, u.id_usuario); } },
      setActivo:        { lvl: 'admin', kind: 'w', run: function (a, u) { return store.setActivo(num(a.id_usuario, 0), !!a.activo, u.id_usuario); } },
      agregarGenero:    { lvl: 'admin', kind: 'w', run: function (a, u) { return store.agregarGenero(u.id_usuario, a.nombre); } },
      renombrarGenero:  { lvl: 'admin', kind: 'w', run: function (a, u) { return store.renombrarGenero(u.id_usuario, num(a.id_genero, 0), a.nombre); } },
      eliminarGenero:   { lvl: 'admin', kind: 'w', run: function (a, u) { return store.eliminarGenero(u.id_usuario, num(a.id_genero, 0)); } },
      guardarArtista:   { lvl: 'admin', kind: 'w', run: function (a, u) { return store.guardarArtista(u.id_usuario, a); } },
      eliminarArtista:  { lvl: 'admin', kind: 'w', run: function (a, u) { return store.eliminarArtista(u.id_usuario, num(a.id_artista, 0)); } },
      guardarAlbum:     { lvl: 'admin', kind: 'w', run: function (a, u) { return store.guardarAlbum(u.id_usuario, a); } },
      eliminarAlbum:    { lvl: 'admin', kind: 'w', run: function (a, u) { return store.eliminarAlbum(u.id_usuario, num(a.id_album, 0)); } },
      guardarCancion:   { lvl: 'admin', kind: 'w', run: function (a, u) { return store.guardarCancion(u.id_usuario, a); } },
      eliminarCancion:  { lvl: 'admin', kind: 'w', run: function (a, u) { return store.eliminarCancion(u.id_usuario, num(a.id_cancion, 0)); } }
    };

    function dispatch(op, args, s) {
      var d = Object.prototype.hasOwnProperty.call(OPS, op) ? OPS[op] : null;
      if (!d) return { status: 404, body: { ok: false, error: 'Operación desconocida.', errors: {} } };
      args = args && typeof args === 'object' && !Array.isArray(args) ? args : {};
      var id = s.get(), u = id ? store.usuario(id) : null;
      if (u && !u.activo) { s.clear(); u = null; }
      if (d.lvl !== 'public') {
        if (!u) return { status: 401, body: { ok: false, error: 'Inicia sesión para continuar.', code: 'auth', errors: {} } };
        if ((d.lvl === 'user' && u.id_rol !== C.ROL_USUARIO) || (d.lvl === 'admin' && u.id_rol !== C.ROL_ADMIN)) {
          return { status: 403, body: { ok: false, error: 'No tienes permisos para esta acción.', code: 'forbidden', errors: {} } };
        }
      }
      var r = d.run(args, u, s);
      return { status: 200, body: d.kind === 'r' ? { ok: true, data: r } : r };
    }
    return { dispatch: dispatch, ops: OPS };
  }
  return { create: create };
});
