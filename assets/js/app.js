/* =====================================================================
   AlbumMatch — app.js
   Interfaz: router por hash, sesión, modales y las 16 pantallas del
   plan (Fase 1). Todos los datos pasan por AlbumApi (api.js): en modo
   "server" llegan de api/index.php (PHP + MySQL); en modo "demo" salen
   de store.js dentro del navegador.
   ===================================================================== */
(function () {
  'use strict';

  var api = AlbumApi;
  var C = { ROL_USUARIO: 1, ROL_ADMIN: 2, EST_PENDIENTE: 1, EST_APROBADA: 2, EST_RECHAZADA: 3, DEMO_PASSWORD: 'AlbumMatch2026!' };

  /* ---------- helpers ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function initials(t) { return String(t).split(/\s+/).map(function (w) { return w[0] || ''; }).join('').slice(0, 2).toUpperCase(); }
  function starString(p) {
    var full = Math.round(p), s = '';
    for (var i = 0; i < 5; i++) s += i < full ? '★' : '☆';
    return s.replace(/☆+$/, function (m) { return '<span class="dim">' + m + '</span>'; });
  }
  function fmtDur(s) { var m = Math.floor(s / 60), r = s % 60; return m + ':' + (r < 10 ? '0' : '') + r; }
  function parseDur(t) { var m = /^(\d{1,3}):([0-5]\d)$/.exec(String(t || '').trim()); return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : 0; }
  function fmtDate(s) { return s ? String(s).slice(0, 10) : ''; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function opts(placeholder, items, val, label, selected) {
    return '<option value="">' + esc(placeholder) + '</option>' + items.map(function (i) {
      return '<option value="' + esc(i[val]) + '"' + (String(selected) === String(i[val]) ? ' selected' : '') + '>' + esc(i[label]) + '</option>';
    }).join('');
  }
  function yearOpts(anios, sel) { return opts('Año', anios.map(function (y) { return { v: y }; }), 'v', 'v', sel); }
  function calOpts(sel) {
    return '<option value="">Calificación</option>' + [4, 3, 2, 1].map(function (n) {
      return '<option value="' + n + '"' + (String(sel) === String(n) ? ' selected' : '') + '>' + n + ' ★ o más</option>';
    }).join('');
  }
  function cover(a, cls) {
    return '<div class="cover' + (cls ? ' ' + cls : '') + '" style="--h:' + Number(a.portada_hue) + ';"><span class="cover-mark">' + esc(initials(a.titulo)) + '</span></div>';
  }
  function ratingHtml(a) {
    return a.promedio === null ? '<div class="no-rating">Sin calificaciones</div>' : '<div class="stars" style="margin-top:4px;">' + starString(a.promedio) + '</div>';
  }
  function cards(list, emptyMsg) {
    if (!list.length) return '<p class="empty-note">' + esc(emptyMsg || 'No hay álbumes para mostrar.') + '</p>';
    return list.map(function (a) {
      return '<a class="album-card" href="#album/' + Number(a.id_album) + '">' + cover(a) +
        '<div><div class="name">' + esc(a.titulo) + '</div><div class="artist">' + esc(a.artista) + '</div>' + ratingHtml(a) + '</div></a>';
    }).join('');
  }
  function field(name, id, label, type, ph, value, extra) {
    return '<div class="field" data-field="' + name + '"><label for="' + id + '">' + label + '</label><input type="' + type + '" id="' + id + '" placeholder="' + esc(ph || '') + '" value="' + esc(value == null ? '' : value) + '"' + (extra || '') + '><div class="err"></div></div>';
  }
  function showErrors(root, errors) {
    var shown = false;
    $$('.field', root).forEach(function (f) { f.classList.remove('invalid'); var e = $('.err', f); if (e) e.textContent = ''; });
    var g = $('.form-error', root); if (g) { g.textContent = ''; g.style.display = 'none'; }
    Object.keys(errors || {}).forEach(function (k) {
      if (k === 'general') { if (g) { g.textContent = errors[k]; g.style.display = 'block'; shown = true; } return; }
      var f = $('[data-field="' + k + '"]', root);
      if (f) { f.classList.add('invalid'); var e = $('.err', f); if (e) e.textContent = errors[k]; shown = true; }
    });
    return shown;
  }
  function handleFail(root, res) {
    if (res.code === 'auth') return; // api.onAuthLost ya redirige al login
    if (showErrors(root, res.errors)) return;
    var g = $('.form-error', root);
    if (g) { g.textContent = res.error; g.style.display = 'block'; } else toast(res.error);
  }

  /* ---------- toast y modal ---------- */
  var toastTimer = null;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.add('hidden'); }, 3200);
  }
  var overlay = $('#modal-overlay'), modalContent = $('#modal-content'), lastFocus = null;
  function openModal(html) {
    if (overlay.classList.contains('hidden')) lastFocus = document.activeElement;
    modalContent.innerHTML = html;
    overlay.classList.remove('hidden');
    var f = $('input:not([type=hidden]),textarea,select', modalContent) || $('button', modalContent);
    if (f) f.focus();
    return modalContent;
  }
  function closeModal() {
    overlay.classList.add('hidden'); modalContent.innerHTML = '';
    if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) { /* elemento ya no existe */ }
  }
  $('#modal-close').addEventListener('click', closeModal);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !overlay.classList.contains('hidden')) closeModal(); });

  function confirmDialog(o, onYes) {
    var m = openModal('<h3>' + esc(o.title) + '</h3><p class="muted small" style="line-height:1.6;margin-bottom:18px;">' + esc(o.message) + '</p>' +
      '<div class="modal-actions"><button class="btn btn-ghost" data-c="no">Cancelar</button><button class="btn ' + (o.danger ? 'btn-bad' : 'btn-primary') + '" data-c="yes">' + esc(o.ok || 'Aceptar') + '</button></div>');
    $('[data-c="no"]', m).onclick = closeModal;
    $('[data-c="yes"]', m).onclick = function () { closeModal(); onYes(); };
  }
  // Diálogo con un campo de texto; onSubmit(valor) es async y devuelve { ok, ... }
  function textDialog(o, onSubmit) {
    var m = openModal('<h3>' + esc(o.title) + '</h3>' + field('nombre', 'td-input', esc(o.label), 'text', o.placeholder, o.value, ' maxlength="' + (o.max || 60) + '"') +
      '<div class="form-error" style="display:none;"></div><div class="modal-actions"><button class="btn btn-ghost" data-c="no">Cancelar</button><button class="btn btn-primary" data-c="yes">' + esc(o.ok || 'Guardar') + '</button></div>');
    var busy = false;
    async function send() {
      if (busy) return; busy = true;
      var res = await onSubmit($('#td-input', m).value);
      busy = false;
      if (res.ok) closeModal(); else handleFail(m, res);
    }
    $('[data-c="no"]', m).onclick = closeModal;
    $('[data-c="yes"]', m).onclick = send;
    $('#td-input', m).addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
  }

  /* ---------- sesión ---------- */
  function isAdmin(u) { return !!u && u.id_rol === C.ROL_ADMIN; }
  var pendingNext = null;
  function needLogin() { pendingNext = location.hash || '#home'; toast('Inicia sesión para continuar.'); go('#auth'); }
  function afterLogin(u) {
    var dest = pendingNext; pendingNext = null;
    if (isAdmin(u)) dest = '#admin';
    else if (!dest || /^#auth/.test(dest) || /^#admin/.test(dest)) dest = '#perfil';
    go(dest);
  }
  api.onAuthLost = function () { closeModal(); needLogin(); };

  /* ---------- router ---------- */
  var view = $('#view'), headerEl = $('#site-header');
  var catalogoFiltros = null, routeSeq = 0;
  var ROUTES = {
    home: { title: 'Inicio', render: viewHome },
    catalogo: { title: 'Catálogo', render: viewCatalogo },
    album: { title: 'Álbum', render: viewAlbum },
    artista: { title: 'Artista', render: viewArtista },
    ayuda: { title: 'Ayuda', render: viewAyuda },
    acerca: { title: 'Acerca de nosotros', render: viewAcerca },
    auth: { title: 'Iniciar sesión', render: viewAuth, guest: true },
    'auth-single': { title: 'Iniciar sesión', render: viewAuthSingle, guest: true },
    perfil: { title: 'Mi perfil', render: viewPerfil, guard: 'user' },
    listas: { title: 'Mis listas', render: viewListas, guard: 'user' },
    resenas: { title: 'Mis reseñas', render: viewResenas, guard: 'user' },
    recomendaciones: { title: 'Recomendaciones', render: viewReco, guard: 'user' },
    admin: { title: 'Panel de administración', render: viewAdmin, guard: 'admin' },
    'admin-albumes': { title: 'Gestión de álbumes', render: viewAdminAlbumes, guard: 'admin' },
    'admin-artistas': { title: 'Gestión de artistas', render: viewAdminArtistas, guard: 'admin' },
    moderacion: { title: 'Moderación', render: viewModeracion, guard: 'admin' }
  };
  function go(hash) { if (location.hash === hash) route(false); else location.hash = hash; }
  function parseHash() {
    var parts = location.hash.replace(/^#\/?/, '').split('/');
    return { name: parts[0] || 'home', param: parts[1] };
  }
  async function route(keepScroll) {
    var my = ++routeSeq, r = parseHash(), def = ROUTES[r.name];
    if (!def) { r = { name: 'home' }; def = ROUTES.home; }
    var u = await api.me();
    if (my !== routeSeq) return;
    if (def.guard === 'user' && !u) { needLogin(); return; }
    if (def.guard === 'user' && isAdmin(u)) { go('#admin'); return; }
    if (def.guard === 'admin' && !isAdmin(u)) {
      if (u) { toast('Esa sección es solo para administradores.'); go('#home'); } else needLogin();
      return;
    }
    if (def.guest && u) { go(isAdmin(u) ? '#admin' : '#perfil'); return; }
    view.onclick = view.oninput = view.onchange = view.onsubmit = view.onkeydown = null;
    renderHeader(r.name, u);
    document.title = def.title + ' · AlbumMatch';
    await def.render(r.param, u, my);
    if (my === routeSeq && !keepScroll) window.scrollTo(0, 0);
  }
  function refresh() { return route(true); }
  window.addEventListener('hashchange', function () { route(false); });

  function navLink(href, label, active) { return '<a href="' + href + '"' + (active ? ' class="current" aria-current="page"' : '') + '>' + label + '</a>'; }
  function renderHeader(name, u) {
    var h;
    if (ROUTES[name].guard === 'admin') {
      h = '<a class="logo" href="#admin"><span class="logo-dot"></span>AlbumMatch<span class="tag" style="margin-left:10px;">Admin</span></a>' +
        '<nav class="site-nav" aria-label="Administración">' + navLink('#admin', 'Panel', name === 'admin') + navLink('#admin-albumes', 'Gestión de álbumes', name === 'admin-albumes') +
        navLink('#admin-artistas', 'Gestión de artistas', name === 'admin-artistas') + navLink('#moderacion', 'Moderación', name === 'moderacion') + '</nav>' +
        '<div class="site-actions"><button class="btn btn-ghost btn-sm" data-logout>Cerrar sesión</button></div>';
    } else {
      var cat = name === 'catalogo' || name === 'album' || name === 'artista';
      var actions = !u ? '<a class="btn btn-ghost btn-sm" href="#auth">Iniciar sesión</a><a class="btn btn-primary btn-sm" href="#auth">Registrarse</a>'
        : (isAdmin(u) ? '<a class="btn btn-ghost btn-sm" href="#admin">Panel</a>' : '<a class="btn btn-ghost btn-sm" href="#perfil">Perfil</a>') + '<button class="btn btn-ghost btn-sm" data-logout>Cerrar sesión</button>';
      h = '<a class="logo" href="#home"><span class="logo-dot"></span>AlbumMatch</a>' +
        '<nav class="site-nav" aria-label="Principal">' + navLink('#home', 'Inicio', name === 'home') + navLink('#catalogo', 'Catálogo', cat) +
        navLink('#acerca', 'Acerca de nosotros', name === 'acerca') + navLink('#ayuda', 'Ayuda', name === 'ayuda') + '</nav><div class="site-actions">' + actions + '</div>';
    }
    headerEl.innerHTML = h;
  }
  headerEl.addEventListener('click', async function (e) {
    if (e.target.closest('[data-logout]')) { await api.write('logout'); toast('Sesión cerrada.'); go('#home'); }
  });
  $('#site-footer').innerHTML = '<span>AlbumMatch · Proyecto final de Programación Web · FIME – UANL</span>' +
    (api.mode === 'demo' ? '<span>Modo demostración: los datos se guardan solo en este navegador. <button class="linklike" id="btn-reset">Restablecer datos de demostración</button></span>' : '');
  if (api.mode === 'demo') {
    $('#btn-reset').addEventListener('click', function () {
      confirmDialog({ title: 'Restablecer datos', message: 'Se borrarán los cambios hechos en este navegador y volverán los datos de ejemplo.', ok: 'Restablecer', danger: true }, function () {
        api.reset(); toast('Datos de demostración restablecidos.'); go('#home');
      });
    });
  }

  /* =====================================================================
     PANTALLAS PÚBLICAS
     ===================================================================== */
  async function viewHome(_, u, my) {
    var d = await Promise.all([api.read('generos', {}, []), api.read('anios', {}, []), api.read('populares', { n: 5 }, []), api.read('mejorCalificados', { n: 5 }, [])]);
    if (my !== routeSeq) return;
    view.innerHTML = '<div class="hero"><div class="eyebrow">Catálogo colaborativo de música</div><h1>Descubre tu próxima obsesión musical</h1>' +
      '<p>Explora, califica y guarda álbumes según tus géneros favoritos.</p>' +
      '<form class="filterbar" id="home-form" role="search"><input type="text" id="home-q" placeholder="Buscar álbum o artista…" aria-label="Buscar álbum o artista">' +
      '<select class="select" id="home-g" aria-label="Género">' + opts('Género', d[0], 'id_genero', 'nombre') + '</select>' +
      '<select class="select" id="home-y" aria-label="Año">' + yearOpts(d[1]) + '</select>' +
      '<select class="select" id="home-c" aria-label="Calificación mínima">' + calOpts('') + '</select>' +
      '<button class="btn btn-primary btn-sm" type="submit">Buscar</button></form></div>' +
      '<div class="wrap" style="padding-top:6px;"><div class="section-head"><h2>Álbumes populares</h2><a class="see-all" href="#catalogo">Ver catálogo</a></div>' +
      '<div class="grid grid-5">' + cards(d[2]) + '</div>' +
      '<div class="section-head"><h2>Mejor calificados</h2><a class="see-all" href="#catalogo">Ver catálogo</a></div>' +
      '<div class="grid grid-5">' + cards(d[3], 'Aún no hay álbumes con reseñas aprobadas.') + '</div></div>';
    $('#home-form').onsubmit = function (e) {
      e.preventDefault();
      catalogoFiltros = { q: $('#home-q').value, g: $('#home-g').value, y: $('#home-y').value, c: $('#home-c').value };
      go('#catalogo');
    };
  }

  async function viewCatalogo(_, u, my) {
    var f = catalogoFiltros || { q: '', g: '', y: '', c: '' };
    catalogoFiltros = null;
    var d = await Promise.all([api.read('generos', {}, []), api.read('anios', {}, [])]);
    if (my !== routeSeq) return;
    view.innerHTML = '<div class="wrap"><h2 style="font-size:1.6rem;margin-bottom:18px;">Catálogo de álbumes</h2>' +
      '<div class="filterbar" style="margin-bottom:26px;"><input type="text" id="cat-q" placeholder="Buscar álbum o artista…" aria-label="Buscar álbum o artista" value="' + esc(f.q) + '">' +
      '<select class="select" id="cat-g" aria-label="Género">' + opts('Género', d[0], 'id_genero', 'nombre', f.g) + '</select>' +
      '<select class="select" id="cat-y" aria-label="Año">' + yearOpts(d[1], f.y) + '</select>' +
      '<select class="select" id="cat-c" aria-label="Calificación mínima">' + calOpts(f.c) + '</select></div>' +
      '<div class="grid grid-4" id="cat-grid"></div></div>';
    var seq = 0;
    async function draw() {
      var n = ++seq;
      var list = await api.read('buscar', { q: $('#cat-q').value, id_genero: $('#cat-g').value, anio: $('#cat-y').value, minCal: $('#cat-c').value }, []);
      var grid = $('#cat-grid');
      if (n !== seq || my !== routeSeq || !grid) return; // llegó una respuesta vieja
      grid.innerHTML = list.length ? cards(list) : '<p class="empty-note" style="grid-column:1/-1;">No se encontraron álbumes con esos filtros.</p>';
    }
    view.oninput = draw;
    view.onchange = function (e) { if (e.target.tagName === 'SELECT') draw(); };
    await draw();
  }

  async function viewAlbum(id, u, my) {
    var idn = Number(id);
    var d = await api.read('detalleAlbum', { id: idn });
    var mine = d && u && !isAdmin(u) ? await api.read('resenaDe', { id_album: idn }) : null;
    if (my !== routeSeq) return;
    if (!d) { view.innerHTML = '<div class="wrap wrap-narrow"><h2>No encontramos ese álbum</h2><p class="muted" style="margin:10px 0 18px;">Puede que haya sido eliminado.</p><a class="btn btn-primary" href="#catalogo">Volver al catálogo</a></div>'; return; }
    var a = d.album;
    var rating = a.promedio === null ? '<span class="muted">Sin calificaciones todavía</span>' :
      '<span class="stars">' + starString(a.promedio) + '</span><span>' + a.promedio.toFixed(1) + ' de 5 · ' + plural(a.total_resenas, 'reseña', 'reseñas') + '</span>';
    var buttons = isAdmin(u) ? '' : '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:26px;"><button class="btn btn-primary" data-act="rate">' + (mine ? 'Editar mi reseña' : 'Calificar y reseñar') + '</button><button class="btn btn-violet" data-act="addlist">Añadir a lista</button></div>';
    var tracks = d.canciones.length ? d.canciones.map(function (c) {
      return '<li><span><span class="n">' + (c.numero_pista < 10 ? '0' : '') + c.numero_pista + '</span>' + esc(c.titulo) + (Number(c.es_sencillo) ? ' <span class="tag" style="margin-left:6px;">Sencillo</span>' : '') + '</span><span>' + fmtDur(c.duracion_seg) + '</span></li>';
    }).join('') : '<li><span class="muted">Aún no hay canciones registradas para este álbum.</span></li>';
    var estadoMine = mine && mine.id_estado !== C.EST_APROBADA ? '<div class="note">Tu reseña de este álbum está <strong>' + (mine.id_estado === C.EST_PENDIENTE ? 'pendiente de aprobación' : 'rechazada') + '</strong>' +
      (mine.id_estado === C.EST_PENDIENTE ? ': se publicará cuando un administrador la revise.' : ': no se muestra al público.') + '</div>' : '';
    var revs = d.resenas.length ? d.resenas.map(function (r) {
      var own = u && r.id_usuario === u.id_usuario;
      return '<div class="review"><div class="review-top"><span class="review-user">' + esc(r.nombre_usuario) + '</span><span class="stars">' + starString(r.calificacion) + '</span></div>' +
        (r.comentario ? '<p class="review-text">' + esc(r.comentario) + '</p>' : '') +
        '<div class="review-meta"><span>' + fmtDate(r.fecha_publicacion) + '</span>' + (u && !isAdmin(u) && !own ? '<button class="linklike" data-act="report" data-id="' + Number(r.id_resena) + '">Reportar</button>' : '') + '</div></div>';
    }).join('') : '<p class="empty-note">Todavía no hay reseñas para este álbum. ¡Sé el primero en calificarlo!</p>';
    view.innerHTML = '<div class="wrap wrap-narrow"><div class="detalle-grid">' + cover(a, 'lg') + '<div>' +
      '<div class="eyebrow">' + esc(a.genero) + ' · ' + a.anio_lanzamiento + '</div><h1 style="font-size:1.9rem;margin-bottom:4px;">' + esc(a.titulo) + '</h1>' +
      '<p class="muted" style="margin-bottom:12px;"><a class="link" href="#artista/' + Number(a.id_artista) + '">' + esc(a.artista) + '</a></p>' +
      '<div class="rating-line" style="margin-bottom:20px;">' + rating + '</div>' + buttons +
      '<h3 style="font-size:1rem;margin-bottom:8px;">Canciones</h3><ul class="tracklist">' + tracks + '</ul></div></div>' +
      '<div class="section-head"><h2>Reseñas de usuarios</h2></div>' + estadoMine + '<div class="panel">' + revs + '</div></div>';
    view.onclick = function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'report') { if (!u) return needLogin(); return openReportModal(Number(b.dataset.id)); }
      if (!u) return needLogin();
      if (b.dataset.act === 'rate') openReviewModal(a.id_album);
      if (b.dataset.act === 'addlist') openAddToList(a);
    };
  }

  async function openReviewModal(idAlbum) {
    var d = await api.read('detalleAlbum', { id: idAlbum });
    var ex = await api.read('resenaDe', { id_album: idAlbum });
    if (!d) return toast('El álbum ya no existe.');
    var al = d.album, rating = ex ? ex.calificacion : 0;
    var m = openModal('<h3>' + (ex ? 'Editar tu reseña de' : 'Calificar y reseñar') + ' «' + esc(al.titulo) + '»</h3>' +
      '<div class="field" data-field="calificacion"><label>Calificación</label><div class="star-picker" id="rv-stars" role="radiogroup" aria-label="Calificación de 1 a 5 estrellas">' +
      [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" data-star="' + n + '" role="radio" aria-label="' + plural(n, 'estrella', 'estrellas') + '">★</button>'; }).join('') + '</div><div class="err"></div></div>' +
      '<div class="field" data-field="comentario"><label for="rv-text">Tu reseña (opcional)</label><textarea id="rv-text" rows="4" maxlength="1000" placeholder="¿Qué te pareció el álbum?">' + esc(ex && ex.comentario || '') + '</textarea>' +
      '<div class="char-count" id="rv-count"></div><div class="err"></div></div>' +
      (ex ? '' : '<p class="small muted" style="margin-bottom:12px;">Tu reseña se publicará cuando un administrador la apruebe.</p>') +
      '<div class="form-error" style="display:none;"></div><div class="modal-actions"><button class="btn btn-ghost" data-c="no">Cancelar</button><button class="btn btn-primary" data-c="yes">' + (ex ? 'Guardar cambios' : 'Publicar reseña') + '</button></div>');
    function paint() { $$('[data-star]', m).forEach(function (b) { b.classList.toggle('on', Number(b.dataset.star) <= rating); b.setAttribute('aria-checked', Number(b.dataset.star) === rating ? 'true' : 'false'); }); }
    function count() { $('#rv-count', m).textContent = $('#rv-text', m).value.length + ' / 1000'; }
    paint(); count();
    $('#rv-stars', m).onclick = function (e) { var b = e.target.closest('[data-star]'); if (b) { rating = Number(b.dataset.star); paint(); } };
    $('#rv-text', m).oninput = count;
    $('[data-c="no"]', m).onclick = closeModal;
    var busy = false;
    $('[data-c="yes"]', m).onclick = async function () {
      if (busy) return; busy = true;
      var res = await api.write('guardarResena', { id_album: idAlbum, calificacion: rating, comentario: $('#rv-text', m).value });
      busy = false;
      if (!res.ok) return handleFail(m, res);
      closeModal();
      toast(res.accion === 'creada' ? 'Reseña enviada. Se publicará cuando un administrador la apruebe.' : 'Reseña actualizada.');
      refresh();
    };
  }

  function openReportModal(idResena) {
    var m = openModal('<h3>Reportar reseña</h3><div class="field" data-field="motivo"><label for="rp-motivo">¿Por qué la reportas?</label>' +
      '<textarea id="rp-motivo" rows="3" maxlength="255" placeholder="Lenguaje ofensivo, spam…"></textarea><div class="err"></div></div>' +
      '<div class="form-error" style="display:none;"></div><div class="modal-actions"><button class="btn btn-ghost" data-c="no">Cancelar</button><button class="btn btn-bad" data-c="yes">Enviar reporte</button></div>');
    $('[data-c="no"]', m).onclick = closeModal;
    $('[data-c="yes"]', m).onclick = async function () {
      var res = await api.write('crearReporte', { id_resena: idResena, motivo: $('#rp-motivo', m).value });
      if (!res.ok) return handleFail(m, res);
      closeModal(); toast('Reporte enviado. Un administrador lo revisará.');
    };
  }

  async function openAddToList(a) {
    async function draw() {
      var ls = await api.read('listas', {}, []);
      var m = openModal('<h3>Añadir «' + esc(a.titulo) + '» a una lista</h3>' + (ls.length ? ls.map(function (l) {
        var ya = l.albumes.some(function (x) { return x.id_album === a.id_album; });
        return '<div class="modal-list-item"><span>' + esc(l.nombre) + ' <span class="muted small">(' + plural(l.albumes.length, 'álbum', 'álbumes') + ')</span></span>' +
          '<button class="btn btn-sm ' + (ya ? 'btn-ghost' : 'btn-primary') + '" data-l="' + Number(l.id_lista) + '"' + (ya ? ' disabled' : '') + '>' + (ya ? 'Ya está' : 'Añadir') + '</button></div>';
      }).join('') : '<p class="empty-note">Todavía no tienes listas.</p>') +
        '<div class="modal-actions"><button class="btn btn-ghost" data-c="no">Cerrar</button><button class="btn btn-violet" data-c="new">+ Nueva lista</button></div>');
      $('[data-c="no"]', m).onclick = closeModal;
      $('[data-c="new"]', m).onclick = function () {
        textDialog({ title: 'Nueva lista', label: 'Nombre de la lista', placeholder: 'Ej. Para el viaje', ok: 'Crear y añadir' }, async function (v) {
          var res = await api.write('crearLista', { nombre: v, id_album: a.id_album });
          if (res.ok) toast('Lista «' + v.trim() + '» creada y álbum añadido.');
          return res;
        });
      };
      $$('[data-l]', m).forEach(function (b) {
        b.onclick = async function () {
          var res = await api.write('agregarALista', { id_lista: Number(b.dataset.l), id_album: a.id_album });
          if (!res.ok) return toast(res.error);
          toast('Añadido a «' + res.lista.nombre + '».'); draw();
        };
      });
    }
    await draw();
  }

  async function viewArtista(id, u, my) {
    var d = await api.read('detalleArtista', { id: Number(id) });
    if (my !== routeSeq) return;
    if (!d) { view.innerHTML = '<div class="wrap wrap-narrow"><h2>No encontramos a ese artista</h2><p style="margin-top:16px;"><a class="btn btn-primary" href="#catalogo">Volver al catálogo</a></p></div>'; return; }
    var ar = d.artista;
    view.innerHTML = '<div class="wrap wrap-narrow"><div class="eyebrow">' + esc(ar.genero) + (ar.pais ? ' · ' + esc(ar.pais) : '') + '</div>' +
      '<h1 style="font-size:2rem;margin-bottom:14px;">' + esc(ar.nombre) + '</h1>' +
      '<p class="muted" style="max-width:560px;line-height:1.6;margin-bottom:30px;">' + esc(ar.biografia || 'Aún no hay una biografía disponible.') + '</p>' +
      '<div class="section-head" style="margin-top:0;"><h2>Discografía</h2><a class="see-all" href="#catalogo">Catálogo</a></div><div class="grid grid-4">' + cards(d.albumes, 'Este artista aún no tiene álbumes.') + '</div></div>';
  }

  var FAQ = [
    ['¿Necesito una cuenta para usar AlbumMatch?', 'Puedes explorar el catálogo sin registrarte. Para calificar, reseñar o guardar álbumes en listas necesitas iniciar sesión.'],
    ['¿Cómo puedo buscar un álbum específico?', 'Usa la barra de búsqueda del Inicio o del Catálogo. Puedes filtrar por género, año o calificación.'],
    ['¿Cómo califico y reseño un álbum?', 'Entra al detalle del álbum y elige de 1 a 5 estrellas; el comentario es opcional. Tu reseña se publica cuando un administrador la aprueba.'],
    ['¿Puedo editar o eliminar mis reseñas?', 'Sí, desde tu perfil en «Mis reseñas y calificaciones» puedes editarlas o eliminarlas cuando quieras.']
  ];
  function viewAyuda() {
    view.innerHTML = '<div class="wrap wrap-narrow"><h1 style="font-size:1.8rem;margin-bottom:14px;">Ayuda y preguntas frecuentes</h1>' +
      '<p class="muted" style="line-height:1.6;margin-bottom:30px;">AlbumMatch es un catálogo colaborativo de música: puedes explorar álbumes, calificarlos y escribir reseñas. Con una cuenta puedes armar listas propias y recibir recomendaciones según tus géneros favoritos. Sin cuenta puedes navegar el catálogo y leer reseñas de forma libre.</p>' +
      FAQ.map(function (f, i) {
        return '<div class="faq-item' + (i === 0 ? ' open' : '') + '"><div class="faq-q" tabindex="0" role="button" aria-expanded="' + (i === 0) + '">' + esc(f[0]) + '</div><div class="faq-a">' + esc(f[1]) + '</div></div>';
      }).join('') +
      '<div class="divider"></div><h3 style="font-size:1rem;margin-bottom:6px;">Contacto</h3><p class="small muted">¿Alguna otra pregunta? Escríbenos a <a href="mailto:soporte@albummatch.com" class="link">soporte@albummatch.com</a>.</p></div>';
    function toggle(q) {
      var it = q.parentNode, was = it.classList.contains('open');
      $$('.faq-item', view).forEach(function (o) { o.classList.remove('open'); $('.faq-q', o).setAttribute('aria-expanded', 'false'); });
      if (!was) { it.classList.add('open'); q.setAttribute('aria-expanded', 'true'); }
    }
    view.onclick = function (e) { var q = e.target.closest('.faq-q'); if (q) toggle(q); };
    view.onkeydown = function (e) { var q = e.target.closest('.faq-q'); if (q && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(q); } };
  }

  async function viewAcerca(_, u, my) {
    var s = await api.read('acerca', {}, { albumes: 0, usuarios: 0 });
    if (my !== routeSeq) return;
    view.innerHTML = '<div class="wrap wrap-narrow"><div class="eyebrow">Quiénes somos</div><h1 style="font-size:1.8rem;margin-bottom:14px;">Acerca de AlbumMatch</h1>' +
      '<p class="muted" style="line-height:1.7;margin-bottom:12px;">AlbumMatch nació de una idea simple: encontrar el próximo álbum que amarás no debería depender únicamente de algoritmos de streaming. Somos un catálogo colaborativo donde personas reales califican, reseñan y comparten los discos que marcaron su forma de escuchar música.</p>' +
      '<p class="muted" style="line-height:1.7;margin-bottom:28px;">Desde nuestros inicios como un pequeño proyecto entre amantes de la música, hemos crecido hasta convertirnos en un espacio donde coleccionistas, curiosos y artistas emergentes se encuentran para documentar la historia de sus sonidos favoritos, género a género, año a año.</p>' +
      '<div class="grid grid-3" style="margin-bottom:34px;"><div class="kpi" style="text-align:center;"><div class="num">' + s.albumes + '</div><div class="label">Álbumes catalogados</div></div>' +
      '<div class="kpi" style="text-align:center;"><div class="num">' + s.usuarios + '</div><div class="label">Usuarios activos</div></div>' +
      '<div class="kpi" style="text-align:center;"><div class="num">2019</div><div class="label">Año de fundación</div></div></div>' +
      '<h3 style="font-size:1.05rem;margin-bottom:14px;">Nuestra misión</h3><div class="grid grid-3">' +
      '<div class="panel"><h4 style="font-size:.95rem;margin-bottom:6px;">Descubrimiento honesto</h4><p class="small muted">Recomendaciones basadas en reseñas reales de la comunidad, no en publicidad pagada.</p></div>' +
      '<div class="panel"><h4 style="font-size:.95rem;margin-bottom:6px;">Comunidad colaborativa</h4><p class="small muted">Cada calificación y reseña construye un catálogo más completo para todos.</p></div>' +
      '<div class="panel"><h4 style="font-size:.95rem;margin-bottom:6px;">Apoyo a artistas</h4><p class="small muted">Damos visibilidad a artistas independientes junto a los grandes nombres de la industria.</p></div></div>' +
      '<div class="divider" style="margin-top:34px;"></div><h3 style="font-size:1rem;margin-bottom:6px;">Contacto del equipo</h3><p class="small muted">Escríbenos a <a href="mailto:soporte@albummatch.com" class="link">soporte@albummatch.com</a>.</p></div>';
  }

  /* =====================================================================
     AUTENTICACIÓN (propuesta A: dividida · propuesta B: única)
     ===================================================================== */
  function demoBox() {
    return api.mode !== 'demo' ? '' : '<details class="demo-box"><summary>Cuentas de prueba</summary><p style="margin-top:8px;line-height:1.7;">Contraseña de todas: <code>' + C.DEMO_PASSWORD + '</code><br>' +
      'Usuario: <code>marina@ejemplo.com</code> · Administrador: <code>admin@albummatch.com</code></p></details>';
  }
  var authBusy = false;
  async function doLogin(root, correo, pass, remember) {
    if (authBusy) return; authBusy = true;
    var res = await api.write('login', { correo: correo, password: pass, remember: !!remember });
    authBusy = false;
    if (!res.ok) return handleFail(root, res);
    toast('Sesión iniciada.'); afterLogin(res.usuario);
  }
  async function doRegister(root, o) {
    if (authBusy) return; authBusy = true;
    var res = await api.write('registrar', o);
    authBusy = false;
    if (!res.ok) return handleFail(root, res);
    toast('Cuenta creada. ¡Bienvenido/a!'); afterLogin(res.usuario);
  }
  function viewAuth() {
    view.innerHTML = '<div class="wrap" style="max-width:820px;padding-top:60px;"><h2 style="text-align:center;font-size:1.5rem;margin-bottom:30px;">Crea tu cuenta o inicia sesión</h2><div class="auth-split">' +
      '<form class="auth-card" id="f-login" novalidate><h3>Iniciar sesión</h3>' + field('correo', 'login-email', 'Correo electrónico', 'email', 'tu@ejemplo.com', '', ' autocomplete="username"') +
      field('password', 'login-pass', 'Contraseña', 'password', '••••••••', '', ' autocomplete="current-password"') +
      '<div class="form-error" style="display:none;"></div><div style="margin-bottom:18px;"><button type="button" class="linklike" id="forgot">¿Olvidaste tu contraseña?</button></div>' +
      '<button class="btn btn-primary" type="submit" style="width:100%;justify-content:center;">Iniciar sesión</button></form>' +
      '<form class="auth-card" id="f-reg" novalidate><h3>Registrarse</h3>' + field('nombre_usuario', 'reg-user', 'Nombre de usuario', 'text', 'Nombre de usuario', '', ' maxlength="30" autocomplete="username"') +
      field('correo', 'reg-email', 'Correo electrónico', 'email', 'tu@ejemplo.com', '', ' autocomplete="email"') +
      field('password', 'reg-pass', 'Contraseña (mínimo 8 caracteres)', 'password', '••••••••', '', ' autocomplete="new-password"') +
      field('password2', 'reg-pass2', 'Confirmar contraseña', 'password', '••••••••', '', ' autocomplete="new-password"') +
      '<button class="btn btn-good" type="submit" style="width:100%;justify-content:center;">Registrarse</button></form></div>' + demoBox() + '</div>';
    $('#f-login').onsubmit = function (e) { e.preventDefault(); doLogin(this, $('#login-email').value, $('#login-pass').value, false); };
    $('#f-reg').onsubmit = function (e) {
      e.preventDefault();
      doRegister(this, { nombre_usuario: $('#reg-user').value, correo: $('#reg-email').value, password: $('#reg-pass').value, password2: $('#reg-pass2').value });
    };
    $('#forgot').onclick = function () { toast('La recuperación de contraseña por correo llegará en una próxima versión.'); };
  }

  var singleMode = 'login';
  function viewAuthSingle() {
    var reg = singleMode === 'register';
    view.innerHTML = '<div class="wrap" style="padding-top:60px;"><form class="auth-single" id="f-single" novalidate><div class="toggle-pair" role="tablist">' +
      '<button type="button" class="t' + (reg ? '' : ' on') + '" data-mode="login" role="tab" aria-selected="' + !reg + '" style="border:none;font-family:inherit;">Iniciar sesión</button>' +
      '<button type="button" class="t' + (reg ? ' on' : '') + '" data-mode="register" role="tab" aria-selected="' + reg + '" style="border:none;font-family:inherit;">Crear cuenta</button></div>' +
      (reg ? field('nombre_usuario', 's-user', 'Nombre de usuario', 'text', 'Nombre de usuario', '', ' maxlength="30"') : '') +
      field('correo', 's-email', 'Correo electrónico', 'email', 'tu@ejemplo.com', '') + field('password', 's-pass', 'Contraseña', 'password', '••••••••', '') +
      (reg ? field('password2', 's-pass2', 'Confirmar contraseña', 'password', '••••••••', '') :
        '<div class="checkline"><label style="display:flex;gap:8px;align-items:center;"><input type="checkbox" id="s-remember"> Recordarme</label><span style="flex:1;"></span><button type="button" class="linklike" id="forgot">¿Olvidaste tu contraseña?</button></div>') +
      '<div class="form-error" style="display:none;"></div>' +
      '<button class="btn btn-primary" type="submit" style="width:100%;justify-content:center;margin-bottom:10px;">' + (reg ? 'Crear cuenta' : 'Iniciar sesión') + '</button>' +
      '<button type="button" class="btn btn-ghost" data-mode="' + (reg ? 'login' : 'register') + '" style="width:100%;justify-content:center;">' + (reg ? 'Ya tengo una cuenta' : 'Crear nueva cuenta') + '</button></form>' + demoBox() + '</div>';
    view.onclick = function (e) { var b = e.target.closest('[data-mode]'); if (b) { singleMode = b.dataset.mode; viewAuthSingle(); } };
    var fg = $('#forgot'); if (fg) fg.onclick = function () { toast('La recuperación de contraseña por correo llegará en una próxima versión.'); };
    $('#f-single').onsubmit = function (e) {
      e.preventDefault();
      if (reg) doRegister(this, { nombre_usuario: $('#s-user').value, correo: $('#s-email').value, password: $('#s-pass').value, password2: $('#s-pass2').value });
      else doLogin(this, $('#s-email').value, $('#s-pass').value, $('#s-remember').checked);
    };
  }

  /* =====================================================================
     ÁREA DEL USUARIO
     ===================================================================== */
  async function viewPerfil(_, u, my) {
    var favs = await api.read('generosFavoritos', {}, []);
    if (my !== routeSeq) return;
    view.innerHTML = '<div class="wrap wrap-narrow"><div class="profile-head"><div class="avatar">' + (u.avatar_url ? '<img src="' + esc(u.avatar_url) + '" alt="Foto de perfil">' : '') + '</div><div>' +
      '<h2 style="font-size:1.4rem;">' + esc(u.nombre_usuario) + '</h2><p class="profile-bio">' + esc(u.biografia || 'Aún no has escrito tu biografía.') + '</p>' +
      '<div>' + (favs.length ? favs.map(function (g) { return '<span class="tag">' + esc(g.nombre) + '</span>'; }).join('') : '<span class="small muted">Sin géneros favoritos todavía.</span>') + '</div>' +
      '<button class="btn btn-ghost btn-sm" id="btn-edit" style="margin-top:14px;">Editar perfil</button></div></div>' +
      '<div class="grid grid-3" style="margin-top:36px;">' +
      '<div class="panel"><h4 style="font-size:1rem;margin-bottom:6px;">Mis listas</h4><p class="small muted" style="margin-bottom:16px;">Organiza tus álbumes por escuchar, favoritos e historial.</p><a class="btn btn-ghost btn-sm" href="#listas">Ver mis listas</a></div>' +
      '<div class="panel"><h4 style="font-size:1rem;margin-bottom:6px;">Mis reseñas y calificaciones</h4><p class="small muted" style="margin-bottom:16px;">Consulta el historial de todas tus reseñas y calificaciones.</p><a class="btn btn-ghost btn-sm" href="#resenas">Ver mis reseñas</a></div>' +
      '<div class="panel"><h4 style="font-size:1rem;margin-bottom:6px;">Recomendaciones</h4><p class="small muted" style="margin-bottom:16px;">Descubre álbumes sugeridos según tus géneros favoritos.</p><a class="btn btn-ghost btn-sm" href="#recomendaciones">Ver recomendaciones</a></div></div></div>';
    $$('.avatar img', view).forEach(function (img) { img.addEventListener('error', function () { img.remove(); }); });
    $('#btn-edit').onclick = function () { openEditPerfil(u); };
  }
  async function openEditPerfil(u) {
    var d = await Promise.all([api.read('generosFavoritos', {}, []), api.read('generos', {}, [])]);
    var favIds = d[0].map(function (g) { return g.id_genero; });
    var m = openModal('<h3>Editar perfil</h3><div class="field" data-field="biografia"><label for="pf-bio">Biografía (máx. 300 caracteres)</label><textarea id="pf-bio" rows="4" maxlength="300">' + esc(u.biografia || '') + '</textarea><div class="err"></div></div>' +
      field('avatar_url', 'pf-av', 'Avatar (URL de una imagen, opcional)', 'text', 'https://…', u.avatar_url || '') +
      '<div class="field"><label>Géneros favoritos</label><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' + d[1].map(function (g) {
        return '<label class="checkline" style="margin:0;"><input type="checkbox" class="pf-gen" value="' + Number(g.id_genero) + '"' + (favIds.indexOf(g.id_genero) >= 0 ? ' checked' : '') + '> ' + esc(g.nombre) + '</label>';
      }).join('') + '</div></div><div class="form-error" style="display:none;"></div>' +
      '<div class="modal-actions"><button class="btn btn-ghost" data-c="no">Cancelar</button><button class="btn btn-primary" data-c="yes">Guardar cambios</button></div>');
    $('[data-c="no"]', m).onclick = closeModal;
    $('[data-c="yes"]', m).onclick = async function () {
      var res = await api.write('actualizarPerfil', { biografia: $('#pf-bio', m).value, avatar_url: $('#pf-av', m).value,
        generos: $$('.pf-gen:checked', m).map(function (c) { return Number(c.value); }) });
      if (!res.ok) return handleFail(m, res);
      closeModal(); toast('Perfil actualizado.'); refresh();
    };
  }

  async function viewListas(_, u, my) {
    async function draw() {
      var ls = await api.read('listas', {}, []);
      var grid = $('#listas-grid'); if (!grid || my !== routeSeq) return ls;
      grid.innerHTML = ls.length ? ls.map(function (l) {
        return '<div class="list-card"><h4>' + esc(l.nombre) + '</h4><div class="count">' + plural(l.albumes.length, 'álbum', 'álbumes') + '</div><div class="mini-covers">' +
          l.albumes.slice(0, 4).map(function (a) { return '<div class="cover" style="--h:' + Number(a.portada_hue) + ';"></div>'; }).join('') + '</div>' +
          '<button class="linklike" data-act="open" data-id="' + Number(l.id_lista) + '">Ver todos</button></div>';
      }).join('') : '<p class="empty-note">Todavía no has creado ninguna lista.</p>';
      return ls;
    }
    view.innerHTML = '<div class="wrap"><div class="section-head" style="margin-top:0;"><h2>Mis listas de álbumes</h2><button class="btn btn-primary btn-sm" id="btn-new">+ Crear nueva lista</button></div><div class="grid grid-4" id="listas-grid"></div></div>';
    await draw();
    if (my !== routeSeq) return;
    $('#btn-new').onclick = function () {
      textDialog({ title: 'Crear nueva lista', label: 'Nombre de la lista', placeholder: 'Ej. Para el viaje', ok: 'Crear lista' }, async function (v) {
        var res = await api.write('crearLista', { nombre: v }); if (res.ok) { toast('Lista «' + v.trim() + '» creada.'); draw(); } return res;
      });
    };
    view.onclick = function (e) { var b = e.target.closest('[data-act="open"]'); if (b) openLista(Number(b.dataset.id)); };
    async function openLista(id) {
      var ls = await api.read('listas', {}, []);
      var l = ls.filter(function (x) { return x.id_lista === id; })[0];
      if (!l) { closeModal(); draw(); return; }
      var m = openModal('<h3>' + esc(l.nombre) + '</h3><div style="max-height:300px;overflow:auto;margin-bottom:14px;">' + (l.albumes.length ? l.albumes.map(function (a) {
        return '<div class="modal-list-item"><span><a class="link" href="#album/' + Number(a.id_album) + '" data-close>' + esc(a.titulo) + '</a> <span class="muted small">— ' + esc(a.artista) + '</span></span><button class="btn btn-bad btn-sm" data-q="' + Number(a.id_album) + '">Quitar</button></div>';
      }).join('') : '<p class="empty-note">Esta lista está vacía.</p>') + '</div>' +
        '<div class="modal-actions">' + (l.predeterminada ? '' : '<button class="btn btn-ghost" data-c="ren">Renombrar</button><button class="btn btn-bad" data-c="del">Eliminar lista</button>') + '<button class="btn btn-ghost" data-c="no">Cerrar</button></div>' +
        (l.predeterminada ? '<p class="small muted" style="margin-top:12px;">Las listas predeterminadas no se pueden renombrar ni eliminar.</p>' : ''));
      $('[data-c="no"]', m).onclick = closeModal;
      $$('[data-close]', m).forEach(function (a) { a.addEventListener('click', closeModal); });
      $$('[data-q]', m).forEach(function (b) { b.onclick = async function () { await api.write('quitarDeLista', { id_lista: id, id_album: Number(b.dataset.q) }); draw(); openLista(id); }; });
      if (!l.predeterminada) {
        $('[data-c="ren"]', m).onclick = function () {
          textDialog({ title: 'Renombrar lista', label: 'Nuevo nombre', value: l.nombre }, async function (v) {
            var res = await api.write('renombrarLista', { id_lista: id, nombre: v }); if (res.ok) { toast('Lista renombrada.'); draw(); } return res;
          });
        };
        $('[data-c="del"]', m).onclick = function () {
          confirmDialog({ title: 'Eliminar lista', message: '¿Eliminar la lista «' + l.nombre + '»? Los álbumes no se borran del catálogo.', ok: 'Eliminar', danger: true }, async function () {
            await api.write('eliminarLista', { id_lista: id }); toast('Lista eliminada.'); draw();
          });
        };
      }
    }
  }

  async function viewResenas(_, u, my) {
    var list = await api.read('misResenas', {}, []);
    if (my !== routeSeq) return;
    var pill = { Pendiente: 'pill-pending', Aprobada: 'pill-good', Rechazada: 'pill-bad' };
    view.innerHTML = '<div class="wrap"><h2 style="margin-bottom:18px;">Mis reseñas y calificaciones</h2>' + (list.length ?
      '<div class="panel panel-tight table-wrap"><table><thead><tr><th>Álbum</th><th>Calificación</th><th>Reseña</th><th>Estado</th><th>Fecha</th><th>Acciones</th></tr></thead><tbody>' + list.map(function (r) {
        return '<tr><td class="strong"><a class="link" href="#album/' + Number(r.id_album) + '">' + esc(r.titulo) + '</a></td><td class="stars">' + starString(r.calificacion) + '</td>' +
          '<td style="max-width:280px;">' + esc(r.comentario || '—') + '</td><td><span class="pill ' + pill[r.estado] + '">' + esc(r.estado) + '</span></td>' +
          '<td>' + fmtDate(r.fecha_edicion || r.fecha_publicacion) + (r.fecha_edicion ? ' <span class="small" title="Fecha de edición">(editada)</span>' : '') + '</td>' +
          '<td class="row-actions"><button class="btn btn-ghost btn-sm" data-act="edit" data-id="' + Number(r.id_album) + '">Editar</button><button class="btn btn-bad btn-sm" data-act="del" data-id="' + Number(r.id_resena) + '">Eliminar</button></td></tr>';
      }).join('') + '</tbody></table></div>' :
      '<p class="empty-note">Todavía no has escrito reseñas. Explora el <a href="#catalogo">catálogo</a> y califica tu primer álbum.</p>') + '</div>';
    view.onclick = function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'edit') openReviewModal(Number(b.dataset.id));
      if (b.dataset.act === 'del') {
        confirmDialog({ title: 'Eliminar reseña', message: '¿Eliminar esta reseña? El promedio del álbum se recalculará.', ok: 'Eliminar', danger: true }, async function () {
          var res = await api.write('eliminarResena', { id_resena: Number(b.dataset.id) });
          toast(res.ok ? 'Reseña eliminada.' : res.error); refresh();
        });
      }
    };
  }

  async function viewReco(_, u, my) {
    var r = await api.read('recomendaciones', {}, { generos: [], albumes: [] });
    if (my !== routeSeq) return;
    if (!r.generos.length) {
      view.innerHTML = '<div class="wrap"><h2 style="margin-bottom:4px;">Recomendaciones para ti</h2><p class="small muted" style="margin-bottom:26px;">Aún no has elegido géneros favoritos.</p>' +
        '<div class="empty-note">Elige tus géneros favoritos para recibir recomendaciones. <button class="btn btn-primary btn-sm" id="reco-edit" style="margin-left:10px;">Editar perfil</button></div></div>';
      $('#reco-edit').onclick = function () { openEditPerfil(u); };
      return;
    }
    view.innerHTML = '<div class="wrap"><h2 style="margin-bottom:4px;">Recomendaciones para ti</h2><p class="small muted" style="margin-bottom:26px;">Basado en tus géneros favoritos: ' + esc(r.generos.join(', ')) + '</p>' +
      '<div class="grid grid-5">' + cards(r.albumes, 'Ya reseñaste todos los álbumes de tus géneros favoritos. ¡Prueba con otros géneros desde tu perfil!') + '</div></div>';
  }

  /* =====================================================================
     ADMINISTRADOR
     ===================================================================== */
  async function viewAdmin(_, u, my) {
    var d = await Promise.all([api.read('kpis', {}, { albumes: 0, usuarios: 0, pendientes: 0 }), api.read('actividad', { n: 5 }, [])]);
    if (my !== routeSeq) return;
    var k = d[0];
    view.innerHTML = '<div class="wrap"><h2 style="margin-bottom:22px;">Panel de administración</h2><div class="grid grid-3" style="margin-bottom:36px;">' +
      '<a class="kpi accent" href="#admin-albumes"><div class="num">' + k.albumes + '</div><div class="label">Total de álbumes</div></a>' +
      '<a class="kpi violet" href="#moderacion"><div class="num">' + k.usuarios + '</div><div class="label">Usuarios registrados</div></a>' +
      '<a class="kpi good" href="#moderacion"><div class="num">' + k.pendientes + '</div><div class="label">Reseñas pendientes</div></a></div>' +
      '<div class="grid grid-2"><div class="panel"><h4 style="font-size:1rem;margin-bottom:14px;">Actividad reciente</h4>' + (d[1].length ? d[1].map(function (b) {
        return '<div class="review"><p class="review-text">' + esc(b.detalle) + '</p><div class="review-meta"><span>' + esc(b.fecha) + '</span></div></div>';
      }).join('') : '<p class="empty-note">Sin actividad todavía.</p>') + '</div><div class="panel"><h4 style="font-size:1rem;margin-bottom:14px;">Accesos rápidos</h4><div class="grid grid-2" style="gap:12px;">' +
      '<a class="btn btn-ghost" href="#admin-albumes">Gestión de álbumes</a><a class="btn btn-ghost" href="#admin-artistas">Gestión de artistas</a><a class="btn btn-ghost" href="#moderacion">Moderación</a>' +
      '<button class="btn btn-ghost" id="btn-rep" style="justify-content:flex-start;">Reportes</button></div></div></div></div>';
    $('#btn-rep').onclick = async function () {
      var top = await api.read('topCalificados', { n: 10 }, []);
      var m = openModal('<h3>Álbumes con más calificaciones</h3><div class="table-wrap"><table><thead><tr><th>#</th><th>Álbum</th><th>Artista</th><th>Reseñas</th><th>Promedio</th></tr></thead><tbody>' +
        top.map(function (a, i) {
          return '<tr><td>' + (i + 1) + '</td><td class="strong">' + esc(a.titulo) + '</td><td>' + esc(a.artista) + '</td><td>' + a.total_resenas + '</td><td>' + (a.promedio === null ? '—' : a.promedio.toFixed(1)) + '</td></tr>';
        }).join('') + '</tbody></table></div><div class="modal-actions"><button class="btn btn-ghost" data-c="no">Cerrar</button></div>');
      $('[data-c="no"]', m).onclick = closeModal;
    };
  }

  async function viewAdminAlbumes(_, u, my) {
    var d = await Promise.all([api.read('generos', {}, []), api.read('anios', {}, [])]);
    if (my !== routeSeq) return;
    view.innerHTML = '<div class="wrap"><div class="section-head" style="margin-top:0;"><h2>Gestión de álbumes</h2><div style="display:flex;gap:10px;"><button class="btn btn-ghost btn-sm" id="btn-gen">Géneros</button><button class="btn btn-primary btn-sm" id="btn-add">+ Añadir nuevo álbum</button></div></div>' +
      '<div class="filterbar" style="margin-bottom:20px;"><input type="text" id="aa-q" placeholder="Buscar álbum…" aria-label="Buscar álbum"><select class="select" id="aa-g" aria-label="Género">' + opts('Género', d[0], 'id_genero', 'nombre') + '</select>' +
      '<select class="select" id="aa-y" aria-label="Año">' + yearOpts(d[1]) + '</select></div>' +
      '<div class="panel panel-tight table-wrap"><table><thead><tr><th>Título</th><th>Artista</th><th>Género</th><th>Año</th><th>Acciones</th></tr></thead><tbody id="aa-body"></tbody></table></div><p class="empty-note" id="aa-empty" style="display:none;">No hay álbumes que coincidan con la búsqueda.</p></div>';
    var rows = [], seq = 0;
    async function draw() {
      var n = ++seq;
      var list = await api.read('buscar', { q: $('#aa-q').value, id_genero: $('#aa-g').value, anio: $('#aa-y').value }, []);
      var body = $('#aa-body'); if (n !== seq || my !== routeSeq || !body) return;
      rows = list;
      body.innerHTML = list.map(function (a) {
        return '<tr><td class="strong">' + esc(a.titulo) + '</td><td>' + esc(a.artista) + '</td><td>' + esc(a.genero) + '</td><td>' + a.anio_lanzamiento + '</td><td class="row-actions">' +
          '<button class="btn btn-ghost btn-sm" data-act="songs" data-id="' + Number(a.id_album) + '">Canciones</button><button class="btn btn-ghost btn-sm" data-act="edit" data-id="' + Number(a.id_album) + '">Editar</button><button class="btn btn-bad btn-sm" data-act="del" data-id="' + Number(a.id_album) + '">Eliminar</button></td></tr>';
      }).join('');
      $('#aa-empty').style.display = list.length ? 'none' : 'block';
    }
    await draw();
    if (my !== routeSeq) return;
    view.oninput = draw;
    view.onchange = function (e) { if (e.target.tagName === 'SELECT') draw(); };
    $('#btn-add').onclick = function () { openAlbumForm(null, draw); };
    $('#btn-gen').onclick = function () { openGeneros(); };
    view.onclick = function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      var id = Number(b.dataset.id), a = rows.filter(function (x) { return x.id_album === id; })[0];
      if (!a) return;
      if (b.dataset.act === 'songs') openCanciones(a);
      if (b.dataset.act === 'edit') openAlbumForm(a, draw);
      if (b.dataset.act === 'del') confirmDialog({ title: 'Eliminar álbum', message: '¿Eliminar «' + a.titulo + '»? También se eliminarán sus canciones, sus reseñas y su presencia en listas. No se puede deshacer.', ok: 'Eliminar', danger: true }, async function () {
        var res = await api.write('eliminarAlbum', { id_album: id }); toast(res.ok ? 'Álbum eliminado.' : res.error); draw();
      });
    };
  }

  async function openAlbumForm(a, done) {
    var artistas = await api.read('artistas', {}, []);
    if (!artistas.length) return toast('Primero registra al menos un artista.');
    var hue = a ? Number(a.portada_hue) : Math.floor(Math.random() * 361);
    var sel = a ? a.id_artista : artistas[0].id_artista;
    var m = openModal('<h3>' + (a ? 'Editar álbum' : 'Añadir nuevo álbum') + '</h3>' + field('titulo', 'af-t', 'Título', 'text', 'Título del álbum', a ? a.titulo : '', ' maxlength="100"') +
      '<div class="field" data-field="id_artista"><label for="af-a">Artista</label><select id="af-a">' + artistas.map(function (x) { return '<option value="' + Number(x.id_artista) + '"' + (x.id_artista === sel ? ' selected' : '') + '>' + esc(x.nombre) + '</option>'; }).join('') + '</select>' +
      '<div class="small muted" id="af-g"></div><div class="err"></div></div>' + field('anio', 'af-y', 'Año de lanzamiento', 'number', '', a ? a.anio_lanzamiento : new Date().getFullYear(), ' min="1900" max="2100"') +
      '<div class="field" data-field="hue"><label for="af-h">Tono de portada (0 a 360)</label><div style="display:flex;gap:14px;align-items:center;"><input type="range" id="af-h" min="0" max="360" value="' + hue + '" style="flex:1;"><div class="cover hue-preview" id="af-p" style="--h:' + hue + ';"></div></div><div class="err"></div></div>' +
      '<div class="form-error" style="display:none;"></div><div class="modal-actions"><button class="btn btn-ghost" data-c="no">Cancelar</button><button class="btn btn-primary" data-c="yes">' + (a ? 'Guardar cambios' : 'Añadir álbum') + '</button></div>');
    function genre() { var ar = artistas.filter(function (x) { return x.id_artista === Number($('#af-a', m).value); })[0]; $('#af-g', m).textContent = 'Género: ' + ar.genero + ' (el género del álbum es el de su artista)'; }
    genre();
    $('#af-a', m).onchange = genre;
    $('#af-h', m).oninput = function () { $('#af-p', m).style.setProperty('--h', this.value); };
    $('[data-c="no"]', m).onclick = closeModal;
    $('[data-c="yes"]', m).onclick = async function () {
      var res = await api.write('guardarAlbum', { id_album: a ? a.id_album : null, titulo: $('#af-t', m).value, id_artista: Number($('#af-a', m).value), anio: Number($('#af-y', m).value), hue: Number($('#af-h', m).value) });
      if (!res.ok) return handleFail(m, res);
      closeModal(); toast(a ? 'Álbum actualizado.' : 'Álbum añadido.'); done();
    };
  }

  async function openCanciones(a) {
    async function draw(editId) {
      var list = await api.read('canciones', { id_album: a.id_album }, []);
      var c = editId ? list.filter(function (x) { return x.id_cancion === editId; })[0] : null;
      var m = openModal('<h3>Canciones de «' + esc(a.titulo) + '»</h3><div style="max-height:220px;overflow:auto;margin-bottom:16px;">' + (list.length ? list.map(function (x) {
        return '<div class="modal-list-item"><span><span class="muted small">' + x.numero_pista + '.</span> ' + esc(x.titulo) + ' <span class="muted small">' + fmtDur(x.duracion_seg) + '</span>' + (Number(x.es_sencillo) ? ' <span class="tag" style="margin-left:6px;">Sencillo</span>' : '') + '</span>' +
          '<span><button class="btn btn-ghost btn-sm" data-e="' + Number(x.id_cancion) + '">Editar</button> <button class="btn btn-bad btn-sm" data-d="' + Number(x.id_cancion) + '">Eliminar</button></span></div>';
      }).join('') : '<p class="empty-note">Este álbum aún no tiene canciones.</p>') + '</div>' +
        field('titulo', 'sg-t', 'Título de la canción', 'text', '', c ? c.titulo : '', ' maxlength="100"') + field('duracion', 'sg-d', 'Duración (mm:ss)', 'text', '3:42', c ? fmtDur(c.duracion_seg) : '') +
        '<label class="checkline"><input type="checkbox" id="sg-s"' + (c && Number(c.es_sencillo) ? ' checked' : '') + '> Es sencillo</label><div class="form-error" style="display:none;"></div>' +
        '<div class="modal-actions"><button class="btn btn-ghost" data-c="no">Cerrar</button><button class="btn btn-primary" data-c="yes">' + (c ? 'Guardar canción' : 'Agregar canción') + '</button></div>');
      $('[data-c="no"]', m).onclick = closeModal;
      $$('[data-e]', m).forEach(function (b) { b.onclick = function () { draw(Number(b.dataset.e)); }; });
      $$('[data-d]', m).forEach(function (b) { b.onclick = async function () { await api.write('eliminarCancion', { id_cancion: Number(b.dataset.d) }); toast('Canción eliminada.'); draw(); }; });
      $('[data-c="yes"]', m).onclick = async function () {
        var res = await api.write('guardarCancion', { id_cancion: c ? c.id_cancion : null, id_album: a.id_album, titulo: $('#sg-t', m).value, duracion_seg: parseDur($('#sg-d', m).value), es_sencillo: $('#sg-s', m).checked });
        if (!res.ok) return handleFail(m, res);
        toast(c ? 'Canción actualizada.' : 'Canción agregada.'); draw();
      };
    }
    await draw();
  }

  async function openGeneros() {
    async function draw() {
      var gens = await api.read('generos', {}, []);
      var m = openModal('<h3>Géneros musicales</h3><div style="max-height:240px;overflow:auto;margin-bottom:16px;">' + gens.map(function (g) {
        return '<div class="modal-list-item"><span>' + esc(g.nombre) + '</span><span><button class="btn btn-ghost btn-sm" data-r="' + Number(g.id_genero) + '">Renombrar</button> <button class="btn btn-bad btn-sm" data-d="' + Number(g.id_genero) + '">Eliminar</button></span></div>';
      }).join('') + '</div>' + field('nombre', 'gn-n', 'Nuevo género', 'text', 'Ej. Jazz', '', ' maxlength="50"') + '<div class="form-error" style="display:none;"></div>' +
        '<div class="modal-actions"><button class="btn btn-ghost" data-c="no">Cerrar</button><button class="btn btn-primary" data-c="yes">Agregar género</button></div>');
      $('[data-c="no"]', m).onclick = function () { closeModal(); refresh(); };
      $('[data-c="yes"]', m).onclick = async function () {
        var res = await api.write('agregarGenero', { nombre: $('#gn-n', m).value });
        if (!res.ok) { if (res.code !== 'auth') showErrors(m, { nombre: res.error }); return; }
        toast('Género agregado.'); draw();
      };
      $$('[data-r]', m).forEach(function (b) {
        b.onclick = function () {
          var g = gens.filter(function (x) { return x.id_genero === Number(b.dataset.r); })[0];
          textDialog({ title: 'Renombrar género', label: 'Nuevo nombre', value: g.nombre, max: 50 }, async function (v) {
            var res = await api.write('renombrarGenero', { id_genero: g.id_genero, nombre: v });
            if (!res.ok) return { ok: false, code: res.code, error: res.error, errors: { nombre: res.error } };
            toast('Género renombrado.'); setTimeout(draw, 0); return res;
          });
        };
      });
      $$('[data-d]', m).forEach(function (b) {
        b.onclick = function () {
          var g = gens.filter(function (x) { return x.id_genero === Number(b.dataset.d); })[0];
          confirmDialog({ title: 'Eliminar género', message: '¿Eliminar el género «' + g.nombre + '»?', ok: 'Eliminar', danger: true }, async function () {
            var res = await api.write('eliminarGenero', { id_genero: g.id_genero });
            toast(res.ok ? 'Género eliminado.' : res.error); setTimeout(draw, 0);
          });
        };
      });
    }
    await draw();
  }

  async function viewAdminArtistas(_, u, my) {
    var gens = await api.read('generos', {}, []);
    if (my !== routeSeq) return;
    view.innerHTML = '<div class="wrap"><div class="section-head" style="margin-top:0;"><h2>Gestión de artistas</h2><button class="btn btn-primary btn-sm" id="btn-add">+ Añadir nuevo artista</button></div>' +
      '<div class="filterbar" style="margin-bottom:20px;"><input type="text" id="ar-q" placeholder="Buscar artista…" aria-label="Buscar artista"><select class="select" id="ar-g" aria-label="Género">' + opts('Género', gens, 'id_genero', 'nombre') + '</select></div>' +
      '<div class="panel panel-tight table-wrap"><table><thead><tr><th>Nombre</th><th>Género</th><th>País</th><th>Acciones</th></tr></thead><tbody id="ar-body"></tbody></table></div><p class="empty-note" id="ar-empty" style="display:none;">No hay artistas que coincidan con la búsqueda.</p></div>';
    var all = [];
    async function load() { all = await api.read('artistas', {}, []); paint(); }
    function paint() {
      var body = $('#ar-body'); if (!body || my !== routeSeq) return;
      var q = $('#ar-q').value.trim().toLowerCase(), g = $('#ar-g').value;
      var list = all.filter(function (a) { return (!q || a.nombre.toLowerCase().indexOf(q) >= 0) && (!g || a.id_genero === Number(g)); });
      body.innerHTML = list.map(function (a) {
        return '<tr><td class="strong">' + esc(a.nombre) + '</td><td>' + esc(a.genero) + '</td><td>' + esc(a.pais || '—') + '</td><td class="row-actions"><button class="btn btn-ghost btn-sm" data-act="edit" data-id="' + Number(a.id_artista) + '">Editar</button><button class="btn btn-bad btn-sm" data-act="del" data-id="' + Number(a.id_artista) + '">Eliminar</button></td></tr>';
      }).join('');
      $('#ar-empty').style.display = list.length ? 'none' : 'block';
    }
    await load();
    if (my !== routeSeq) return;
    view.oninput = paint;
    view.onchange = function (e) { if (e.target.tagName === 'SELECT') paint(); };
    $('#btn-add').onclick = function () { openArtistaForm(null, gens, load); };
    view.onclick = function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      var id = Number(b.dataset.id), a = all.filter(function (x) { return x.id_artista === id; })[0];
      if (!a) return;
      if (b.dataset.act === 'edit') openArtistaForm(a, gens, load);
      if (b.dataset.act === 'del') confirmDialog({ title: 'Eliminar artista', message: '¿Eliminar a «' + a.nombre + '»? No se puede deshacer.', ok: 'Eliminar', danger: true }, async function () {
        var res = await api.write('eliminarArtista', { id_artista: id }); toast(res.ok ? 'Artista eliminado.' : res.error); load();
      });
    };
  }
  function openArtistaForm(a, gens, done) {
    var m = openModal('<h3>' + (a ? 'Editar artista' : 'Añadir nuevo artista') + '</h3>' + field('nombre', 'at-n', 'Nombre (único)', 'text', 'Nombre del artista', a ? a.nombre : '', ' maxlength="100"') +
      '<div class="field" data-field="id_genero"><label for="at-g">Género principal</label><select id="at-g">' + opts('Elige un género', gens, 'id_genero', 'nombre', a ? a.id_genero : '') + '</select><div class="err"></div></div>' +
      field('pais', 'at-p', 'País de origen (opcional)', 'text', 'País', a && a.pais || '', ' maxlength="60"') +
      '<div class="field" data-field="biografia"><label for="at-b">Biografía corta (opcional)</label><textarea id="at-b" rows="3" maxlength="1000">' + esc(a && a.biografia || '') + '</textarea><div class="err"></div></div>' +
      '<div class="form-error" style="display:none;"></div><div class="modal-actions"><button class="btn btn-ghost" data-c="no">Cancelar</button><button class="btn btn-primary" data-c="yes">' + (a ? 'Guardar cambios' : 'Añadir artista') + '</button></div>');
    $('[data-c="no"]', m).onclick = closeModal;
    $('[data-c="yes"]', m).onclick = async function () {
      var res = await api.write('guardarArtista', { id_artista: a ? a.id_artista : null, nombre: $('#at-n', m).value, id_genero: Number($('#at-g', m).value) || null, pais: $('#at-p', m).value, biografia: $('#at-b', m).value });
      if (!res.ok) return handleFail(m, res);
      closeModal(); toast(a ? 'Artista actualizado.' : 'Artista añadido.'); done();
    };
  }

  async function viewModeracion(_, u, my) {
    async function draw() {
      var d = await Promise.all([api.read('pendientes', {}, []), api.read('reportesPendientes', {}, []), api.read('usuarios', {}, [])]);
      if (my !== routeSeq) return d;
      var pend = d[0], reps = d[1], cuentas = d[2];
      view.innerHTML = '<div class="wrap"><h2 style="margin-bottom:6px;">Moderación de contenido</h2><p class="small muted" style="margin-bottom:22px;">Reseñas pendientes de revisión</p>' +
        (pend.length ? '<div class="panel panel-tight table-wrap" style="margin-bottom:34px;"><table><thead><tr><th>Usuario</th><th>Álbum</th><th>Reseña</th><th>Acciones</th></tr></thead><tbody>' + pend.map(function (p) {
          return '<tr><td class="strong">' + esc(p.nombre_usuario) + '</td><td>' + esc(p.titulo) + '</td><td>' + starString(p.calificacion) + ' ' + esc(p.comentario || '') + '</td><td class="row-actions"><button class="btn btn-good btn-sm" data-act="ok" data-id="' + Number(p.id_resena) + '">Aprobar</button><button class="btn btn-bad btn-sm" data-act="no" data-id="' + Number(p.id_resena) + '">Rechazar</button></td></tr>';
        }).join('') + '</tbody></table></div>' : '<p class="empty-note" style="margin-bottom:34px;">No hay reseñas pendientes.</p>') +
        '<p class="small muted" style="margin-bottom:14px;">Reportes de usuarios</p>' +
        (reps.length ? '<div class="panel panel-tight table-wrap"><table><thead><tr><th>Reportado por</th><th>Tipo</th><th>Contenido</th><th>Acciones</th></tr></thead><tbody>' + reps.map(function (r) {
          return '<tr><td class="strong">' + esc(r.por) + '</td><td>' + esc(r.tipo) + '</td><td>' + esc(r.contenido) + '</td><td class="row-actions"><button class="btn btn-ghost btn-sm" data-act="view" data-id="' + Number(r.id_reporte) + '">' + (r.tipo === 'Reseña' ? 'Ver detalle' : 'Ver perfil') + '</button>' +
            '<button class="btn btn-bad btn-sm" data-act="' + (r.tipo === 'Reseña' ? 'del-resena' : 'suspend') + '" data-id="' + Number(r.id_reporte) + '">' + (r.tipo === 'Reseña' ? 'Eliminar' : 'Suspender') + '</button><button class="btn btn-ghost btn-sm" data-act="skip" data-id="' + Number(r.id_reporte) + '">Descartar</button></td></tr>';
        }).join('') + '</tbody></table></div>' : '<p class="empty-note">No hay reportes pendientes.</p>') +
        '<p class="small muted" style="margin:34px 0 14px;">Cuentas de usuarios</p><div class="panel panel-tight table-wrap"><table><thead><tr><th>Usuario</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>' + cuentas.map(function (c) {
          return '<tr><td class="strong">' + esc(c.nombre_usuario) + '</td><td>' + esc(c.correo) + '</td><td>' + esc(c.rol) + '</td><td>' + (c.activo ? '<span class="tag">Activa</span>' : '<span class="tag" style="background:transparent;color:var(--bad);border:1px solid var(--bad);">Suspendida</span>') + '</td><td class="row-actions">' +
            (c.rol === 'Administrador' ? '<span class="muted small">—</span>' : '<button class="btn ' + (c.activo ? 'btn-bad' : 'btn-good') + ' btn-sm" data-act="toggle" data-id="' + Number(c.id_usuario) + '">' + (c.activo ? 'Suspender' : 'Reactivar') + '</button>') + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
      return d;
    }
    var data = await draw();
    async function run(p, okMsg) { var res = await p; toast(res.ok ? okMsg : res.error); data = await draw(); }
    view.onclick = function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      var id = Number(b.dataset.id), act = b.dataset.act;
      if (act === 'ok') run(api.write('moderar', { id_resena: id, estado: 'Aprobada' }), 'Reseña aprobada.');
      if (act === 'no') run(api.write('moderar', { id_resena: id, estado: 'Rechazada' }), 'Reseña rechazada.');
      if (act === 'skip') run(api.write('atenderReporte', { id_reporte: id, accion: 'descartar' }), 'Reporte descartado.');
      if (act === 'toggle') {
        var c = data[2].filter(function (x) { return x.id_usuario === id; })[0];
        run(api.write('setActivo', { id_usuario: id, activo: !c.activo }), c.activo ? 'Cuenta suspendida.' : 'Cuenta reactivada.');
      }
      if (act === 'view') {
        var r = data[1].filter(function (x) { return x.id_reporte === id; })[0];
        var m = openModal('<h3>' + esc(r.tipo) + ' reportado por ' + esc(r.por) + '</h3><p class="muted small" style="line-height:1.6;">' + esc(r.contenido) + '</p><div class="modal-actions"><button class="btn btn-ghost" data-c="no">Cerrar</button></div>');
        $('[data-c="no"]', m).onclick = closeModal;
      }
      if (act === 'del-resena') confirmDialog({ title: 'Eliminar reseña', message: '¿Eliminar la reseña reportada? El reporte se da por atendido.', ok: 'Eliminar', danger: true }, function () { run(api.write('atenderReporte', { id_reporte: id, accion: 'eliminar' }), 'Reseña eliminada. Reporte atendido.'); });
      if (act === 'suspend') confirmDialog({ title: 'Suspender cuenta', message: 'La cuenta quedará suspendida (sin borrar su historial) y el reporte se dará por atendido.', ok: 'Suspender', danger: true }, function () { run(api.write('atenderReporte', { id_reporte: id, accion: 'suspender' }), 'Cuenta suspendida. Reporte atendido.'); });
    };
  }

  /* ---------- arranque ---------- */
  route(false);
})();
