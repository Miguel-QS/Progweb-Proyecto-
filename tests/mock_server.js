// Servidor de pruebas SIN PHP ni MySQL: sirve el sitio y la API con el mismo contrato
// que api/index.php, apoyado en store.js + dispatch.js.   node tests/mock_server.js [puerto]
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const AlbumStore = require('../assets/js/store.js');
const AlbumDispatch = require('../assets/js/dispatch.js');
const ROOT = path.join(__dirname, '..');
const port = Number(process.argv[2]) || 8099;
const store = AlbumStore.create();
const d = AlbumDispatch.create(store);
const sessions = new Map(); // sid -> id_usuario
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.sql': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8' };

function cookie(req) {
  const m = /(?:^|;\s*)albummatch=([a-f0-9]+)/.exec(req.headers.cookie || '');
  return m ? m[1] : null;
}
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/index.php') {
    if (req.method !== 'POST') { res.writeHead(405).end(); return; }
    if (!/^application\/json/i.test(req.headers['content-type'] || '')) {
      res.writeHead(415, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: false, error: 'Content-Type debe ser application/json.', errors: {} })); return;
    }
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      let input;
      try { input = JSON.parse(body); } catch (e) { input = null; }
      if (!input || typeof input.op !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: false, error: 'Petición no válida.', errors: {} })); return;
      }
      let sid = cookie(req), setCookie = null;
      const s = {
        get: () => (sid && sessions.get(sid)) || 0,
        set: (id) => { if (sid) sessions.delete(sid); sid = crypto.randomBytes(16).toString('hex'); sessions.set(sid, id); setCookie = 'albummatch=' + sid + '; HttpOnly; Path=/; SameSite=Lax'; },
        clear: () => { if (sid) sessions.delete(sid); setCookie = 'albummatch=; Max-Age=0; Path=/'; }
      };
      const r = d.dispatch(input.op, input.args, s);
      const h = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
      if (setCookie) h['Set-Cookie'] = setCookie;
      res.writeHead(r.status, h).end(JSON.stringify(r.body));
    });
    return;
  }
  let p = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[\/\\])+/, '');
  if (p === '/' || p === path.sep) p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404).end('No encontrado'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' }).end(fs.readFileSync(file));
});
server.listen(port, '127.0.0.1', () => console.log('AlbumMatch (mock) en http://127.0.0.1:' + port));
