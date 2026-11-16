# AlbumMatch

Página web donde los usuarios descubren, califican y reseñan **álbumes musicales completos**.
Proyecto final de *Laboratorio de Programación Web* · FIME – UANL.

Fase 1 (planeación, 16 pantallas) · Fase 2 (base de datos) · **Fase 3 (backend PHP + MySQL)**.

## Estructura

```
index.html                 punto de entrada
assets/css/styles.css      estilos
assets/js/app.js           interfaz: rutas, sesión y las 16 pantallas
assets/js/api.js           única capa que habla con los datos (modo servidor o demo)
assets/js/dispatch.js      CONTRATO de la API (referencia en JS)
assets/js/store.js         modelo en memoria para el modo demo (espejo de la BD)
assets/js/config.js        modo: auto | demo | server
api/index.php              API en PHP (implementa el contrato)
api/lib/*.php              lógica por área: catálogo, auth, reseñas, listas, admin
database/albummatch.sql    tablas, vistas, trigger y datos de ejemplo
database/usuario_app.sql   usuario de MySQL con permisos mínimos (opcional, recomendado)
tests/                     pruebas
```

## Dos modos

| Modo | Cuándo | Datos |
|---|---|---|
| **demo** | abres `index.html` desde el disco o en GitHub Pages | en tu navegador (se pueden restablecer desde el pie de página) |
| **server** | corre en XAMPP / Apache con PHP | MySQL (`api/index.php`) |

`mode: 'auto'` en `assets/js/config.js` elige solo; puedes forzar `'demo'` o `'server'`.

## Instalación en XAMPP (modo servidor)

1. Copia la carpeta del proyecto a `htdocs/albummatch`.
2. Inicia **Apache** y **MySQL** en XAMPP.
3. En phpMyAdmin: *Importar* → `database/albummatch.sql`.
4. Abre `http://localhost/albummatch/`.

Por defecto la API usa `root` sin contraseña (lo normal en XAMPP local). Para algo más serio:
ejecuta `database/usuario_app.sql` (cambia la clave), copia `api/config.local.php.example`
a `api/config.local.php` y pon ahí tus datos. Ese archivo no se sube a git.

### Cuentas de prueba

Contraseña de todas: `AlbumMatch2026!` (cámbiala antes de usar en serio).

| Rol | Correo |
|---|---|
| Administrador | `admin@albummatch.com` |
| Usuario | `marina@ejemplo.com` |

## Pruebas

```
node tests/store.test.js                                  # reglas de negocio del modo demo
python3 tests/e2e.py                                      # recorrido en navegador, modo demo
node tests/mock_server.js 8099                            # servidor SIN PHP con el mismo contrato
python3 tests/api_contract.py http://127.0.0.1:8099       # contrato de la API (107 comprobaciones)
python3 tests/e2e.py http://127.0.0.1:8099/index.html     # navegador contra ese servidor
python3 tests/php_sql_check.py                            # las consultas de api/ usan columnas reales
```

**Para validar tu PHP** (con XAMPP corriendo y la base recién importada):

```
python3 tests/api_contract.py http://localhost/albummatch
python3 tests/e2e.py http://localhost/albummatch/index.html
```

Corre cada una sobre una base recién importada (la primera deja datos de prueba que la segunda no espera).
Son las mismas comprobaciones que ya pasan contra la implementación de referencia. Si alguna
falla, el mensaje dice qué regla no coincide. Dependencias: Python 3 y (solo para `e2e.py`)
`pip install playwright && playwright install chromium`.

## Seguridad (qué hace la API)

- Consultas siempre preparadas (PDO, sin concatenar datos del usuario).
- Contraseñas con `password_hash` / `password_verify`; el hash nunca sale de la API.
- Sesión PHP con cookie `HttpOnly` + `SameSite=Lax`; `session_regenerate_id` al iniciar sesión.
- El usuario que actúa sale siempre de la sesión, nunca de lo que envía el navegador.
- Permisos por operación (público / con sesión / usuario / administrador) comprobados en el servidor.
- Solo acepta `POST` con `Content-Type: application/json` y mismo origen (frena CSRF).
- `database/`, `tests/` y `api/lib/` llevan `.htaccess` que impide descargarlos.
- **Pendiente**: límite de intentos de inicio de sesión y recuperación de contraseña por correo.

## Decisiones y notas

- Las reseñas nuevas entran como **Pendiente** y cuentan para el promedio solo al aprobarse.
- Se añadió «Descartar» en reportes para cerrar un reporte sin sancionar.
- Al eliminar una reseña reportada, el reporte desaparece en cascada (así lo define la BD).
- `ck_reporte_objetivo` es un `CHECK` sobre columnas con `ON DELETE`: MariaDB (XAMPP) lo acepta, MySQL 8 no.
- Se conservan las dos propuestas de autenticación (`#auth` y `#auth-single`); hay que elegir una y borrar la otra.
- El modo demo usa un hash de contraseña de juguete; el servidor usa `password_hash`.
