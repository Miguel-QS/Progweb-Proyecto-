// Ejecutar con:  node tests/store.test.js
const assert = require('assert');
const AlbumStore = require('../assets/js/store.js');
let n = 0;
function t(name, fn) { fn(); n++; console.log('  ok  ' + name); }
const fresh = () => AlbumStore.create();
const PASS = AlbumStore.DEMO_PASSWORD;

t('datos de ejemplo coinciden con la BD (17 álbumes, 7 usuarios, promedios)', () => {
  const s = fresh();
  assert.strictEqual(s.catalogo().length, 17);
  assert.strictEqual(s.usuarios().length, 7);
  const r = s.catalogo().find(a => a.titulo === 'Reverb Ash');
  assert.deepStrictEqual([r.promedio, r.total_resenas], [4.0, 4]);
  assert.deepStrictEqual(s.catalogo().find(a => a.titulo === 'Salt Year').promedio, 5);
  assert.strictEqual(s.catalogo().find(a => a.titulo === 'Halide').promedio, null); // reseña pendiente no cuenta
  assert.deepStrictEqual(s.kpis(), { albumes: 17, usuarios: 7, pendientes: 2 });
});

t('home: populares y mejor calificados', () => {
  const s = fresh();
  assert.strictEqual(s.populares(5)[0].titulo, 'Reverb Ash');
  const top = s.mejorCalificados(5).map(a => a.titulo);
  assert.deepStrictEqual(top, ['Salt Year', 'Reverb Ash', 'Paper Weather']);
});

t('búsqueda combina texto, género, año y calificación mínima', () => {
  const s = fresh();
  assert.strictEqual(s.buscar({ q: 'cinder' }).length, 4);
  assert.strictEqual(s.buscar({ q: 'CINDER', id_genero: 1, anio: 2024 }).length, 1);
  assert.strictEqual(s.buscar({ minCal: 4 }).length, 3);
  assert.strictEqual(s.buscar({ q: 'zzz' }).length, 0);
  assert.strictEqual(s.buscar({ q: 'cenizá' }).length, 1); // ignora acentos
});

t('login: correcto, incorrecto y suspendido', () => {
  const s = fresh();
  assert.ok(s.login('marina@ejemplo.com', PASS).ok);
  assert.ok(s.login('MARINA@ejemplo.com', PASS).ok);
  assert.ok(!s.login('marina@ejemplo.com', 'mala').ok);
  assert.ok(!s.login('', '').ok);
  s.setActivo(2, false, 1);
  assert.match(s.login('marina@ejemplo.com', PASS).error, /suspendida/);
});

t('registro valida campos y crea las 3 listas predeterminadas', () => {
  const s = fresh();
  const bad = s.registrar({ nombre_usuario: '', correo: 'x', password: '123', password2: '1' });
  assert.ok(!bad.ok && bad.errors.nombre_usuario && bad.errors.correo && bad.errors.password);
  assert.ok(s.registrar({ nombre_usuario: 'MARINA_IBARRA', correo: 'nuevo@x.com', password: 'abcdefgh', password2: 'abcdefgh' }).errors.nombre_usuario);
  assert.ok(s.registrar({ nombre_usuario: 'nuevo', correo: 'marina@ejemplo.com', password: 'abcdefgh', password2: 'abcdefgh' }).errors.correo);
  assert.ok(s.registrar({ nombre_usuario: 'nuevo', correo: 'n@x.com', password: 'abcdefgh', password2: 'otra1234' }).errors.password2);
  const r = s.registrar({ nombre_usuario: 'nuevo', correo: 'n@x.com', password: 'abcdefgh', password2: 'abcdefgh' });
  assert.ok(r.ok);
  assert.deepStrictEqual(s.listas(r.usuario.id_usuario).map(l => l.nombre), ['Quiero escuchar', 'Favoritos', 'Historial de escuchados']);
  assert.ok(s.login('n@x.com', 'abcdefgh').ok);
});

t('reseñas: nueva entra Pendiente, una por usuario/álbum, edición registra fecha', () => {
  const s = fresh();
  assert.ok(!s.guardarResena({ id_usuario: 3, id_album: 2, calificacion: 0 }).ok);
  assert.ok(!s.guardarResena({ id_usuario: 3, id_album: 2, calificacion: 5, comentario: 'x'.repeat(1001) }).ok);
  assert.ok(!s.guardarResena({ id_usuario: 1, id_album: 2, calificacion: 5 }).ok); // admin no reseña
  const r = s.guardarResena({ id_usuario: 3, id_album: 2, calificacion: 5, comentario: 'Genial' });
  assert.strictEqual(r.accion, 'creada');
  assert.strictEqual(s.catalogo()[1].promedio, null);            // aún no aprobada
  s.moderar(r.resena.id_resena, 'Aprobada', 1);
  assert.strictEqual(s.catalogo()[1].promedio, 5);
  const e = s.guardarResena({ id_usuario: 3, id_album: 2, calificacion: 3, comentario: 'Mejor' });
  assert.strictEqual(e.accion, 'actualizada');
  assert.ok(e.resena.fecha_edicion);
  assert.strictEqual(s.catalogo()[1].promedio, 3);
  assert.strictEqual(s.misResenas(3).filter(x => x.id_album === 2).length, 1);
});

t('eliminar reseña: solo dueño o admin; recalcula promedio', () => {
  const s = fresh();
  assert.ok(!s.eliminarResena(4, 3).ok);
  assert.ok(s.eliminarResena(4, 2).ok); // marina borra la suya (id 4)
  assert.strictEqual(s.catalogo()[0].total_resenas, 3);
  assert.ok(s.eliminarResena(1, 1).ok); // admin
});

t('listas: nombre único, predeterminadas protegidas, sin duplicar álbum', () => {
  const s = fresh();
  assert.ok(!s.crearLista(2, 'favoritos').ok);
  const l = s.crearLista(2, 'Para el viaje', 5);
  assert.ok(l.ok);
  assert.ok(!s.agregarALista(2, l.lista.id_lista, 5).ok);
  assert.ok(s.agregarALista(2, l.lista.id_lista, 6).ok);
  assert.ok(!s.eliminarLista(2, 1).ok);
  assert.ok(!s.renombrarLista(2, 1, 'Otra').ok);
  assert.ok(s.renombrarLista(2, l.lista.id_lista, 'Roadtrip').ok);
  assert.ok(!s.eliminarLista(3, l.lista.id_lista).ok); // otra persona
  assert.ok(s.quitarDeLista(2, l.lista.id_lista, 5).ok);
  assert.ok(s.eliminarLista(2, l.lista.id_lista).ok);
});

t('recomendaciones: géneros favoritos, excluye reseñados, máx. 10', () => {
  const s = fresh();
  const r = s.recomendaciones(2);
  assert.deepStrictEqual(r.generos, ['Rock alternativo', 'Indie / Folk', 'Electrónica']);
  assert.ok(r.albumes.length <= 10);
  assert.ok(!r.albumes.some(a => ['Reverb Ash', 'Paper Weather'].includes(a.titulo)));
  assert.ok(r.albumes.every(a => [1, 3, 4].includes(a.id_genero)));
  s.actualizarPerfil(2, { biografia: 'hola', generos: [] });
  assert.strictEqual(s.recomendaciones(2).albumes.length, 0);
});

t('perfil valida biografía y URL de avatar', () => {
  const s = fresh();
  assert.ok(!s.actualizarPerfil(2, { biografia: 'x'.repeat(301), generos: [] }).ok);
  assert.ok(!s.actualizarPerfil(2, { biografia: '', avatar_url: 'javascript:alert(1)', generos: [] }).ok);
  assert.ok(s.actualizarPerfil(2, { biografia: 'ok', avatar_url: 'https://x.com/a.png', generos: [2, 99] }).ok);
  assert.deepStrictEqual(s.generosFavoritos(2), [2]);
});

t('artistas: nombre único, no borrar con álbumes, no cambiar género con álbumes', () => {
  const s = fresh();
  assert.ok(!s.guardarArtista(2, { nombre: 'X', id_genero: 1 }).ok); // no admin
  assert.ok(s.guardarArtista(1, { nombre: 'cinder & static', id_genero: 1 }).errors.nombre);
  assert.ok(s.guardarArtista(1, { id_artista: 1, nombre: 'Cinder & Static', id_genero: 2 }).errors.id_genero);
  assert.ok(!s.eliminarArtista(1, 1).ok);
  const a = s.guardarArtista(1, { nombre: 'Nuevo', id_genero: 2 });
  assert.ok(a.ok);
  assert.ok(s.eliminarArtista(1, 11).ok);
});

t('álbumes: género hereda del artista, validaciones y borrado en cascada', () => {
  const s = fresh();
  assert.ok(s.guardarAlbum(1, { id_artista: 1, titulo: 'reverb ash', anio: 2020, hue: 10 }).errors.titulo);
  assert.ok(s.guardarAlbum(1, { id_artista: 1, titulo: 'Nuevo', anio: 1800, hue: 10 }).errors.anio);
  assert.ok(s.guardarAlbum(1, { id_artista: 1, titulo: 'Nuevo', anio: 2020, hue: 400 }).errors.hue);
  assert.ok(s.guardarAlbum(1, { id_artista: 2, titulo: 'Nuevo', anio: 2020, hue: 10 }).ok);
  assert.strictEqual(s.catalogo().find(a => a.titulo === 'Nuevo').id_genero, 2);
  s.guardarAlbum(1, { id_album: 18, id_artista: 3, titulo: 'Nuevo', anio: 2021, hue: 5 });
  assert.strictEqual(s.catalogo().find(a => a.titulo === 'Nuevo').genero, 'Rock alternativo');
  s.crearLista(2, 'Temp', 1);
  assert.ok(s.eliminarAlbum(1, 1).ok);
  assert.strictEqual(s.canciones(1).length, 0);
  assert.strictEqual(s.misResenas(2).filter(r => r.id_album === 1).length, 0);
  assert.ok(!s.listas(2).some(l => l.albumes.some(a => a.id_album === 1)));
});

t('canciones: numeración automática, sencillo, renumera al borrar', () => {
  const s = fresh();
  assert.ok(s.guardarCancion(1, { id_album: 2, titulo: 'A', duracion_seg: 100, es_sencillo: true }).ok);
  s.guardarCancion(1, { id_album: 2, titulo: 'B', duracion_seg: 200 });
  s.guardarCancion(1, { id_album: 2, titulo: 'C', duracion_seg: 300 });
  assert.deepStrictEqual(s.canciones(2).map(c => c.numero_pista), [1, 2, 3]);
  s.eliminarCancion(1, s.canciones(2)[0].id_cancion);
  assert.deepStrictEqual(s.canciones(2).map(c => [c.numero_pista, c.titulo]), [[1, 'B'], [2, 'C']]);
  assert.ok(s.guardarCancion(1, { id_album: 2, titulo: 'D', duracion_seg: 0 }).errors.duracion);
});

t('géneros: único, no borrar en uso', () => {
  const s = fresh();
  assert.ok(!s.agregarGenero(1, 'pop').ok);
  assert.ok(s.agregarGenero(1, 'Jazz').ok);
  assert.ok(!s.eliminarGenero(1, 1).ok);
  const jazz = s.generos().find(g => g.nombre === 'Jazz');
  assert.ok(s.renombrarGenero(1, jazz.id_genero, 'Jazz fusión').ok);
  assert.ok(s.eliminarGenero(1, jazz.id_genero).ok);
});

t('reportes: validaciones, duplicados, y acciones de moderación', () => {
  const s = fresh();
  assert.ok(!s.crearReporte({ id_usuario_reporta: 3, id_resena: 4, motivo: '' }).ok);
  assert.ok(!s.crearReporte({ id_usuario_reporta: 2, id_resena: 4, motivo: 'x' }).ok);       // propia reseña
  assert.ok(!s.crearReporte({ id_usuario_reporta: 2, id_usuario_reportado: 2, motivo: 'x' }).ok);
  assert.ok(!s.crearReporte({ id_usuario_reporta: 2, id_resena: 4, id_usuario_reportado: 3, motivo: 'x' }).ok);
  assert.ok(s.crearReporte({ id_usuario_reporta: 3, id_resena: 4, motivo: 'Spam' }).ok);
  assert.ok(!s.crearReporte({ id_usuario_reporta: 3, id_resena: 4, motivo: 'Spam' }).ok);
  assert.strictEqual(s.reportesPendientes().length, 2);
  assert.ok(!s.atenderReporte(1, 'suspender', 2).ok);                                       // no admin
  assert.ok(s.atenderReporte(1, 'suspender', 1).ok);
  assert.ok(!s.usuario(7).activo);
  assert.ok(!s.login('usuarioy@ejemplo.com', PASS).ok);
  assert.ok(s.atenderReporte(2, 'eliminar', 1).ok);
  assert.strictEqual(s.reportesPendientes().length, 0);
  assert.ok(!s.setActivo(1, false, 1).ok); // no suspender admin
  assert.ok(s.setActivo(7, true, 1).ok);
});

t('moderación y bitácora', () => {
  const s = fresh();
  assert.strictEqual(s.pendientes().length, 2);
  assert.ok(!s.moderar(7, 'Aprobada', 2).ok);
  assert.ok(s.moderar(7, 'Rechazada', 1).ok);
  assert.ok(s.moderar(8, 'Aprobada', 1).ok);
  assert.strictEqual(s.pendientes().length, 0);
  assert.strictEqual(s.catalogo().find(a => a.titulo === 'Static Bloom').promedio, 1);
  assert.match(s.actividad(5)[0].detalle, /aprobó|rechazó/);
});

t('exportar/cargar conserva el estado y onChange se dispara', () => {
  const s = fresh(); let calls = 0; s.onChange = () => calls++;
  s.agregarGenero(1, 'Jazz');
  assert.strictEqual(calls, 1);
  const copia = AlbumStore.create(JSON.parse(s.export()));
  assert.ok(copia.generos().some(g => g.nombre === 'Jazz'));
});

console.log('\n' + n + ' pruebas pasaron');
