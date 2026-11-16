# Recorrido de extremo a extremo con Playwright.
#   Modo demo (archivo local):      python3 tests/e2e.py
#   Modo servidor (Node o XAMPP):   python3 tests/e2e.py http://127.0.0.1:8099/index.html
# En modo servidor usa una base RECIÉN IMPORTADA: el recorrido crea y borra datos de prueba.
import os, sys, time
from playwright.sync_api import sync_playwright

if len(sys.argv) > 1:
    URL, SERVER = sys.argv[1], True
else:
    URL, SERVER = 'file://' + os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'index.html')), False
PASS = 'AlbumMatch2026!'
ok = 0


def done(msg):
    global ok
    ok += 1
    print('  ok  ' + msg)


with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1200, 'height': 900})
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))

    def fail(msg, extra=''):
        os.makedirs('/tmp/shots', exist_ok=True)
        pg.screenshot(path='/tmp/shots/fallo.png')
        print('FALLA:', msg, extra, '| url:', pg.url)
        sys.exit(1)

    def poll(fn, msg, timeout=4000):
        end = time.time() + timeout / 1000
        last = None
        while time.time() < end:
            try:
                if fn():
                    done(msg); return
            except Exception as e:  # el DOM puede estar cambiando
                last = e
            pg.wait_for_timeout(60)
        fail(msg, str(last or ''))

    def has(sel, text, msg):      poll(lambda: text in pg.inner_text(sel), msg)
    def hasnt(sel, text, msg):    poll(lambda: text not in pg.inner_text(sel), msg)
    def cnt(sel, n, msg):         poll(lambda: pg.locator(sel).count() == n, msg)
    def url_has(t, msg):          poll(lambda: t in pg.url, msg)
    def shot(path):               os.makedirs('/tmp/shots', exist_ok=True); pg.screenshot(path=path)
    def nav(h):                   pg.goto(URL + h); pg.wait_for_timeout(120)

    pg.goto(URL); pg.wait_for_selector('.album-card')

    # --- visitante ---
    cnt('.album-card', 8, 'home: 5 populares + 3 mejor calificados')
    pg.fill('#home-q', 'cinder'); pg.select_option('#home-c', '4'); pg.click('#home-form button')
    pg.wait_for_selector('#cat-grid .album-card')
    cnt('#cat-grid .album-card', 1, 'búsqueda desde Home llega filtrada al catálogo')
    pg.fill('#cat-q', 'zzz'); has('#cat-grid', 'No se encontraron', 'catálogo: mensaje sin resultados')
    pg.fill('#cat-q', ''); pg.select_option('#cat-c', ''); cnt('#cat-grid .album-card', 17, 'catálogo: 17 álbumes sin filtros')
    pg.click('#cat-grid .album-card:has-text("Reverb Ash")'); pg.wait_for_selector('.tracklist')
    cnt('.tracklist li', 5, 'detalle: 5 canciones'); has('.tracklist', 'Sencillo', 'detalle: marca el sencillo')
    has('.rating-line', '4.0 de 5', 'detalle: promedio'); has('.rating-line', '4 reseñas', 'detalle: conteo de aprobadas')
    pg.click('.detalle-grid a.link'); pg.wait_for_selector('.grid-4 .album-card')
    has('.wrap', 'Dúo formado en 2016', 'artista: biografía')
    titles = pg.locator('.album-card .name').all_inner_texts()
    if not (titles[0] == 'Reverb Ash' and titles[-1] == 'First Static'): fail('discografía en orden', str(titles))
    done('artista: discografía del más reciente al más antiguo')
    nav('#artista/2'); has('.wrap', 'Aún no hay una biografía disponible', 'artista sin biografía muestra texto por defecto')
    nav('#ayuda'); pg.click('.faq-q >> nth=1'); cnt('.faq-item.open', 1, 'ayuda: acordeón')
    nav('#acerca'); has('.grid-3 >> nth=0', '17', 'acerca: cifras de álbumes')

    # --- guardas de acceso ---
    nav('#perfil'); pg.wait_for_selector('#f-login'); done('perfil sin sesión redirige al login')
    nav('#admin'); pg.wait_for_selector('#f-login'); done('panel admin sin sesión redirige al login')
    nav('#album/1'); pg.wait_for_selector('[data-act=rate]'); pg.click('[data-act=rate]'); pg.wait_for_selector('#f-login'); done('calificar sin sesión redirige al login')

    # --- validación de login/registro ---
    pg.click('#f-login button[type=submit]'); has('#f-login', 'Ingresa tu correo', 'login: errores por campo')
    pg.fill('#login-email', 'marina@ejemplo.com'); pg.fill('#login-pass', 'mala'); pg.click('#f-login button[type=submit]')
    has('#f-login', 'incorrectos', 'login: credenciales incorrectas')
    pg.fill('#reg-user', 'marina_ibarra'); pg.fill('#reg-email', 'x'); pg.fill('#reg-pass', '123'); pg.fill('#reg-pass2', '9')
    pg.click('#f-reg button[type=submit]')
    has('#f-reg', 'ya está en uso', 'registro: nombre repetido'); has('#f-reg', 'correo válido', 'registro: correo inválido'); has('#f-reg', 'al menos 8', 'registro: contraseña corta')
    if pg.input_value('#reg-user') != 'marina_ibarra': fail('registro conserva lo escrito')
    done('registro conserva lo escrito')

    # --- registro nuevo + listas + reseña pendiente ---
    uname = 'e2e_%d' % int(time.time())
    pg.fill('#reg-user', uname); pg.fill('#reg-email', uname + '@x.com'); pg.fill('#reg-pass', 'clave12345'); pg.fill('#reg-pass2', 'clave12345')
    pg.click('#f-reg button[type=submit]'); pg.wait_for_selector('.tracklist')
    url_has('album/1', 'tras registrarse vuelve al álbum donde intentaba calificar')
    nav('#perfil'); pg.wait_for_selector('.profile-head'); has('.profile-head', uname, 'perfil muestra el usuario nuevo')
    nav('#listas'); pg.wait_for_selector('.list-card'); cnt('.list-card', 3, 'usuario nuevo tiene 3 listas predeterminadas')
    nav('#album/3'); pg.wait_for_selector('[data-act=rate]'); pg.click('[data-act=rate]'); pg.wait_for_selector('[data-star="4"]')
    pg.click('[data-star="4"]'); pg.fill('#rv-text', 'Muy bueno'); pg.click('[data-c=yes]'); pg.wait_for_selector('.note')
    has('.note', 'pendiente de aprobación', 'reseña nueva queda pendiente y se avisa al autor')
    has('.rating-line', 'Sin calificaciones', 'promedio no cambia hasta aprobarse')
    pg.click('[data-act=addlist]'); pg.wait_for_selector('[data-l]'); pg.click('[data-l] >> nth=0'); has('#modal-content', 'Ya está', 'añadir a lista')
    pg.click('[data-c=new]'); pg.fill('#td-input', 'Roadtrip'); pg.click('[data-c=yes]'); pg.wait_for_selector('#modal-overlay.hidden', state='attached')
    nav('#listas'); cnt('.list-card', 4, 'crear lista desde el detalle del álbum')
    pg.click('[data-act=open] >> nth=3'); pg.wait_for_selector('[data-c=del]'); done('lista personalizada se puede eliminar')
    pg.click('[data-c=no]')
    pg.click('[data-act=open] >> nth=0'); pg.wait_for_selector('[data-c=no]'); cnt('[data-c=del]', 0, 'lista predeterminada protegida')
    pg.click('[data-c=no]')
    nav('#resenas'); pg.wait_for_selector('tbody tr'); has('tbody', 'Pendiente', 'mis reseñas muestra el estado')
    pg.click('[data-act=edit]'); pg.wait_for_selector('[data-star="2"]'); pg.click('[data-star="2"]'); pg.click('[data-c=yes]')
    has('tbody', 'editada', 'editar reseña registra fecha de edición')
    nav('#recomendaciones'); has('.wrap', 'Aún no has elegido géneros', 'recomendaciones sin géneros avisa')
    nav('#perfil'); pg.wait_for_selector('#btn-edit'); pg.click('#btn-edit'); pg.wait_for_selector('.pf-gen')
    pg.fill('#pf-bio', 'Hola, soy tester'); pg.check('.pf-gen >> nth=0'); pg.click('[data-c=yes]')
    has('.profile-bio', 'Hola, soy tester', 'perfil actualizado')
    nav('#recomendaciones'); pg.wait_for_selector('.album-card'); done('recomendaciones según géneros favoritos')
    nav('#admin'); pg.wait_for_timeout(300)
    if '#admin' in pg.url and 'admin' not in pg.url.split('#')[1].replace('admin', '', 1): pass
    poll(lambda: pg.url.endswith('#home') or pg.url.endswith('#perfil'), 'usuario normal no entra al panel admin')
    pg.click('[data-logout]'); pg.wait_for_selector('.site-actions a:has-text("Iniciar sesión")')

    # --- admin ---
    nav('#auth'); pg.wait_for_selector('#f-login'); pg.fill('#login-email', 'admin@albummatch.com'); pg.fill('#login-pass', PASS); pg.click('#f-login button[type=submit]')
    pg.wait_for_selector('.kpi'); cnt('.kpi', 3, 'login admin abre el panel con KPIs')
    has('.kpi >> nth=0', '17', 'KPI de álbumes'); has('.kpi.good', '3', 'KPI de pendientes incluye la reseña nueva')
    pg.click('#btn-rep'); pg.wait_for_selector('#modal-content tbody tr'); cnt('#modal-content tbody tr', 10, 'reportes: top 10'); pg.click('[data-c=no]')
    nav('#moderacion'); pg.wait_for_selector('[data-act=ok]')
    pg.click('[data-act=ok] >> nth=0'); pg.wait_for_timeout(250); pg.click('[data-act=no] >> nth=0')
    cnt('[data-act=ok]', 1, 'aprobar/rechazar reseñas')
    pg.click('[data-act=suspend]'); pg.click('[data-c=yes]')
    has('.wrap', 'No hay reportes pendientes', 'suspender desde reporte lo marca atendido'); has('.wrap', 'Suspendida', 'cuenta aparece suspendida')
    pg.click('[data-act=toggle] >> text=Reactivar'); hasnt('.wrap', 'Suspendida', 'reactivar cuenta')
    # CRUD artistas
    nav('#admin-artistas'); pg.wait_for_selector('#ar-body tr')
    pg.click('#btn-add'); pg.fill('#at-n', 'Cinder & Static'); pg.select_option('#at-g', label='Pop'); pg.click('[data-c=yes]')
    has('#modal-content', 'Ya existe un artista', 'artista: nombre único')
    pg.fill('#at-n', 'Artista Nuevo'); pg.click('[data-c=yes]'); cnt('#ar-body tr', 11, 'artista: crear')
    pg.click('#ar-body tr:has-text("Cinder") [data-act=del]'); pg.click('[data-c=yes]'); pg.wait_for_timeout(300)
    cnt('#ar-body tr', 11, 'artista con álbumes no se puede eliminar')
    pg.click('#ar-body tr:has-text("Artista Nuevo") [data-act=del]'); pg.click('[data-c=yes]'); cnt('#ar-body tr', 10, 'artista: eliminar')
    # CRUD álbumes
    nav('#admin-albumes'); pg.wait_for_selector('#aa-body tr')
    pg.click('#btn-add'); pg.fill('#af-t', 'Disco Nuevo'); pg.select_option('#af-a', label='Nadia Cole'); pg.fill('#af-y', '2026'); pg.click('[data-c=yes]')
    cnt('#aa-body tr', 18, 'álbum: crear (género hereda del artista)')
    pg.fill('#aa-q', 'Disco Nuevo'); cnt('#aa-body tr', 1, 'álbum: búsqueda en la tabla'); pg.click('[data-act=songs]'); pg.wait_for_selector('#sg-t')
    pg.fill('#sg-t', 'Pista 1'); pg.fill('#sg-d', '3:30'); pg.click('[data-c=yes]'); has('#modal-content', 'Pista 1', 'canciones: agregar'); pg.click('[data-c=no]')
    pg.click('[data-act=del]'); pg.click('[data-c=yes]'); pg.fill('#aa-q', ''); cnt('#aa-body tr', 17, 'álbum: eliminar')
    jazz = 'Jazz%d' % int(time.time())
    pg.click('#btn-gen'); pg.wait_for_selector('#gn-n'); pg.fill('#gn-n', jazz); pg.click('[data-c=yes]')
    has('#modal-content', jazz, 'géneros: agregar')
    pg.click('[data-d] >> nth=0'); pg.wait_for_selector('[data-c=yes]'); pg.click('[data-c=yes]'); pg.wait_for_timeout(400)
    has('#toast', 'en uso', 'géneros: no se elimina uno en uso')
    pg.click('[data-c=no]'); pg.click('[data-logout]'); pg.wait_for_selector('.site-actions a:has-text("Iniciar sesión")')

    # --- persistencia ---
    pg.reload(); pg.wait_for_selector('.album-card'); nav('#catalogo'); pg.wait_for_selector('#cat-g')
    has('#cat-g', jazz, 'los cambios persisten (%s)' % ('en el servidor' if SERVER else 'en el navegador'))
    if SERVER:
        cnt('#btn-reset', 0, 'modo servidor: no hay botón de datos de demostración')
        # la sesión vive en la cookie del servidor y se puede cerrar
        pg.goto(URL + '#perfil'); pg.wait_for_selector('#f-login'); done('sin sesión el servidor no entrega el perfil')
    else:
        pg.click('#btn-reset'); pg.click('[data-c=yes]'); nav('#catalogo'); pg.wait_for_selector('#cat-g')
        hasnt('#cat-g', jazz, 'restablecer datos de demostración')

    # --- responsive + capturas ---
    pg.goto(URL + '#home'); pg.wait_for_selector('.album-card'); shot('/tmp/shots/home.png')
    pg.set_viewport_size({'width': 390, 'height': 800}); pg.goto(URL + '#album/1'); pg.wait_for_selector('.tracklist'); shot('/tmp/shots/album-movil.png')
    sw = pg.evaluate('document.documentElement.scrollWidth')
    if sw > 392: fail('móvil: desbordamiento horizontal', str(sw))
    done('móvil: sin desbordamiento horizontal (%d px)' % sw)
    real = [e for e in errs if 'ERR_NAME' not in e]
    if real: fail('errores de JavaScript', str(real))
    done('sin errores de JavaScript')
    b.close()
print('\n%d comprobaciones pasaron (%s)' % (ok, 'servidor' if SERVER else 'demo'))
