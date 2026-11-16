/* =====================================================================
   AlbumMatch — api.js
   Único punto por el que la interfaz habla con los datos.
     modo "server": POST a api/index.php (PHP + MySQL)
     modo "demo":   todo en el navegador (store.js + dispatch.js), sin servidor
   Con mode:'auto' (por defecto) se usa "demo" al abrir index.html desde el
   disco o desde GitHub Pages, y "server" en cualquier otro caso (XAMPP).
   ===================================================================== */
(function (root) {
  'use strict';
  var cfg = root.ALBUMMATCH_CONFIG || {};
  var mode = cfg.mode || 'auto';
  if (mode === 'auto') {
    mode = (location.protocol === 'file:' || /\.github\.io$/i.test(location.hostname)) ? 'demo' : 'server';
  }
  var api = { mode: mode, onAuthLost: null };
  var transport;

  if (mode === 'demo') {
    var DATA_KEY = 'albummatch_demo_v2', SESSION_KEY = 'albummatch_sesion';
    var store = AlbumStore.create();
    try {
      var raw = localStorage.getItem(DATA_KEY);
      if (raw) { var saved = JSON.parse(raw); if (saved && saved.v === 1) store.load(saved); }
    } catch (e) { /* datos corruptos: se usa el seed */ }
    store.onChange = function () { try { localStorage.setItem(DATA_KEY, store.export()); } catch (e) { /* sin almacenamiento */ } };
    var dispatcher = AlbumDispatch.create(store);
    var session = {
      get: function () {
        try { return Number(sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY)) || 0; } catch (e) { return 0; }
      },
      set: function (id, remember) {
        session.clear();
        try { (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, String(id)); } catch (e) { /* sin almacenamiento */ }
      },
      clear: function () { try { sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_KEY); } catch (e) { /* sin almacenamiento */ } }
    };
    transport = function (op, args) {
      // JSON ida y vuelta: igual que viajaría por la red
      var r = dispatcher.dispatch(op, JSON.parse(JSON.stringify(args || {})), session);
      return Promise.resolve(JSON.parse(JSON.stringify(r.body)));
    };
    api.reset = function () { store.reset(); session.clear(); };
  } else {
    var url = cfg.apiUrl || 'api/index.php';
    transport = function (op, args) {
      return fetch(url, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ op: op, args: args || {} })
      }).then(function (res) {
        return res.text().then(function (t) {
          try { return JSON.parse(t); } catch (e) { return { ok: false, error: 'El servidor respondió algo inesperado (revisa api/ y la conexión a la base de datos).', errors: {} }; }
        });
      }).catch(function () {
        return { ok: false, error: 'No se pudo conectar con el servidor.', errors: {}, code: 'network' };
      });
    };
  }

  function call(op, args) {
    return transport(op, args).then(function (body) {
      if (body && body.code === 'auth' && api.onAuthLost) api.onAuthLost();
      return body;
    });
  }
  // Lecturas: devuelve los datos, o `fallback` si algo falló
  api.read = function (op, args, fallback) {
    return call(op, args).then(function (b) { return b && b.ok && b.data !== undefined ? b.data : (fallback === undefined ? null : fallback); });
  };
  // Escrituras: devuelve { ok, ...extras } o { ok:false, error, errors }
  api.write = function (op, args) { return call(op, args); };
  api.me = function () { return api.read('me', {}, null); };

  root.AlbumApi = api;
})(window);
