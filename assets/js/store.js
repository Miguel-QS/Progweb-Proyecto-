/* =====================================================================
   AlbumMatch — store.js
   Modelo de datos en memoria que refleja las 14 tablas y 2 vistas de
   database/albummatch.sql (mismos ids, mismos datos de ejemplo y mismas
   reglas de integridad). No toca el DOM: se puede probar con Node.
   En la Fase 3 cada método se reemplaza por una consulta PHP + MySQL.
   ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AlbumStore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ROL_USUARIO = 1, ROL_ADMIN = 2;
  var EST_PENDIENTE = 1, EST_APROBADA = 2, EST_RECHAZADA = 3;
  var TIPO_PERSONALIZADA = 4;
  var DEMO_PASSWORD = 'AlbumMatch2026!';
  var LISTAS_BASE = [[1, 'Quiero escuchar'], [2, 'Favoritos'], [3, 'Historial de escuchados']];

  /* ---------- utilidades ---------- */
  // Hash de DEMOSTRACIÓN (no es seguro). En PHP se usa password_hash / password_verify.
  function hashPassword(p) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0; i < p.length; i++) {
      var ch = p.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 'demo$' + (h2 >>> 0).toString(16) + (h1 >>> 0).toString(16);
  }
  // Comparación sin mayúsculas ni acentos (como utf8mb4_unicode_ci)
  function norm(s) {
    return String(s == null ? '' : s).trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function nowStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' +
      pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }
  function fail(error, errors) { return { ok: false, error: error, errors: errors || {} }; }
  function okr(extra) {
    var r = { ok: true };
    for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) r[k] = extra[k];
    return r;
  }
  function numDescNullLast(x, y) {
    if (x === y) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    return y - x;
  }
  function isInt(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n; }

  /* ---------- datos de ejemplo (idénticos a los INSERT del .sql) ---------- */
  function seed() {
    var H = hashPassword(DEMO_PASSWORD);
    var bioMarina = 'Coleccionista de vinilos y buscadora incansable de bandas nuevas. Si suena a guitarras saturadas o sintetizadores nostálgicos, ya lo escuché tres veces.';
    var bioCinder = 'Dúo formado en 2016, conocido por mezclar guitarras saturadas con arreglos electrónicos escasos. Sus letras giran en torno a la memoria y los paisajes industriales.';
    function al(id, ar, g, t, y, h) {
      return { id_album: id, id_artista: ar, id_genero: g, titulo: t, anio_lanzamiento: y, portada_hue: h, fecha_registro: '2025-06-15 10:00:00' };
    }
    function us(id, rol, n, c, bio, f) {
      return { id_usuario: id, id_rol: rol, nombre_usuario: n, correo: c, contrasena_hash: H, biografia: bio, avatar_url: null, activo: 1, fecha_registro: f };
    }
    function rs(id, u, a, e, c, txt, f) {
      return { id_resena: id, id_usuario: u, id_album: a, id_estado: e, calificacion: c, comentario: txt, fecha_publicacion: f, fecha_edicion: null };
    }
    return {
      v: 1,
      generos: [[1, 'Rock alternativo'], [2, 'Pop'], [3, 'Indie / Folk'], [4, 'Electrónica'], [5, 'Latin Pop'], [6, 'Indie Pop'], [7, 'Folk']]
        .map(function (g) { return { id_genero: g[0], nombre: g[1] }; }),
      usuarios: [
        us(1, 2, 'admin', 'admin@albummatch.com', null, '2025-06-01 09:00:00'),
        us(2, 1, 'marina_ibarra', 'marina@ejemplo.com', bioMarina, '2025-06-20 12:00:00'),
        us(3, 1, 'valeria_m', 'valeria@ejemplo.com', null, '2025-07-01 12:00:00'),
        us(4, 1, 'danielrx', 'daniel@ejemplo.com', null, '2025-07-01 12:00:00'),
        us(5, 1, 'mica.wave', 'mica@ejemplo.com', null, '2025-07-01 12:00:00'),
        us(6, 1, 'UsuarioX', 'usuariox@ejemplo.com', null, '2025-10-01 12:00:00'),
        us(7, 1, 'UsuarioY', 'usuarioy@ejemplo.com', null, '2025-10-01 12:00:00')
      ],
      usuario_genero: [{ id_usuario: 2, id_genero: 1 }, { id_usuario: 2, id_genero: 3 }, { id_usuario: 2, id_genero: 4 }],
      artistas: [
        { id_artista: 1, id_genero: 1, nombre: 'Cinder & Static', pais: 'México', biografia: bioCinder },
        { id_artista: 2, id_genero: 2, nombre: 'Nadia Cole', pais: 'Estados Unidos', biografia: null },
        { id_artista: 3, id_genero: 1, nombre: 'The Low Orbit', pais: 'Reino Unido', biografia: null },
        { id_artista: 4, id_genero: 3, nombre: 'Wren Auer', pais: 'Canadá', biografia: null },
        { id_artista: 5, id_genero: 4, nombre: 'Glass Foundry', pais: 'Alemania', biografia: null },
        { id_artista: 6, id_genero: 5, nombre: 'Marisol Vega', pais: 'Colombia', biografia: null },
        { id_artista: 7, id_genero: 1, nombre: 'Night Ledger', pais: null, biografia: null },
        { id_artista: 8, id_genero: 6, nombre: 'Kite Season', pais: null, biografia: null },
        { id_artista: 9, id_genero: 7, nombre: 'Rosalind Marsh', pais: null, biografia: null },
        { id_artista: 10, id_genero: 4, nombre: 'The Quiet Machine', pais: null, biografia: null }
      ],
      albumes: [
        al(1, 1, 1, 'Reverb Ash', 2024, 262), al(2, 2, 2, 'Skyline Static', 2023, 335),
        al(3, 3, 1, 'Halide', 2022, 200), al(4, 4, 3, 'Paper Weather', 2021, 28),
        al(5, 5, 4, 'Tectonic', 2024, 190), al(6, 6, 5, 'Ceniza', 2023, 355),
        al(7, 7, 1, 'Afterglow Freight', 2020, 250), al(8, 8, 6, 'Static Bloom', 2022, 300),
        al(9, 9, 7, 'Salt Year', 2019, 40), al(10, 10, 4, 'Wavelength', 2021, 210),
        al(11, 1, 1, 'Low Tide Radio', 2019, 262), al(12, 6, 5, 'Nocturno', 2020, 355),
        al(13, 4, 3, 'Amber Hours', 2018, 28), al(14, 3, 1, 'Fault Lines', 2025, 200),
        al(15, 5, 4, 'Analog Ghost', 2020, 190), al(16, 1, 1, 'First Static', 2016, 262),
        al(17, 1, 1, 'Ember Line', 2018, 262)
      ],
      canciones: [
        { id_cancion: 1, id_album: 1, numero_pista: 1, titulo: 'Vidrio y ceniza', duracion_seg: 222, es_sencillo: 0 },
        { id_cancion: 2, id_album: 1, numero_pista: 2, titulo: 'Reverb Ash', duracion_seg: 245, es_sencillo: 0 },
        { id_cancion: 3, id_album: 1, numero_pista: 3, titulo: 'Cuarto oscuro', duracion_seg: 178, es_sencillo: 1 },
        { id_cancion: 4, id_album: 1, numero_pista: 4, titulo: 'Marea baja', duracion_seg: 201, es_sencillo: 0 },
        { id_cancion: 5, id_album: 1, numero_pista: 5, titulo: 'Última señal', duracion_seg: 277, es_sencillo: 0 }
      ],
      resenas: [
        rs(1, 3, 1, 2, 5, 'Cada canción se siente producida con cuidado. El sencillo tres es mi favorito, muy recomendado.', '2025-10-20 18:30:00'),
        rs(2, 4, 1, 2, 4, 'Buen trabajo en general, aunque algunas canciones no terminan de arrancar. Aun así vale la pena.', '2025-10-22 21:10:00'),
        rs(3, 5, 1, 2, 3, 'Propuesta interesante, pero no todas las pistas lograron captar mi atención por completo.', '2025-10-23 09:45:00'),
        rs(4, 2, 1, 2, 4, 'Excelente álbum, cada canción se siente cuidada.', '2025-10-25 20:00:00'),
        rs(5, 2, 9, 2, 5, 'Un disco redondo, sin canciones de relleno.', '2025-09-15 19:20:00'),
        rs(6, 2, 4, 2, 4, 'Propuesta interesante, aunque algo repetitiva.', '2025-08-01 17:05:00'),
        rs(7, 6, 3, 1, 1, 'Esta reseña contiene lenguaje inapropiado.', '2025-10-28 15:00:00'),
        rs(8, 7, 8, 1, 1, 'Comentario spam irrelevante.', '2025-10-28 15:30:00')
      ],
      reportes: [
        { id_reporte: 1, id_usuario_reporta: 1, id_resena: null, id_usuario_reportado: 7, motivo: 'Comportamiento nocivo reiterado.', fecha_reporte: '2025-10-29 10:00:00', atendido: 0 }
      ],
      listas: [
        { id_lista: 1, id_usuario: 2, id_tipo: 1, nombre: 'Quiero escuchar', fecha_creacion: '2025-06-20 12:05:00' },
        { id_lista: 2, id_usuario: 2, id_tipo: 2, nombre: 'Favoritos', fecha_creacion: '2025-06-20 12:05:00' },
        { id_lista: 3, id_usuario: 2, id_tipo: 3, nombre: 'Historial de escuchados', fecha_creacion: '2025-06-20 12:05:00' },
        { id_lista: 4, id_usuario: 2, id_tipo: 4, nombre: 'Mis favoritos del año', fecha_creacion: '2025-06-21 18:00:00' }
      ],
      lista_album: [[1, 3], [1, 5], [1, 10], [2, 2], [2, 6], [2, 9], [3, 1], [3, 7], [3, 8], [4, 4], [4, 11], [4, 14]]
        .map(function (p) { return { id_lista: p[0], id_album: p[1], fecha_agregado: '2025-09-01 20:00:00' }; }),
      bitacora: [
        { id_bitacora: 1, id_usuario: 3, accion: 'RESENA_PUBLICADA', detalle: 'valeria_m reseñó el álbum Reverb Ash', fecha: '2025-10-20 18:30:00' },
        { id_bitacora: 2, id_usuario: 4, accion: 'RESENA_PUBLICADA', detalle: 'danielrx calificó Reverb Ash con 4 estrellas', fecha: '2025-10-22 21:10:00' },
        { id_bitacora: 3, id_usuario: 1, accion: 'ALTA_ALBUM', detalle: 'admin añadió el álbum Fault Lines', fecha: '2025-06-15 10:00:00' }
      ],
      seq: { usuario: 8, artista: 11, album: 18, cancion: 6, resena: 9, reporte: 2, lista: 5, genero: 8, bitacora: 4 }
    };
  }

  /* ---------- fábrica del store ---------- */
  function create(initial) {
    var db = initial || seed();
    var S = { onChange: null };

    function commit(r) { if (r.ok && S.onChange) S.onChange(); return r; }
    function next(k) { return db.seq[k]++; }
    function find(arr, key, val) {
      for (var i = 0; i < arr.length; i++) if (arr[i][key] === val) return arr[i];
      return null;
    }
    function log(idUsuario, accion, detalle) {
      db.bitacora.push({ id_bitacora: next('bitacora'), id_usuario: idUsuario, accion: accion, detalle: detalle, fecha: nowStr() });
    }
    function isAdminId(id) { var u = find(db.usuarios, 'id_usuario', id); return !!(u && u.activo && u.id_rol === ROL_ADMIN); }
    function needAdmin(id) { return isAdminId(id) ? null : fail('Solo un administrador puede realizar esta acción.'); }

    S.export = function () { return JSON.stringify(db); };
    S.load = function (o) { db = o; };
    S.reset = function () { db = seed(); if (S.onChange) S.onChange(); };
    S.consts = { ROL_USUARIO: ROL_USUARIO, ROL_ADMIN: ROL_ADMIN, EST_PENDIENTE: EST_PENDIENTE, EST_APROBADA: EST_APROBADA, EST_RECHAZADA: EST_RECHAZADA, DEMO_PASSWORD: DEMO_PASSWORD };

    /* ----- lecturas simples ----- */
    S.usuario = function (id) { return find(db.usuarios, 'id_usuario', id); };
    S.genero = function (id) { return find(db.generos, 'id_genero', id); };
    S.generos = function () { return db.generos.slice().sort(function (a, b) { return norm(a.nombre) < norm(b.nombre) ? -1 : 1; }); };
    S.anios = function () {
      var seen = {};
      db.albumes.forEach(function (a) { seen[a.anio_lanzamiento] = true; });
      return Object.keys(seen).map(Number).sort(function (a, b) { return b - a; });
    };
    S.artistas = function () {
      return db.artistas.map(function (a) {
        return { id_artista: a.id_artista, nombre: a.nombre, id_genero: a.id_genero, genero: S.genero(a.id_genero).nombre, pais: a.pais, biografia: a.biografia };
      }).sort(function (a, b) { return norm(a.nombre) < norm(b.nombre) ? -1 : 1; });
    };

    /* ----- vistas v_album_calificacion / v_catalogo ----- */
    S.rating = function (idAlbum) {
      var sum = 0, n = 0;
      db.resenas.forEach(function (r) {
        if (r.id_album === idAlbum && r.id_estado === EST_APROBADA) { sum += r.calificacion; n++; }
      });
      return { promedio: n ? Math.round((sum / n + 1e-9) * 10) / 10 : null, total: n };
    };
    function viewRow(al) {
      var ar = find(db.artistas, 'id_artista', al.id_artista), g = S.genero(al.id_genero), c = S.rating(al.id_album);
      return { id_album: al.id_album, titulo: al.titulo, anio_lanzamiento: al.anio_lanzamiento, portada_hue: al.portada_hue,
        id_artista: ar.id_artista, artista: ar.nombre, id_genero: g.id_genero, genero: g.nombre, promedio: c.promedio, total_resenas: c.total };
    }
    S.catalogo = function () {
      return db.albumes.map(viewRow).sort(function (a, b) { return a.id_album - b.id_album; });
    };
    S.buscar = function (f) {
      f = f || {};
      var q = norm(f.q || '');
      return S.catalogo().filter(function (a) {
        if (q && norm(a.titulo).indexOf(q) < 0 && norm(a.artista).indexOf(q) < 0) return false;
        if (f.id_genero && a.id_genero !== Number(f.id_genero)) return false;
        if (f.anio && a.anio_lanzamiento !== Number(f.anio)) return false;
        if (f.minCal && !(a.promedio !== null && a.promedio >= Number(f.minCal))) return false;
        return true;
      });
    };
    S.populares = function (n) {
      return S.catalogo().sort(function (a, b) {
        return (b.total_resenas - a.total_resenas) || numDescNullLast(a.promedio, b.promedio) || (a.id_album - b.id_album);
      }).slice(0, n || 5);
    };
    S.mejorCalificados = function (n) {
      return S.catalogo().filter(function (a) { return a.total_resenas > 0; }).sort(function (a, b) {
        return numDescNullLast(a.promedio, b.promedio) || (b.total_resenas - a.total_resenas) || (a.id_album - b.id_album);
      }).slice(0, n || 5);
    };
    S.topCalificados = function (n) {
      return S.catalogo().sort(function (a, b) {
        return (b.total_resenas - a.total_resenas) || (a.id_album - b.id_album);
      }).slice(0, n || 10);
    };
    S.recomendaciones = function (idUsuario) {
      var favs = db.usuario_genero.filter(function (x) { return x.id_usuario === idUsuario; }).map(function (x) { return x.id_genero; });
      var vistos = db.resenas.filter(function (r) { return r.id_usuario === idUsuario; }).map(function (r) { return r.id_album; });
      var lista = S.catalogo().filter(function (a) { return favs.indexOf(a.id_genero) >= 0 && vistos.indexOf(a.id_album) < 0; })
        .sort(function (a, b) { return numDescNullLast(a.promedio, b.promedio) || (a.id_album - b.id_album); }).slice(0, 10);
      return { generos: favs.map(function (id) { return S.genero(id).nombre; }), albumes: lista };
    };

    /* ----- detalle de álbum y de artista ----- */
    S.canciones = function (idAlbum) {
      return db.canciones.filter(function (c) { return c.id_album === idAlbum; })
        .sort(function (a, b) { return a.numero_pista - b.numero_pista; });
    };
    S.detalleAlbum = function (id) {
      var al = find(db.albumes, 'id_album', id);
      if (!al) return null;
      var resenas = db.resenas.filter(function (r) { return r.id_album === id && r.id_estado === EST_APROBADA; })
        .sort(function (a, b) { return a.fecha_publicacion < b.fecha_publicacion ? 1 : -1; })
        .map(function (r) {
          var u = S.usuario(r.id_usuario);
          return { id_resena: r.id_resena, id_usuario: r.id_usuario, nombre_usuario: u ? u.nombre_usuario : '—', calificacion: r.calificacion, comentario: r.comentario, fecha_publicacion: r.fecha_publicacion };
        });
      return { album: viewRow(al), canciones: S.canciones(id), resenas: resenas };
    };
    S.detalleArtista = function (id) {
      var ar = find(db.artistas, 'id_artista', id);
      if (!ar) return null;
      var albumes = db.albumes.filter(function (a) { return a.id_artista === id; }).map(viewRow)
        .sort(function (a, b) { return (b.anio_lanzamiento - a.anio_lanzamiento) || (b.id_album - a.id_album); });
      return { artista: { id_artista: ar.id_artista, nombre: ar.nombre, pais: ar.pais, biografia: ar.biografia, id_genero: ar.id_genero, genero: S.genero(ar.id_genero).nombre }, albumes: albumes };
    };
    S.acerca = function () {
      return { albumes: db.albumes.length, usuarios: db.usuarios.filter(function (u) { return u.activo; }).length };
    };

    /* ----- autenticación ----- */
    S.login = function (correo, password) {
      var errors = {};
      if (!String(correo || '').trim()) errors.correo = 'Ingresa tu correo electrónico.';
      if (!password) errors.password = 'Ingresa tu contraseña.';
      if (Object.keys(errors).length) return fail('Revisa los campos marcados.', errors);
      var u = db.usuarios.filter(function (x) { return norm(x.correo) === norm(correo); })[0];
      if (!u || u.contrasena_hash !== hashPassword(password)) return fail('Correo o contraseña incorrectos.', { general: 'Correo o contraseña incorrectos.' });
      if (!u.activo) return fail('Tu cuenta está suspendida. Contacta al equipo de soporte.', { general: 'Tu cuenta está suspendida. Contacta al equipo de soporte.' });
      return okr({ usuario: u });
    };
    S.registrar = function (o) {
      var errors = {};
      var nombre = String(o.nombre_usuario || '').trim(), correo = String(o.correo || '').trim();
      var p1 = o.password || '', p2 = o.password2 || '';
      if (!nombre) errors.nombre_usuario = 'Elige un nombre de usuario.';
      else if (nombre.length > 30) errors.nombre_usuario = 'Máximo 30 caracteres.';
      else if (db.usuarios.some(function (u) { return norm(u.nombre_usuario) === norm(nombre); })) errors.nombre_usuario = 'Ese nombre de usuario ya está en uso.';
      if (!correo) errors.correo = 'Ingresa tu correo electrónico.';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || correo.length > 100) errors.correo = 'Escribe un correo válido (por ejemplo tu@ejemplo.com).';
      else if (db.usuarios.some(function (u) { return norm(u.correo) === norm(correo); })) errors.correo = 'Ese correo ya tiene una cuenta.';
      if (!p1) errors.password = 'Elige una contraseña.';
      else if (p1.length < 8) errors.password = 'La contraseña debe tener al menos 8 caracteres.';
      if (!errors.password && p1 !== p2) errors.password2 = 'Las contraseñas no coinciden.';
      if (Object.keys(errors).length) return fail('Revisa los campos marcados.', errors);
      var u = { id_usuario: next('usuario'), id_rol: ROL_USUARIO, nombre_usuario: nombre, correo: correo, contrasena_hash: hashPassword(p1),
        biografia: null, avatar_url: null, activo: 1, fecha_registro: nowStr() };
      db.usuarios.push(u);
      LISTAS_BASE.forEach(function (l) {
        db.listas.push({ id_lista: next('lista'), id_usuario: u.id_usuario, id_tipo: l[0], nombre: l[1], fecha_creacion: nowStr() });
      });
      log(u.id_usuario, 'USUARIO_REGISTRADO', nombre + ' creó su cuenta');
      return commit(okr({ usuario: u }));
    };

    /* ----- perfil ----- */
    S.generosFavoritos = function (idUsuario) {
      return db.usuario_genero.filter(function (x) { return x.id_usuario === idUsuario; }).map(function (x) { return x.id_genero; });
    };
    S.actualizarPerfil = function (idUsuario, o) {
      var u = S.usuario(idUsuario);
      if (!u) return fail('La cuenta no existe.');
      var errors = {}, bio = String(o.biografia || '').trim(), av = String(o.avatar_url || '').trim();
      if (bio.length > 300) errors.biografia = 'La biografía no puede exceder 300 caracteres.';
      if (av && (!/^https?:\/\/\S+$/i.test(av) || av.length > 255)) errors.avatar_url = 'Escribe una URL de imagen válida (http:// o https://, máx. 255 caracteres).';
      if (Object.keys(errors).length) return fail('Revisa los campos marcados.', errors);
      u.biografia = bio || null;
      u.avatar_url = av || null;
      db.usuario_genero = db.usuario_genero.filter(function (x) { return x.id_usuario !== idUsuario; });
      (o.generos || []).forEach(function (g) {
        if (S.genero(Number(g)) && !db.usuario_genero.some(function (x) { return x.id_usuario === idUsuario && x.id_genero === Number(g); })) {
          db.usuario_genero.push({ id_usuario: idUsuario, id_genero: Number(g) });
        }
      });
      return commit(okr({}));
    };

    /* ----- reseñas ----- */
    S.resenaDe = function (idUsuario, idAlbum) {
      return db.resenas.filter(function (r) { return r.id_usuario === idUsuario && r.id_album === idAlbum; })[0] || null;
    };
    S.guardarResena = function (o) {
      var u = S.usuario(o.id_usuario), al = find(db.albumes, 'id_album', o.id_album);
      if (!u || !u.activo) return fail('Tu cuenta no está activa.');
      if (u.id_rol !== ROL_USUARIO) return fail('Solo los usuarios registrados pueden reseñar álbumes.');
      if (!al) return fail('El álbum no existe.');
      var cal = Number(o.calificacion);
      if (!isInt(cal) || cal < 1 || cal > 5) return fail('Elige una calificación de 1 a 5 estrellas.', { calificacion: 'Elige de 1 a 5 estrellas.' });
      var com = String(o.comentario || '').trim();
      if (com.length > 1000) return fail('El comentario no puede exceder 1000 caracteres.', { comentario: 'Máximo 1000 caracteres.' });
      var ex = S.resenaDe(u.id_usuario, al.id_album);
      if (ex) {
        ex.calificacion = cal; ex.comentario = com || null; ex.fecha_edicion = nowStr();
        log(u.id_usuario, 'RESENA_EDITADA', u.nombre_usuario + ' editó su reseña de ' + al.titulo);
        return commit(okr({ resena: ex, accion: 'actualizada' }));
      }
      var r = { id_resena: next('resena'), id_usuario: u.id_usuario, id_album: al.id_album, id_estado: EST_PENDIENTE, calificacion: cal,
        comentario: com || null, fecha_publicacion: nowStr(), fecha_edicion: null };
      db.resenas.push(r);
      log(u.id_usuario, 'RESENA_PUBLICADA', u.nombre_usuario + ' calificó ' + al.titulo + ' con ' + cal + (cal === 1 ? ' estrella' : ' estrellas'));
      return commit(okr({ resena: r, accion: 'creada' }));
    };
    function borrarResena(id) {
      db.reportes = db.reportes.filter(function (x) { return x.id_resena !== id; }); // ON DELETE CASCADE
      db.resenas = db.resenas.filter(function (r) { return r.id_resena !== id; });
    }
    S.eliminarResena = function (idResena, idActor) {
      var r = find(db.resenas, 'id_resena', idResena), actor = S.usuario(idActor);
      if (!r) return fail('La reseña no existe.');
      if (!actor || !actor.activo || (r.id_usuario !== idActor && actor.id_rol !== ROL_ADMIN)) return fail('No puedes eliminar esta reseña.');
      var al = find(db.albumes, 'id_album', r.id_album);
      borrarResena(idResena);
      log(idActor, 'RESENA_ELIMINADA', actor.nombre_usuario + ' eliminó una reseña de ' + (al ? al.titulo : 'un álbum'));
      return commit(okr({}));
    };
    S.misResenas = function (idUsuario) {
      return db.resenas.filter(function (r) { return r.id_usuario === idUsuario; })
        .sort(function (a, b) { return a.fecha_publicacion < b.fecha_publicacion ? 1 : (a.fecha_publicacion > b.fecha_publicacion ? -1 : b.id_resena - a.id_resena); })
        .map(function (r) {
          var al = find(db.albumes, 'id_album', r.id_album);
          return { id_resena: r.id_resena, id_album: r.id_album, titulo: al.titulo, calificacion: r.calificacion, comentario: r.comentario,
            id_estado: r.id_estado, estado: ['', 'Pendiente', 'Aprobada', 'Rechazada'][r.id_estado], fecha_publicacion: r.fecha_publicacion, fecha_edicion: r.fecha_edicion };
        });
    };

    /* ----- listas ----- */
    S.listas = function (idUsuario) {
      return db.listas.filter(function (l) { return l.id_usuario === idUsuario; })
        .sort(function (a, b) { return a.id_lista - b.id_lista; })
        .map(function (l) {
          var items = db.lista_album.filter(function (x) { return x.id_lista === l.id_lista; })
            .map(function (x) { return viewRow(find(db.albumes, 'id_album', x.id_album)); });
          return { id_lista: l.id_lista, nombre: l.nombre, id_tipo: l.id_tipo, predeterminada: l.id_tipo !== TIPO_PERSONALIZADA, albumes: items };
        });
    };
    function listaPropia(idUsuario, idLista) {
      var l = find(db.listas, 'id_lista', idLista);
      return l && l.id_usuario === idUsuario ? l : null;
    }
    function nombreListaError(idUsuario, nombre, exceptId) {
      if (!nombre) return 'Ponle un nombre a la lista.';
      if (nombre.length > 60) return 'Máximo 60 caracteres.';
      if (db.listas.some(function (l) { return l.id_usuario === idUsuario && l.id_lista !== exceptId && norm(l.nombre) === norm(nombre); })) return 'Ya tienes una lista con ese nombre.';
      return null;
    }
    S.crearLista = function (idUsuario, nombre, idAlbum) {
      var u = S.usuario(idUsuario);
      if (!u || u.id_rol !== ROL_USUARIO) return fail('Solo los usuarios registrados pueden crear listas.');
      nombre = String(nombre || '').trim();
      var err = nombreListaError(idUsuario, nombre, null);
      if (err) return fail(err, { nombre: err });
      var l = { id_lista: next('lista'), id_usuario: idUsuario, id_tipo: TIPO_PERSONALIZADA, nombre: nombre, fecha_creacion: nowStr() };
      db.listas.push(l);
      if (idAlbum && find(db.albumes, 'id_album', idAlbum)) db.lista_album.push({ id_lista: l.id_lista, id_album: idAlbum, fecha_agregado: nowStr() });
      return commit(okr({ lista: l }));
    };
    S.renombrarLista = function (idUsuario, idLista, nombre) {
      var l = listaPropia(idUsuario, idLista);
      if (!l) return fail('La lista no existe.');
      if (l.id_tipo !== TIPO_PERSONALIZADA) return fail('Las listas predeterminadas no se pueden renombrar.');
      nombre = String(nombre || '').trim();
      var err = nombreListaError(idUsuario, nombre, idLista);
      if (err) return fail(err, { nombre: err });
      l.nombre = nombre;
      return commit(okr({}));
    };
    S.eliminarLista = function (idUsuario, idLista) {
      var l = listaPropia(idUsuario, idLista);
      if (!l) return fail('La lista no existe.');
      if (l.id_tipo !== TIPO_PERSONALIZADA) return fail('Las listas predeterminadas no se pueden eliminar.');
      db.lista_album = db.lista_album.filter(function (x) { return x.id_lista !== idLista; });
      db.listas = db.listas.filter(function (x) { return x.id_lista !== idLista; });
      return commit(okr({}));
    };
    S.agregarALista = function (idUsuario, idLista, idAlbum) {
      var l = listaPropia(idUsuario, idLista);
      if (!l) return fail('La lista no existe.');
      if (!find(db.albumes, 'id_album', idAlbum)) return fail('El álbum no existe.');
      if (db.lista_album.some(function (x) { return x.id_lista === idLista && x.id_album === idAlbum; })) return fail('Ese álbum ya está en la lista.');
      db.lista_album.push({ id_lista: idLista, id_album: idAlbum, fecha_agregado: nowStr() });
      return commit(okr({ lista: l }));
    };
    S.quitarDeLista = function (idUsuario, idLista, idAlbum) {
      if (!listaPropia(idUsuario, idLista)) return fail('La lista no existe.');
      db.lista_album = db.lista_album.filter(function (x) { return !(x.id_lista === idLista && x.id_album === idAlbum); });
      return commit(okr({}));
    };

    /* ----- reportes y moderación ----- */
    S.crearReporte = function (o) {
      var u = S.usuario(o.id_usuario_reporta);
      if (!u || !u.activo || u.id_rol !== ROL_USUARIO) return fail('Inicia sesión como usuario para reportar contenido.');
      var motivo = String(o.motivo || '').trim();
      if (!motivo) return fail('Cuéntanos el motivo del reporte.', { motivo: 'Escribe el motivo.' });
      if (motivo.length > 255) return fail('El motivo no puede exceder 255 caracteres.', { motivo: 'Máximo 255 caracteres.' });
      var idResena = o.id_resena || null, idRep = o.id_usuario_reportado || null;
      if (!!idResena === !!idRep) return fail('El reporte debe apuntar a una reseña o a un usuario, no a ambos.');
      if (idResena) {
        var r = find(db.resenas, 'id_resena', idResena);
        if (!r) return fail('La reseña no existe.');
        if (r.id_usuario === u.id_usuario) return fail('No puedes reportar tu propia reseña.');
      } else {
        if (idRep === u.id_usuario) return fail('Un usuario no puede reportarse a sí mismo.');
        if (!S.usuario(idRep)) return fail('El usuario no existe.');
      }
      if (db.reportes.some(function (x) { return x.id_usuario_reporta === u.id_usuario && ((idResena && x.id_resena === idResena) || (idRep && x.id_usuario_reportado === idRep)); })) {
        return fail('Ya enviaste un reporte sobre este contenido.');
      }
      db.reportes.push({ id_reporte: next('reporte'), id_usuario_reporta: u.id_usuario, id_resena: idResena, id_usuario_reportado: idRep,
        motivo: motivo, fecha_reporte: nowStr(), atendido: 0 });
      return commit(okr({}));
    };
    S.pendientes = function () {
      return db.resenas.filter(function (r) { return r.id_estado === EST_PENDIENTE; })
        .sort(function (a, b) { return a.id_resena - b.id_resena; })
        .map(function (r) {
          return { id_resena: r.id_resena, nombre_usuario: S.usuario(r.id_usuario).nombre_usuario, titulo: find(db.albumes, 'id_album', r.id_album).titulo,
            calificacion: r.calificacion, comentario: r.comentario };
        });
    };
    S.moderar = function (idResena, estado, idAdmin) {
      var e = needAdmin(idAdmin); if (e) return e;
      var r = find(db.resenas, 'id_resena', idResena);
      if (!r) return fail('La reseña no existe.');
      var id = estado === 'Aprobada' ? EST_APROBADA : (estado === 'Rechazada' ? EST_RECHAZADA : 0);
      if (!id) return fail('Estado no válido.');
      r.id_estado = id;
      log(idAdmin, 'MODERACION', 'admin ' + (id === EST_APROBADA ? 'aprobó' : 'rechazó') + ' la reseña de ' + S.usuario(r.id_usuario).nombre_usuario + ' sobre ' + find(db.albumes, 'id_album', r.id_album).titulo);
      return commit(okr({}));
    };
    S.reportesPendientes = function () {
      return db.reportes.filter(function (x) { return !x.atendido; }).sort(function (a, b) { return a.id_reporte - b.id_reporte; })
        .map(function (x) {
          var por = x.id_usuario_reporta ? S.usuario(x.id_usuario_reporta) : null, contenido;
          if (x.id_resena) {
            var r = find(db.resenas, 'id_resena', x.id_resena);
            contenido = 'Reseña de «' + find(db.albumes, 'id_album', r.id_album).titulo + '» por ' + S.usuario(r.id_usuario).nombre_usuario +
              (r.comentario ? ': “' + r.comentario + '”' : '') + ' — ' + x.motivo;
          } else {
            contenido = 'Perfil de ' + S.usuario(x.id_usuario_reportado).nombre_usuario + ' — ' + x.motivo;
          }
          return { id_reporte: x.id_reporte, por: por ? por.nombre_usuario : '(cuenta eliminada)', tipo: x.id_resena ? 'Reseña' : 'Usuario', contenido: contenido,
            id_resena: x.id_resena, id_usuario_reportado: x.id_usuario_reportado };
        });
    };
    S.atenderReporte = function (idReporte, accion, idAdmin) {
      var e = needAdmin(idAdmin); if (e) return e;
      var rep = find(db.reportes, 'id_reporte', idReporte);
      if (!rep || rep.atendido) return fail('El reporte no existe o ya fue atendido.');
      if (accion === 'eliminar') {
        if (!rep.id_resena) return fail('Solo se puede eliminar una reseña reportada.');
        borrarResena(rep.id_resena); // el reporte se elimina en cascada
        log(idAdmin, 'RESENA_ELIMINADA', 'admin eliminó una reseña reportada');
      } else if (accion === 'suspender') {
        if (!rep.id_usuario_reportado) return fail('Solo se puede suspender a un usuario reportado.');
        var u = S.usuario(rep.id_usuario_reportado);
        if (u.id_rol === ROL_ADMIN) return fail('No se puede suspender a un administrador.');
        u.activo = 0; rep.atendido = 1;
        log(idAdmin, 'CUENTA_SUSPENDIDA', 'admin suspendió la cuenta de ' + u.nombre_usuario);
      } else if (accion === 'descartar') {
        rep.atendido = 1;
        log(idAdmin, 'REPORTE_DESCARTADO', 'admin descartó el reporte #' + idReporte);
      } else return fail('Acción no válida.');
      return commit(okr({}));
    };
    S.usuarios = function () {
      return db.usuarios.map(function (u) {
        return { id_usuario: u.id_usuario, nombre_usuario: u.nombre_usuario, correo: u.correo, rol: u.id_rol === ROL_ADMIN ? 'Administrador' : 'Usuario', activo: !!u.activo };
      });
    };
    S.setActivo = function (idUsuario, activo, idAdmin) {
      var e = needAdmin(idAdmin); if (e) return e;
      var u = S.usuario(idUsuario);
      if (!u) return fail('La cuenta no existe.');
      if (u.id_rol === ROL_ADMIN) return fail('No se puede suspender a un administrador.');
      u.activo = activo ? 1 : 0;
      log(idAdmin, activo ? 'CUENTA_REACTIVADA' : 'CUENTA_SUSPENDIDA', 'admin ' + (activo ? 'reactivó' : 'suspendió') + ' la cuenta de ' + u.nombre_usuario);
      return commit(okr({}));
    };

    /* ----- panel de administración ----- */
    S.kpis = function () {
      return { albumes: db.albumes.length, usuarios: db.usuarios.length, pendientes: db.resenas.filter(function (r) { return r.id_estado === EST_PENDIENTE; }).length };
    };
    S.actividad = function (n) {
      return db.bitacora.slice().sort(function (a, b) {
        return a.fecha < b.fecha ? 1 : (a.fecha > b.fecha ? -1 : b.id_bitacora - a.id_bitacora);
      }).slice(0, n || 5);
    };

    /* ----- admin: géneros ----- */
    function nombreGeneroError(nombre, exceptId) {
      if (!nombre) return 'Escribe el nombre del género.';
      if (nombre.length > 50) return 'Máximo 50 caracteres.';
      if (db.generos.some(function (g) { return g.id_genero !== exceptId && norm(g.nombre) === norm(nombre); })) return 'Ese género ya existe.';
      return null;
    }
    S.agregarGenero = function (actor, nombre) {
      var e = needAdmin(actor); if (e) return e;
      nombre = String(nombre || '').trim();
      var err = nombreGeneroError(nombre, null); if (err) return fail(err);
      db.generos.push({ id_genero: next('genero'), nombre: nombre });
      log(actor, 'ALTA_GENERO', 'admin agregó el género ' + nombre);
      return commit(okr({}));
    };
    S.renombrarGenero = function (actor, id, nombre) {
      var e = needAdmin(actor); if (e) return e;
      var g = S.genero(id); if (!g) return fail('El género no existe.');
      nombre = String(nombre || '').trim();
      var err = nombreGeneroError(nombre, id); if (err) return fail(err);
      log(actor, 'MOD_GENERO', 'admin renombró el género ' + g.nombre + ' a ' + nombre);
      g.nombre = nombre;
      return commit(okr({}));
    };
    S.eliminarGenero = function (actor, id) {
      var e = needAdmin(actor); if (e) return e;
      var g = S.genero(id); if (!g) return fail('El género no existe.');
      if (db.artistas.some(function (a) { return a.id_genero === id; }) || db.albumes.some(function (a) { return a.id_genero === id; })) {
        return fail('No se puede eliminar «' + g.nombre + '» porque está en uso por artistas o álbumes.');
      }
      db.usuario_genero = db.usuario_genero.filter(function (x) { return x.id_genero !== id; }); // ON DELETE CASCADE
      db.generos = db.generos.filter(function (x) { return x.id_genero !== id; });
      log(actor, 'BAJA_GENERO', 'admin eliminó el género ' + g.nombre);
      return commit(okr({}));
    };

    /* ----- admin: artistas ----- */
    S.guardarArtista = function (actor, o) {
      var e = needAdmin(actor); if (e) return e;
      var errors = {}, nombre = String(o.nombre || '').trim(), pais = String(o.pais || '').trim(), bio = String(o.biografia || '').trim();
      var idG = Number(o.id_genero), ex = o.id_artista ? find(db.artistas, 'id_artista', o.id_artista) : null;
      if (o.id_artista && !ex) return fail('El artista no existe.');
      if (!nombre) errors.nombre = 'Escribe el nombre del artista.';
      else if (nombre.length > 100) errors.nombre = 'Máximo 100 caracteres.';
      else if (db.artistas.some(function (a) { return (!ex || a.id_artista !== ex.id_artista) && norm(a.nombre) === norm(nombre); })) errors.nombre = 'Ya existe un artista con ese nombre.';
      if (!S.genero(idG)) errors.id_genero = 'Elige un género.';
      if (pais.length > 60) errors.pais = 'Máximo 60 caracteres.';
      if (bio.length > 1000) errors.biografia = 'Máximo 1000 caracteres.';
      if (ex && !errors.id_genero && ex.id_genero !== idG && db.albumes.some(function (a) { return a.id_artista === ex.id_artista; })) {
        errors.id_genero = 'No se puede cambiar el género de un artista con álbumes (cada álbum conserva el género de su artista).';
      }
      if (Object.keys(errors).length) return fail('Revisa los campos marcados.', errors);
      if (ex) {
        ex.nombre = nombre; ex.id_genero = idG; ex.pais = pais || null; ex.biografia = bio || null;
        log(actor, 'MOD_ARTISTA', 'admin modificó al artista ' + nombre);
      } else {
        db.artistas.push({ id_artista: next('artista'), id_genero: idG, nombre: nombre, pais: pais || null, biografia: bio || null });
        log(actor, 'ALTA_ARTISTA', 'admin añadió al artista ' + nombre);
      }
      return commit(okr({}));
    };
    S.eliminarArtista = function (actor, id) {
      var e = needAdmin(actor); if (e) return e;
      var a = find(db.artistas, 'id_artista', id); if (!a) return fail('El artista no existe.');
      if (db.albumes.some(function (x) { return x.id_artista === id; })) {
        return fail('No se puede eliminar a «' + a.nombre + '» porque todavía tiene álbumes. Elimina o reasigna sus álbumes primero.');
      }
      db.artistas = db.artistas.filter(function (x) { return x.id_artista !== id; });
      log(actor, 'BAJA_ARTISTA', 'admin eliminó al artista ' + a.nombre);
      return commit(okr({}));
    };

    /* ----- admin: álbumes y canciones ----- */
    S.guardarAlbum = function (actor, o) {
      var e = needAdmin(actor); if (e) return e;
      var errors = {}, titulo = String(o.titulo || '').trim(), idA = Number(o.id_artista), anio = Number(o.anio), hue = Number(o.hue);
      var ex = o.id_album ? find(db.albumes, 'id_album', o.id_album) : null, ar = find(db.artistas, 'id_artista', idA);
      if (o.id_album && !ex) return fail('El álbum no existe.');
      if (!titulo) errors.titulo = 'Escribe el título del álbum.';
      else if (titulo.length > 100) errors.titulo = 'Máximo 100 caracteres.';
      if (!ar) errors.id_artista = 'Elige un artista.';
      if (!isInt(anio) || anio < 1900 || anio > 2100) errors.anio = 'El año debe estar entre 1900 y 2100.';
      if (!isInt(hue) || hue < 0 || hue > 360) errors.hue = 'El tono debe estar entre 0 y 360.';
      if (!errors.titulo && ar && db.albumes.some(function (a) { return (!ex || a.id_album !== ex.id_album) && a.id_artista === idA && norm(a.titulo) === norm(titulo); })) {
        errors.titulo = 'Ese artista ya tiene un álbum con ese título.';
      }
      if (Object.keys(errors).length) return fail('Revisa los campos marcados.', errors);
      if (ex) {
        ex.titulo = titulo; ex.id_artista = idA; ex.id_genero = ar.id_genero; ex.anio_lanzamiento = anio; ex.portada_hue = hue;
        log(actor, 'MOD_ALBUM', 'admin modificó el álbum ' + titulo);
      } else {
        db.albumes.push({ id_album: next('album'), id_artista: idA, id_genero: ar.id_genero, titulo: titulo, anio_lanzamiento: anio, portada_hue: hue, fecha_registro: nowStr() });
        log(actor, 'ALTA_ALBUM', 'admin añadió el álbum ' + titulo);
      }
      return commit(okr({}));
    };
    S.eliminarAlbum = function (actor, id) {
      var e = needAdmin(actor); if (e) return e;
      var a = find(db.albumes, 'id_album', id); if (!a) return fail('El álbum no existe.');
      db.resenas.filter(function (r) { return r.id_album === id; }).forEach(function (r) { borrarResena(r.id_resena); });
      db.canciones = db.canciones.filter(function (c) { return c.id_album !== id; });
      db.lista_album = db.lista_album.filter(function (x) { return x.id_album !== id; });
      db.albumes = db.albumes.filter(function (x) { return x.id_album !== id; });
      log(actor, 'BAJA_ALBUM', 'admin eliminó el álbum ' + a.titulo);
      return commit(okr({}));
    };
    S.guardarCancion = function (actor, o) {
      var e = needAdmin(actor); if (e) return e;
      var errors = {}, titulo = String(o.titulo || '').trim(), dur = Number(o.duracion_seg);
      var al = find(db.albumes, 'id_album', o.id_album), ex = o.id_cancion ? find(db.canciones, 'id_cancion', o.id_cancion) : null;
      if (!al) return fail('El álbum no existe.');
      if (o.id_cancion && !ex) return fail('La canción no existe.');
      if (!titulo) errors.titulo = 'Escribe el título de la canción.';
      else if (titulo.length > 100) errors.titulo = 'Máximo 100 caracteres.';
      if (!isInt(dur) || dur <= 0 || dur > 65535) errors.duracion = 'La duración debe tener el formato mm:ss y ser mayor a 0.';
      var lista = S.canciones(al.id_album);
      if (!ex && lista.length >= 255) errors.titulo = 'Un álbum admite hasta 255 canciones.';
      if (Object.keys(errors).length) return fail('Revisa los campos marcados.', errors);
      if (ex) { ex.titulo = titulo; ex.duracion_seg = dur; ex.es_sencillo = o.es_sencillo ? 1 : 0; }
      else {
        db.canciones.push({ id_cancion: next('cancion'), id_album: al.id_album, numero_pista: lista.length ? lista[lista.length - 1].numero_pista + 1 : 1,
          titulo: titulo, duracion_seg: dur, es_sencillo: o.es_sencillo ? 1 : 0 });
      }
      log(actor, 'MOD_TRACKLIST', 'admin actualizó el tracklist de ' + al.titulo);
      return commit(okr({}));
    };
    S.eliminarCancion = function (actor, id) {
      var e = needAdmin(actor); if (e) return e;
      var c = find(db.canciones, 'id_cancion', id); if (!c) return fail('La canción no existe.');
      db.canciones = db.canciones.filter(function (x) { return x.id_cancion !== id; });
      S.canciones(c.id_album).forEach(function (x, i) { x.numero_pista = i + 1; }); // mantiene la numeración sin huecos
      log(actor, 'MOD_TRACKLIST', 'admin actualizó el tracklist de ' + find(db.albumes, 'id_album', c.id_album).titulo);
      return commit(okr({}));
    };

    return S;
  }

  return { create: create, seed: seed, hashPassword: hashPassword, norm: norm, DEMO_PASSWORD: DEMO_PASSWORD };
});
