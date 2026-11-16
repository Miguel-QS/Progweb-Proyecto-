#!/usr/bin/env python3
"""
Comprueba el contrato de la API contra cualquier servidor:
    python3 tests/api_contract.py http://127.0.0.1:8099            # servidor de pruebas (Node)
    python3 tests/api_contract.py http://localhost/albummatch      # tu XAMPP con PHP + MySQL

Úsalo sobre una base RECIÉN IMPORTADA (database/albummatch.sql): comprueba los datos
de ejemplo y deja algunos registros de prueba (una cuenta "ct_<hora>").
"""
import json, sys, time, urllib.request, urllib.error, http.cookiejar

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8099').rstrip('/')
URL = BASE + '/api/index.php'
PASS = 'AlbumMatch2026!'
ok_count = 0


def check(cond, msg):
    global ok_count
    if not cond:
        print('FALLA:', msg)
        sys.exit(1)
    ok_count += 1
    print('  ok ', msg)


class Client:
    def __init__(self):
        self.jar = http.cookiejar.CookieJar()
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))

    def raw(self, data=None, headers=None, method='POST'):
        req = urllib.request.Request(URL, data=data, method=method, headers=headers or {})
        try:
            r = self.op.open(req, timeout=20)
            return r.status, r.read().decode('utf-8')
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode('utf-8')

    def call(self, op, **args):
        st, txt = self.raw(json.dumps({'op': op, 'args': args}).encode(), {'Content-Type': 'application/json'})
        try:
            return st, json.loads(txt)
        except ValueError:
            print('Respuesta no JSON (%s): %s' % (st, txt[:300]))
            sys.exit(1)

    def read(self, op, **args):
        st, b = self.call(op, **args)
        assert st == 200 and b['ok'], (op, st, b)
        return b['data']

    def write(self, op, **args):
        st, b = self.call(op, **args)
        return b


anon, marina, admin, tester = Client(), Client(), Client(), Client()

print('Protocolo')
st, _ = anon.raw(method='GET'); check(st == 405, 'GET no está permitido (405)')
st, _ = anon.raw(b'{"op":"generos"}', {'Content-Type': 'text/plain'}); check(st in (400, 415), 'sin Content-Type JSON se rechaza')
st, b = anon.call('no_existe'); check(st == 404 and not b['ok'], 'operación desconocida -> 404')
st, b = anon.call('guardarResena', id_album=1, calificacion=5); check(st == 401 and b.get('code') == 'auth', 'sin sesión -> 401 code=auth')
check(anon.read('me') is None, 'me sin sesión devuelve null')

print('Lecturas públicas')
gen = anon.read('generos')
check(len(gen) == 7 and gen[0]['nombre'] == 'Electrónica' and isinstance(gen[0]['id_genero'], int), '7 géneros ordenados, ids numéricos')
check(anon.read('anios')[0] == 2025, 'años en orden descendente')
check(len(anon.read('artistas')) == 10, '10 artistas')
pop = anon.read('populares', n=5)
check(pop[0]['titulo'] == 'Reverb Ash' and pop[0]['promedio'] == 4.0 and pop[0]['total_resenas'] == 4, 'populares: Reverb Ash 4.0 con 4 reseñas')
check([a['titulo'] for a in anon.read('mejorCalificados', n=5)] == ['Salt Year', 'Reverb Ash', 'Paper Weather'], 'mejor calificados')
check(len(anon.read('buscar', q='cinder')) == 4, 'buscar por artista')
check(len(anon.read('buscar', q='CENIZÁ')) == 1, 'buscar ignora mayúsculas y acentos')
check(len(anon.read('buscar', id_genero='1', anio='2024')) == 1, 'buscar combina género y año')
check(len(anon.read('buscar', minCal='4')) == 3, 'buscar por calificación mínima')
check(len(anon.read('buscar', q='100%')) == 0, 'el % del buscador no actúa como comodín')
d = anon.read('detalleAlbum', id=1)
check(len(d['canciones']) == 5 and d['canciones'][2]['es_sencillo'] in (1, True), 'detalle: 5 canciones, la 3 es sencillo')
check(len(d['resenas']) == 4 and d['resenas'][0]['nombre_usuario'] == 'marina_ibarra', 'detalle: 4 reseñas aprobadas, la más reciente primero')
check(anon.read('detalleAlbum', id=3)['resenas'] == [], 'las reseñas pendientes no se muestran')
check(anon.read('detalleAlbum', id=9999) is None, 'álbum inexistente -> null')
art = anon.read('detalleArtista', id=1)
check(art['artista']['biografia'] and [x['anio_lanzamiento'] for x in art['albumes']] == [2024, 2019, 2018, 2016], 'artista: biografía y discografía por año desc')
check(anon.read('detalleArtista', id=2)['artista']['biografia'] is None, 'artista sin biografía -> null')
check(anon.read('acerca') == {'albumes': 17, 'usuarios': 7}, 'acerca: 17 álbumes, 7 usuarios')

print('Autenticación')
b = anon.write('login', correo='marina@ejemplo.com', password='mala'); check(not b['ok'] and 'incorrectos' in b['error'], 'login con contraseña incorrecta')
b = anon.write('login', correo='', password=''); check(not b['ok'] and 'correo' in b['errors'] and 'password' in b['errors'], 'login vacío: error por campo')
b = marina.write('login', correo='MARINA@ejemplo.com', password=PASS); check(b['ok'] and b['usuario']['nombre_usuario'] == 'marina_ibarra', 'login correcto (correo sin distinguir mayúsculas)')
check('contrasena_hash' not in json.dumps(b), 'la respuesta del login no expone el hash')
me = marina.read('me'); check(me['id_rol'] == 1 and 'contrasena_hash' not in me, 'me devuelve el usuario sin hash')
st, b = marina.call('kpis'); check(st == 403 and b.get('code') == 'forbidden', 'usuario normal no puede usar operaciones de admin (403)')

print('Usuario: datos propios')
check(len(marina.read('misResenas')) == 3 and marina.read('misResenas')[0]['titulo'] == 'Reverb Ash', 'mis reseñas: 3, la más reciente primero')
check(len(marina.read('listas')) == 4, '4 listas de ejemplo')
check([g['nombre'] for g in marina.read('generosFavoritos')] == ['Rock alternativo', 'Indie / Folk', 'Electrónica'] or len(marina.read('generosFavoritos')) == 3, '3 géneros favoritos (objetos)')
rec = marina.read('recomendaciones')
check(len(rec['generos']) == 3 and all(x['titulo'] not in ('Reverb Ash', 'Paper Weather') for x in rec['albumes']) and len(rec['albumes']) <= 10, 'recomendaciones excluyen lo ya reseñado')
check(marina.read('resenaDe', id_album=1)['calificacion'] == 4 and marina.read('resenaDe', id_album=2) is None, 'resenaDe')

print('Registro y reseñas')
uname = 'ct_%d' % int(time.time())
b = tester.write('registrar', nombre_usuario='', correo='x', password='123', password2='1')
check(not b['ok'] and {'nombre_usuario', 'correo', 'password'} <= set(b['errors']), 'registro: validaciones por campo')
b = tester.write('registrar', nombre_usuario='MARINA_IBARRA', correo=uname + '@x.com', password='abcdefgh', password2='abcdefgh'); check('nombre_usuario' in b['errors'], 'registro: nombre duplicado (sin distinguir mayúsculas)')
b = tester.write('registrar', nombre_usuario=uname, correo='marina@ejemplo.com', password='abcdefgh', password2='abcdefgh'); check('correo' in b['errors'], 'registro: correo duplicado')
b = tester.write('registrar', nombre_usuario=uname, correo=uname + '@x.com', password='abcdefgh', password2='otra1234'); check('password2' in b['errors'], 'registro: contraseñas distintas')
b = tester.write('registrar', nombre_usuario=uname, correo=uname + '@x.com', password='clave12345', password2='clave12345')
check(b['ok'] and b['usuario']['id_rol'] == 1, 'registro correcto inicia sesión')
check([l['nombre'] for l in tester.read('listas')] == ['Quiero escuchar', 'Favoritos', 'Historial de escuchados'], 'registro crea 3 listas predeterminadas')
check(not tester.write('guardarResena', id_album=2, calificacion=0)['ok'], 'reseña: calificación 0 inválida')
check(not tester.write('guardarResena', id_album=2, calificacion=5, comentario='x' * 1001)['ok'], 'reseña: más de 1000 caracteres')
b = tester.write('guardarResena', id_album=2, calificacion=5, comentario='Genial'); check(b['ok'] and b['accion'] == 'creada', 'reseña nueva creada')
check(anon.read('buscar', q='Skyline')[0]['promedio'] is None, 'reseña pendiente no cuenta para el promedio')
b = tester.write('guardarResena', id_album=2, calificacion=3, comentario='Mejor'); check(b['ok'] and b['accion'] == 'actualizada', 'segunda reseña del mismo álbum = actualización')
mr = tester.read('misResenas'); check(len(mr) == 1 and mr[0]['estado'] == 'Pendiente' and mr[0]['fecha_edicion'], 'queda Pendiente y con fecha de edición')
id_res = mr[0]['id_resena']

print('Listas')
check(not tester.write('crearLista', nombre='favoritos')['ok'], 'lista: nombre repetido (sin distinguir mayúsculas)')
b = tester.write('crearLista', nombre='Roadtrip', id_album=5); check(b['ok'] and b['lista']['nombre'] == 'Roadtrip', 'crear lista con álbum')
lid = b['lista']['id_lista']
check(not tester.write('agregarALista', id_lista=lid, id_album=5)['ok'], 'no se duplica un álbum en la lista')
check(tester.write('agregarALista', id_lista=lid, id_album=6)['ok'], 'agregar a lista')
ls = [l for l in tester.read('listas') if l['id_lista'] == lid][0]; check(len(ls['albumes']) == 2 and not ls['predeterminada'], 'lista con 2 álbumes')
first = tester.read('listas')[0]['id_lista']
check(not tester.write('eliminarLista', id_lista=first)['ok'] and not tester.write('renombrarLista', id_lista=first, nombre='X')['ok'], 'listas predeterminadas protegidas')
check(not marina.write('eliminarLista', id_lista=lid)['ok'], 'no se puede tocar la lista de otra persona')
check(tester.write('renombrarLista', id_lista=lid, nombre='Viaje')['ok'] and tester.write('quitarDeLista', id_lista=lid, id_album=5)['ok'], 'renombrar y quitar')
check(tester.write('eliminarLista', id_lista=lid)['ok'], 'eliminar lista personalizada')

print('Perfil')
b = tester.write('actualizarPerfil', biografia='x' * 301, generos=[]); check(not b['ok'] and 'biografia' in b['errors'], 'perfil: biografía > 300')
b = tester.write('actualizarPerfil', biografia='', avatar_url='javascript:alert(1)', generos=[]); check(not b['ok'] and 'avatar_url' in b['errors'], 'perfil: URL de avatar no válida')
check(tester.write('actualizarPerfil', biografia='Hola', avatar_url='https://x.com/a.png', generos=[2, 99])['ok'], 'perfil guardado (ignora géneros inexistentes)')
check([g['id_genero'] for g in tester.read('generosFavoritos')] == [2], 'géneros favoritos guardados')

print('Reportes')
check(not marina.write('crearReporte', id_resena=4, motivo='x')['ok'], 'no se puede reportar la propia reseña')
check(not marina.write('crearReporte', id_resena=1, id_usuario_reportado=3, motivo='x')['ok'], 'un reporte apunta a una cosa, no a ambas')
check(not marina.write('crearReporte', id_resena=1, motivo='')['ok'], 'el motivo es obligatorio')
check(marina.write('crearReporte', id_resena=1, motivo='Spam')['ok'] and not marina.write('crearReporte', id_resena=1, motivo='Spam')['ok'], 'reporte creado y duplicado rechazado')
check(marina.write('crearReporte', id_usuario_reportado=me['id_usuario'] + 100, motivo='x')['ok'] is False, 'reportar a un usuario inexistente falla')

print('Administrador')
b = admin.write('login', correo='admin@albummatch.com', password=PASS); check(b['ok'] and b['usuario']['id_rol'] == 2, 'login administrador')
k0 = admin.read('kpis'); check(k0['albumes'] == 17 and k0['pendientes'] == 3, 'kpis: 17 álbumes, 3 pendientes (2 + la nueva)')
st, b = admin.call('misResenas'); check(st == 403, 'el administrador no usa operaciones de usuario')
pend = admin.read('pendientes'); check(any(p['id_resena'] == id_res for p in pend), 'la reseña nueva aparece en moderación')
check(not admin.write('moderar', id_resena=id_res, estado='Otra')['ok'], 'estado de moderación inválido')
check(admin.write('moderar', id_resena=id_res, estado='Aprobada')['ok'], 'aprobar reseña')
sk = anon.read('buscar', q='Skyline')[0]; check(sk['promedio'] == 3.0 and sk['total_resenas'] == 1, 'tras aprobar, el promedio se recalcula')
check(any(r['tipo'] == 'Reseña' for r in admin.read('reportesPendientes')) and any(r['tipo'] == 'Usuario' for r in admin.read('reportesPendientes')), 'reportes pendientes de reseña y de usuario')
check(admin.read('actividad', n=5)[0]['detalle'], 'bitácora reciente')
check(len(admin.read('topCalificados', n=10)) == 10, 'top de calificaciones')
check(len(admin.read('usuarios')) >= 8, 'lista de cuentas')

# suspender a la cuenta de prueba desde un reporte de usuario
tid = [u for u in admin.read('usuarios') if u['nombre_usuario'] == uname][0]['id_usuario']
check(marina.write('crearReporte', id_usuario_reportado=tid, motivo='Prueba')['ok'], 'reporte de usuario')
rep = [r for r in admin.read('reportesPendientes') if r['id_usuario_reportado'] == tid][0]
check(not admin.write('atenderReporte', id_reporte=rep['id_reporte'], accion='eliminar')['ok'], 'no se "elimina" un reporte de usuario')
check(admin.write('atenderReporte', id_reporte=rep['id_reporte'], accion='suspender')['ok'], 'suspender desde el reporte')
check('suspendida' in tester.write('login', correo=uname + '@x.com', password='clave12345').get('error', ''), 'una cuenta suspendida no puede entrar')
st, b = tester.call('guardarResena', id_album=3, calificacion=4); check(st == 401, 'la sesión de una cuenta suspendida deja de valer')
check(not admin.write('setActivo', id_usuario=1, activo=False)['ok'], 'no se suspende a un administrador')
check(admin.write('setActivo', id_usuario=tid, activo=True)['ok'], 'reactivar cuenta')
check(tester.write('login', correo=uname + '@x.com', password='clave12345')['ok'], 'la cuenta reactivada entra de nuevo')
check(tester.write('eliminarResena', id_resena=id_res)['ok'], 'el autor elimina su reseña')
check(not marina.write('eliminarResena', id_resena=1)['ok'], 'otro usuario no puede eliminar una reseña ajena')

print('CRUD de catálogo')
gname = 'Jazz_%d' % int(time.time())
check(not admin.write('agregarGenero', nombre='pop')['ok'], 'género repetido')
check(admin.write('agregarGenero', nombre=gname)['ok'], 'agregar género')
gid = [g for g in anon.read('generos') if g['nombre'] == gname][0]['id_genero']
check(admin.write('renombrarGenero', id_genero=gid, nombre=gname + 'x')['ok'], 'renombrar género')
check(not admin.write('eliminarGenero', id_genero=1)['ok'], 'no se elimina un género en uso')
b = admin.write('guardarArtista', nombre='cinder & static', id_genero=1); check('nombre' in b['errors'], 'artista: nombre único')
b = admin.write('guardarArtista', id_artista=1, nombre='Cinder & Static', id_genero=2); check('id_genero' in b['errors'], 'artista con álbumes: no cambia de género')
check(admin.write('guardarArtista', nombre='Artista CT', id_genero=gid, pais='México', biografia='Bio')['ok'], 'crear artista')
aid = [a for a in anon.read('artistas') if a['nombre'] == 'Artista CT'][0]['id_artista']
b = admin.write('guardarAlbum', id_artista=aid, titulo='X', anio=1800, hue=10); check('anio' in b['errors'], 'álbum: año fuera de rango')
b = admin.write('guardarAlbum', id_artista=aid, titulo='X', anio=2020, hue=400); check('hue' in b['errors'], 'álbum: tono fuera de rango')
b = admin.write('guardarAlbum', id_artista=1, titulo='reverb ash', anio=2020, hue=10); check('titulo' in b['errors'], 'álbum: título único por artista')
check(admin.write('guardarAlbum', id_artista=aid, titulo='Disco CT', anio=2026, hue=120)['ok'], 'crear álbum')
al = [a for a in anon.read('buscar', q='Disco CT')][0]; check(al['id_genero'] == gid and al['genero'].startswith('Jazz'), 'el álbum hereda el género de su artista')
check(not admin.write('eliminarArtista', id_artista=aid)['ok'], 'artista con álbumes no se elimina')
check(not admin.write('eliminarGenero', id_genero=gid)['ok'], 'género con artistas/álbumes no se elimina')
for t, dur, sen in (('A', 100, True), ('B', 200, False), ('C', 300, False)):
    check(admin.write('guardarCancion', id_album=al['id_album'], titulo=t, duracion_seg=dur, es_sencillo=sen)['ok'], 'canción %s agregada' % t)
check(not admin.write('guardarCancion', id_album=al['id_album'], titulo='D', duracion_seg=0)['ok'], 'duración 0 inválida')
cs = admin.read('canciones', id_album=al['id_album']); check([c['numero_pista'] for c in cs] == [1, 2, 3], 'numeración automática')
check(admin.write('eliminarCancion', id_cancion=cs[0]['id_cancion'])['ok'], 'eliminar canción')
check([(c['numero_pista'], c['titulo']) for c in admin.read('canciones', id_album=al['id_album'])] == [(1, 'B'), (2, 'C')], 'renumera sin huecos')
check(admin.write('eliminarAlbum', id_album=al['id_album'])['ok'], 'eliminar álbum (en cascada)')
check(admin.write('eliminarArtista', id_artista=aid)['ok'] and admin.write('eliminarGenero', id_genero=gid)['ok'], 'eliminar artista y género')

print('\n%d comprobaciones pasaron contra %s' % (ok_count, BASE))
