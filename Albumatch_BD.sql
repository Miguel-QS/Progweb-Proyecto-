-- =====================================================================
-- AlbumMatch - Base de datos (versión corregida)
-- Probado en MariaDB 10.11 (XAMPP). Contraseña de TODOS los usuarios de
-- prueba: AlbumMatch2026!   (cámbiala antes de usar en serio)
-- OJO: este script NO borra la base si ya existe. Si quieres reiniciarla,
-- ejecuta manualmente: DROP DATABASE albummatch;
-- =====================================================================

CREATE DATABASE albummatch CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE albummatch;
SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- Catálogos
-- ---------------------------------------------------------------------
CREATE TABLE rol (
  id_rol      TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre      VARCHAR(30)  NOT NULL,
  descripcion VARCHAR(150) NULL,
  PRIMARY KEY (id_rol),
  UNIQUE KEY uq_rol_nombre (nombre)
) ENGINE=InnoDB;

CREATE TABLE genero (
  id_genero SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre    VARCHAR(50) NOT NULL,
  PRIMARY KEY (id_genero),
  UNIQUE KEY uq_genero_nombre (nombre)
) ENGINE=InnoDB;

CREATE TABLE estado_resena (
  id_estado TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre    VARCHAR(30) NOT NULL,
  PRIMARY KEY (id_estado),
  UNIQUE KEY uq_estado_resena_nombre (nombre)
) ENGINE=InnoDB;

CREATE TABLE tipo_lista (
  id_tipo TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre  VARCHAR(30) NOT NULL,
  PRIMARY KEY (id_tipo),
  UNIQUE KEY uq_tipo_lista_nombre (nombre)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Usuarios
-- ---------------------------------------------------------------------
CREATE TABLE usuario (
  id_usuario      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_rol          TINYINT UNSIGNED NOT NULL,
  nombre_usuario  VARCHAR(30)  NOT NULL,
  correo          VARCHAR(100) NOT NULL,
  contrasena_hash VARCHAR(255) NOT NULL,
  biografia       VARCHAR(300) NULL,
  avatar_url      VARCHAR(255) NULL,
  activo          TINYINT(1)   NOT NULL DEFAULT 1,
  fecha_registro  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_usuario),
  UNIQUE KEY uq_usuario_nombre (nombre_usuario),
  UNIQUE KEY uq_usuario_correo (correo),
  CONSTRAINT fk_usuario_rol FOREIGN KEY (id_rol) REFERENCES rol (id_rol)
) ENGINE=InnoDB;

CREATE TABLE usuario_genero (
  id_usuario INT UNSIGNED NOT NULL,
  id_genero  SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (id_usuario, id_genero),
  CONSTRAINT fk_ug_usuario FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario) ON DELETE CASCADE,
  CONSTRAINT fk_ug_genero  FOREIGN KEY (id_genero)  REFERENCES genero (id_genero)   ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Música
-- ---------------------------------------------------------------------
CREATE TABLE artista (
  id_artista INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_genero  SMALLINT UNSIGNED NOT NULL,
  nombre     VARCHAR(100) NOT NULL,
  pais       VARCHAR(60)  NULL,
  biografia  VARCHAR(1000) NULL,
  PRIMARY KEY (id_artista),
  UNIQUE KEY uq_artista_nombre (nombre),
  -- Necesario para la FK compuesta de album (garantiza género consistente)
  UNIQUE KEY uq_artista_id_genero (id_artista, id_genero),
  CONSTRAINT fk_artista_genero FOREIGN KEY (id_genero) REFERENCES genero (id_genero)
) ENGINE=InnoDB;

CREATE TABLE album (
  id_album         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_artista       INT UNSIGNED NOT NULL,
  id_genero        SMALLINT UNSIGNED NOT NULL,
  titulo           VARCHAR(100) NOT NULL,
  anio_lanzamiento SMALLINT UNSIGNED NOT NULL,
  portada_hue      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  fecha_registro   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_album),
  UNIQUE KEY uq_album_artista_titulo (id_artista, titulo),
  KEY ix_album_titulo (titulo),
  CONSTRAINT ck_album_anio CHECK (anio_lanzamiento BETWEEN 1900 AND 2100),
  CONSTRAINT ck_album_hue  CHECK (portada_hue BETWEEN 0 AND 360),
  CONSTRAINT fk_album_artista FOREIGN KEY (id_artista) REFERENCES artista (id_artista),
  CONSTRAINT fk_album_genero  FOREIGN KEY (id_genero)  REFERENCES genero (id_genero),
  -- El género del álbum debe ser el mismo que el de su artista
  CONSTRAINT fk_album_artista_genero FOREIGN KEY (id_artista, id_genero)
    REFERENCES artista (id_artista, id_genero)
) ENGINE=InnoDB;

CREATE TABLE cancion (
  id_cancion   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_album     INT UNSIGNED NOT NULL,
  numero_pista TINYINT UNSIGNED NOT NULL,
  titulo       VARCHAR(100) NOT NULL,
  duracion_seg SMALLINT UNSIGNED NOT NULL,
  es_sencillo  TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id_cancion),
  UNIQUE KEY uq_cancion_pista (id_album, numero_pista),
  CONSTRAINT ck_cancion_pista    CHECK (numero_pista > 0),
  CONSTRAINT ck_cancion_duracion CHECK (duracion_seg > 0),
  CONSTRAINT fk_cancion_album FOREIGN KEY (id_album) REFERENCES album (id_album) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Reseñas y moderación
-- ---------------------------------------------------------------------
CREATE TABLE resena (
  id_resena         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario        INT UNSIGNED NOT NULL,
  id_album          INT UNSIGNED NOT NULL,
  id_estado         TINYINT UNSIGNED NOT NULL DEFAULT 1,   -- 1 = Pendiente (moderación)
  calificacion      TINYINT UNSIGNED NOT NULL,
  comentario        VARCHAR(1000) NULL,
  fecha_publicacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_edicion     DATETIME NULL,
  PRIMARY KEY (id_resena),
  UNIQUE KEY uq_resena_usuario_album (id_usuario, id_album),
  KEY ix_resena_album_estado (id_album, id_estado),
  CONSTRAINT ck_resena_calificacion CHECK (calificacion BETWEEN 1 AND 5),
  CONSTRAINT fk_resena_usuario FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario) ON DELETE CASCADE,
  CONSTRAINT fk_resena_album   FOREIGN KEY (id_album)   REFERENCES album (id_album)     ON DELETE CASCADE,
  CONSTRAINT fk_resena_estado  FOREIGN KEY (id_estado)  REFERENCES estado_resena (id_estado)
) ENGINE=InnoDB;

CREATE TABLE reporte (
  id_reporte           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario_reporta   INT UNSIGNED NULL,          -- NULL si el usuario que reportó fue eliminado
  id_resena            INT UNSIGNED NULL,
  id_usuario_reportado INT UNSIGNED NULL,
  motivo               VARCHAR(255) NOT NULL,
  fecha_reporte        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atendido             TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id_reporte),
  -- Evita reportes duplicados del mismo usuario al mismo objetivo
  UNIQUE KEY uq_reporte_resena  (id_usuario_reporta, id_resena),
  UNIQUE KEY uq_reporte_usuario (id_usuario_reporta, id_usuario_reportado),
  -- Debe reportarse EXACTAMENTE una cosa: una reseña o un usuario
  CONSTRAINT ck_reporte_objetivo CHECK ((id_resena IS NULL) <> (id_usuario_reportado IS NULL)),
  -- Si se borra quien reportó, el reporte se conserva
  CONSTRAINT fk_reporte_reporta   FOREIGN KEY (id_usuario_reporta)   REFERENCES usuario (id_usuario) ON DELETE SET NULL,
  -- Si se borra el objetivo, el reporte ya no tiene sentido
  CONSTRAINT fk_reporte_resena    FOREIGN KEY (id_resena)            REFERENCES resena (id_resena)   ON DELETE CASCADE,
  CONSTRAINT fk_reporte_reportado FOREIGN KEY (id_usuario_reportado) REFERENCES usuario (id_usuario) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Nadie puede reportarse a sí mismo (trigger, porque MariaDB no permite un CHECK
-- sobre una columna con ON DELETE SET NULL)
DELIMITER $$
CREATE TRIGGER trg_reporte_no_self BEFORE INSERT ON reporte
FOR EACH ROW
BEGIN
  IF NEW.id_usuario_reporta IS NOT NULL
     AND NEW.id_usuario_reporta = NEW.id_usuario_reportado THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Un usuario no puede reportarse a si mismo';
  END IF;
END$$
DELIMITER ;

-- ---------------------------------------------------------------------
-- Listas y bitácora
-- ---------------------------------------------------------------------
CREATE TABLE lista (
  id_lista       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario     INT UNSIGNED NOT NULL,
  id_tipo        TINYINT UNSIGNED NOT NULL,
  nombre         VARCHAR(60) NOT NULL,
  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_lista),
  UNIQUE KEY uq_lista_usuario_nombre (id_usuario, nombre),
  CONSTRAINT fk_lista_usuario FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario) ON DELETE CASCADE,
  CONSTRAINT fk_lista_tipo    FOREIGN KEY (id_tipo)    REFERENCES tipo_lista (id_tipo)
) ENGINE=InnoDB;

CREATE TABLE lista_album (
  id_lista       INT UNSIGNED NOT NULL,
  id_album       INT UNSIGNED NOT NULL,
  fecha_agregado DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_lista, id_album),
  CONSTRAINT fk_la_lista FOREIGN KEY (id_lista) REFERENCES lista (id_lista) ON DELETE CASCADE,
  CONSTRAINT fk_la_album FOREIGN KEY (id_album) REFERENCES album (id_album) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE bitacora (
  id_bitacora INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario  INT UNSIGNED NULL,
  accion      VARCHAR(40) NOT NULL,
  detalle     VARCHAR(255) NULL,
  fecha       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_bitacora),
  KEY ix_bitacora_fecha (fecha),
  CONSTRAINT fk_bitacora_usuario FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Vistas (ya no dependen del id numérico del estado: usan el nombre)
-- promedio es NULL cuando el álbum aún no tiene reseñas aprobadas
-- ---------------------------------------------------------------------
CREATE VIEW v_album_calificacion AS
SELECT a.id_album,
       ROUND(AVG(r.calificacion), 1) AS promedio,
       COUNT(r.id_resena)            AS total_resenas
FROM album a
LEFT JOIN (
    SELECT rs.id_album, rs.id_resena, rs.calificacion
    FROM resena rs
    JOIN estado_resena e ON e.id_estado = rs.id_estado AND e.nombre = 'Aprobada'
) r ON r.id_album = a.id_album
GROUP BY a.id_album
ORDER BY a.id_album;

CREATE VIEW v_catalogo AS
SELECT a.id_album, a.titulo, a.anio_lanzamiento, a.portada_hue,
       ar.id_artista, ar.nombre AS artista,
       g.id_genero,  g.nombre  AS genero,
       c.promedio, c.total_resenas
FROM album a
JOIN artista ar ON ar.id_artista = a.id_artista
JOIN genero  g  ON g.id_genero   = a.id_genero
JOIN v_album_calificacion c ON c.id_album = a.id_album
ORDER BY a.id_album;

-- =====================================================================
-- DATOS INICIALES
-- =====================================================================
INSERT INTO rol (nombre, descripcion) VALUES
 ('Usuario',       'Califica y reseña álbumes, crea listas y personaliza su perfil'),
 ('Administrador', 'Gestiona álbumes, artistas, géneros, canciones, reseñas y cuentas');

INSERT INTO estado_resena (nombre) VALUES ('Pendiente'), ('Aprobada'), ('Rechazada');

INSERT INTO tipo_lista (nombre) VALUES
 ('Quiero escuchar'), ('Favoritos'), ('Historial de escuchados'), ('Personalizada');

INSERT INTO genero (nombre) VALUES
 ('Rock alternativo'), ('Pop'), ('Indie / Folk'), ('Electrónica'),
 ('Latin Pop'), ('Indie Pop'), ('Folk');

INSERT INTO artista (id_genero, nombre, pais, biografia) VALUES
 ((SELECT id_genero FROM genero WHERE nombre='Rock alternativo'), 'Cinder & Static', 'México',
  'Dúo formado en 2016, conocido por mezclar guitarras saturadas con arreglos electrónicos escasos. Sus letras giran en torno a la memoria y los paisajes industriales.'),
 ((SELECT id_genero FROM genero WHERE nombre='Pop'),              'Nadia Cole',        'Estados Unidos', NULL),
 ((SELECT id_genero FROM genero WHERE nombre='Rock alternativo'), 'The Low Orbit',     'Reino Unido',    NULL),
 ((SELECT id_genero FROM genero WHERE nombre='Indie / Folk'),     'Wren Auer',         'Canadá',         NULL),
 ((SELECT id_genero FROM genero WHERE nombre='Electrónica'),      'Glass Foundry',     'Alemania',       NULL),
 ((SELECT id_genero FROM genero WHERE nombre='Latin Pop'),        'Marisol Vega',      'Colombia',       NULL),
 ((SELECT id_genero FROM genero WHERE nombre='Rock alternativo'), 'Night Ledger',      NULL, NULL),
 ((SELECT id_genero FROM genero WHERE nombre='Indie Pop'),        'Kite Season',       NULL, NULL),
 ((SELECT id_genero FROM genero WHERE nombre='Folk'),             'Rosalind Marsh',    NULL, NULL),
 ((SELECT id_genero FROM genero WHERE nombre='Electrónica'),      'The Quiet Machine', NULL, NULL);

-- fecha_registro explícita (anterior a las reseñas) para que las fechas sean coherentes
INSERT INTO album (id_artista, id_genero, titulo, anio_lanzamiento, portada_hue, fecha_registro) VALUES
 ((SELECT id_artista FROM artista WHERE nombre='Cinder & Static'),   (SELECT id_genero FROM genero WHERE nombre='Rock alternativo'), 'Reverb Ash',        2024, 262, '2025-06-15 10:00:00'),
 ((SELECT id_artista FROM artista WHERE nombre='Nadia Cole'),        (SELECT id_genero FROM genero WHERE nombre='Pop'),              'Skyline Static',    2023, 335, '2025-06-15 10:00:00'),
 ((SELECT id_artista FROM artista WHERE nombre='The Low Orbit'),     (SELECT id_genero FROM genero WHERE nombre='Rock alternativo'), 'Halide',            2022, 200, '2025-06-15 10:00:00'),
 ((SELECT id_artista FROM artista WHERE nombre='Wren Auer'),         (SELECT id_genero FROM genero WHERE nombre='Indie / Folk'),     'Paper Weather',     2021, 28,  '2025-06-15 10:00:00'),
 ((SELECT id_artista FROM artista WHERE nombre='Glass Foundry'),     (SELECT id_genero FROM genero WHERE nombre='Electrónica'),      'Tectonic',          2024, 190, '2025-06-15 10:00:00'),
 ((SELECT id_artista FROM artista WHERE nombre='Marisol Vega'),      (SELECT id_genero FROM genero WHERE nombre='Latin Pop'),        'Ceniza',            2023, 355, '2025-06-15 10:00:00'),
 ((SELECT id_artista FROM artista WHERE nombre='Night Ledger'),      (SELECT id_genero FROM genero WHERE nombre='Rock alternativo'), 'Afterglow Freight', 2020, 250, '2025-06-15 10:00:00'),
 ((SELECT id_artista FROM artista WHERE nombre='Kite Season'),       (SELECT id_genero FROM genero WHERE nombre='Indie Pop'),        'Static Bloom',      2022, 300, '2025-06-15 10:00:00'),
 ((SELECT id_artista FROM artista WHERE nombre='Rosalind Marsh'),    (SELECT id_genero FROM genero WHERE nombre='Folk'),             'Salt Year',         2019, 40,  '2025-06-15 10:00:00'),
 ((SELECT id_artista FROM artista WHERE nombre='The Quiet Machine'), (SELECT id_genero FROM genero WHERE nombre='Electrónica'),      'Wavelength',        2021, 210, '2025-06-15 10:00:00'),
 ((SELECT id_artista FROM artista WHERE nombre='Cinder & Static'),   (SELECT id_genero FROM genero WHERE nombre='Rock alternativo'), 'Low Tide Radio',    2019, 262, '2025-06-15 10:00:00'),
 ((SELECT id_artista FROM artista WHERE nombre='Marisol Vega'),      (SELECT id_genero FROM genero WHERE nombre='Latin Pop'),        'Nocturno',          2020, 355, '2025-06-15 10:00:00'),
 ((SELECT id_artista FROM artista WHERE nombre='Wren Auer'),         (SELECT id_genero FROM genero WHERE nombre='Indie / Folk'),     'Amber Hours',       2018, 28,  '2025-06-15 10:00:00'),
 ((SELECT id_artista FROM artista WHERE nombre='The Low Orbit'),     (SELECT id_genero FROM genero WHERE nombre='Rock alternativo'), 'Fault Lines',       2025, 200, '2025-06-15 10:00:00'),
 ((SELECT id_artista FROM artista WHERE nombre='Glass Foundry'),     (SELECT id_genero FROM genero WHERE nombre='Electrónica'),      'Analog Ghost',      2020, 190, '2025-06-15 10:00:00'),
 ((SELECT id_artista FROM artista WHERE nombre='Cinder & Static'),   (SELECT id_genero FROM genero WHERE nombre='Rock alternativo'), 'First Static',      2016, 262, '2025-06-15 10:00:00'),
 ((SELECT id_artista FROM artista WHERE nombre='Cinder & Static'),   (SELECT id_genero FROM genero WHERE nombre='Rock alternativo'), 'Ember Line',       2018, 262, '2025-06-15 10:00:00');

INSERT INTO cancion (id_album, numero_pista, titulo, duracion_seg, es_sencillo)
SELECT al.id_album, t.n, t.titulo, t.dur, t.sen
FROM album al
JOIN (SELECT 1 AS n, 'Vidrio y ceniza' AS titulo, 222 AS dur, 0 AS sen
      UNION ALL SELECT 2, 'Reverb Ash',   245, 0
      UNION ALL SELECT 3, 'Cuarto oscuro', 178, 1
      UNION ALL SELECT 4, 'Marea baja',    201, 0
      UNION ALL SELECT 5, 'Última señal',  277, 0) t
WHERE al.titulo = 'Reverb Ash';

-- Contraseña de todos los usuarios de prueba: AlbumMatch2026!  (bcrypt, compatible con password_verify de PHP)
INSERT INTO usuario (id_rol, nombre_usuario, correo, contrasena_hash, biografia, activo, fecha_registro) VALUES
 ((SELECT id_rol FROM rol WHERE nombre='Administrador'), 'admin',          'admin@albummatch.com',   '$2y$10$/CbVQFfdJ2psUgaFbiwG7.DsJvgG0z4twWKgQ7R0n6kmwuxfpz5je', NULL, 1, '2025-06-01 09:00:00'),
 ((SELECT id_rol FROM rol WHERE nombre='Usuario'),       'marina_ibarra',  'marina@ejemplo.com',     '$2y$10$/CbVQFfdJ2psUgaFbiwG7.DsJvgG0z4twWKgQ7R0n6kmwuxfpz5je',
   'Coleccionista de vinilos y buscadora incansable de bandas nuevas. Si suena a guitarras saturadas o sintetizadores nostálgicos, ya lo escuché tres veces.', 1, '2025-06-20 12:00:00'),
 ((SELECT id_rol FROM rol WHERE nombre='Usuario'),       'valeria_m',      'valeria@ejemplo.com',    '$2y$10$/CbVQFfdJ2psUgaFbiwG7.DsJvgG0z4twWKgQ7R0n6kmwuxfpz5je', NULL, 1, '2025-07-01 12:00:00'),
 ((SELECT id_rol FROM rol WHERE nombre='Usuario'),       'danielrx',       'daniel@ejemplo.com',     '$2y$10$/CbVQFfdJ2psUgaFbiwG7.DsJvgG0z4twWKgQ7R0n6kmwuxfpz5je', NULL, 1, '2025-07-01 12:00:00'),
 ((SELECT id_rol FROM rol WHERE nombre='Usuario'),       'mica.wave',      'mica@ejemplo.com',       '$2y$10$/CbVQFfdJ2psUgaFbiwG7.DsJvgG0z4twWKgQ7R0n6kmwuxfpz5je', NULL, 1, '2025-07-01 12:00:00'),
 ((SELECT id_rol FROM rol WHERE nombre='Usuario'),       'UsuarioX',       'usuariox@ejemplo.com',   '$2y$10$/CbVQFfdJ2psUgaFbiwG7.DsJvgG0z4twWKgQ7R0n6kmwuxfpz5je', NULL, 1, '2025-10-01 12:00:00'),
 ((SELECT id_rol FROM rol WHERE nombre='Usuario'),       'UsuarioY',       'usuarioy@ejemplo.com',   '$2y$10$/CbVQFfdJ2psUgaFbiwG7.DsJvgG0z4twWKgQ7R0n6kmwuxfpz5je', NULL, 1, '2025-10-01 12:00:00');

INSERT INTO usuario_genero (id_usuario, id_genero)
SELECT u.id_usuario, g.id_genero
FROM usuario u JOIN genero g ON g.nombre IN ('Rock alternativo', 'Indie / Folk', 'Electrónica')
WHERE u.nombre_usuario = 'marina_ibarra';

-- Reseñas aprobadas
INSERT INTO resena (id_usuario, id_album, id_estado, calificacion, comentario, fecha_publicacion) VALUES
 ((SELECT id_usuario FROM usuario WHERE nombre_usuario='valeria_m'),  (SELECT id_album FROM album WHERE titulo='Reverb Ash'), (SELECT id_estado FROM estado_resena WHERE nombre='Aprobada'), 5,
   'Cada canción se siente producida con cuidado. El sencillo tres es mi favorito, muy recomendado.', '2025-10-20 18:30:00'),
 ((SELECT id_usuario FROM usuario WHERE nombre_usuario='danielrx'),   (SELECT id_album FROM album WHERE titulo='Reverb Ash'), (SELECT id_estado FROM estado_resena WHERE nombre='Aprobada'), 4,
   'Buen trabajo en general, aunque algunas canciones no terminan de arrancar. Aun así vale la pena.', '2025-10-22 21:10:00'),
 ((SELECT id_usuario FROM usuario WHERE nombre_usuario='mica.wave'),  (SELECT id_album FROM album WHERE titulo='Reverb Ash'), (SELECT id_estado FROM estado_resena WHERE nombre='Aprobada'), 3,
   'Propuesta interesante, pero no todas las pistas lograron captar mi atención por completo.', '2025-10-23 09:45:00'),
 ((SELECT id_usuario FROM usuario WHERE nombre_usuario='marina_ibarra'), (SELECT id_album FROM album WHERE titulo='Reverb Ash'), (SELECT id_estado FROM estado_resena WHERE nombre='Aprobada'), 4,
   'Excelente álbum, cada canción se siente cuidada.', '2025-10-25 20:00:00'),
 ((SELECT id_usuario FROM usuario WHERE nombre_usuario='marina_ibarra'), (SELECT id_album FROM album WHERE titulo='Salt Year'), (SELECT id_estado FROM estado_resena WHERE nombre='Aprobada'), 5,
   'Un disco redondo, sin canciones de relleno.', '2025-09-15 19:20:00'),
 ((SELECT id_usuario FROM usuario WHERE nombre_usuario='marina_ibarra'), (SELECT id_album FROM album WHERE titulo='Paper Weather'), (SELECT id_estado FROM estado_resena WHERE nombre='Aprobada'), 4,
   'Propuesta interesante, aunque algo repetitiva.', '2025-08-01 17:05:00');

-- Reseñas pendientes de moderación (datos de prueba)
INSERT INTO resena (id_usuario, id_album, id_estado, calificacion, comentario, fecha_publicacion) VALUES
 ((SELECT id_usuario FROM usuario WHERE nombre_usuario='UsuarioX'), (SELECT id_album FROM album WHERE titulo='Halide'), (SELECT id_estado FROM estado_resena WHERE nombre='Pendiente'), 1,
   'Esta reseña contiene lenguaje inapropiado.', '2025-10-28 15:00:00'),
 ((SELECT id_usuario FROM usuario WHERE nombre_usuario='UsuarioY'), (SELECT id_album FROM album WHERE titulo='Static Bloom'), (SELECT id_estado FROM estado_resena WHERE nombre='Pendiente'), 1,
   'Comentario spam irrelevante.', '2025-10-28 15:30:00');

INSERT INTO reporte (id_usuario_reporta, id_usuario_reportado, motivo, fecha_reporte)
VALUES ((SELECT id_usuario FROM usuario WHERE nombre_usuario='admin'),
        (SELECT id_usuario FROM usuario WHERE nombre_usuario='UsuarioY'),
        'Comportamiento nocivo reiterado.', '2025-10-29 10:00:00');

INSERT INTO lista (id_usuario, id_tipo, nombre, fecha_creacion) VALUES
 ((SELECT id_usuario FROM usuario WHERE nombre_usuario='marina_ibarra'), (SELECT id_tipo FROM tipo_lista WHERE nombre='Quiero escuchar'),        'Quiero escuchar',         '2025-06-20 12:05:00'),
 ((SELECT id_usuario FROM usuario WHERE nombre_usuario='marina_ibarra'), (SELECT id_tipo FROM tipo_lista WHERE nombre='Favoritos'),              'Favoritos',               '2025-06-20 12:05:00'),
 ((SELECT id_usuario FROM usuario WHERE nombre_usuario='marina_ibarra'), (SELECT id_tipo FROM tipo_lista WHERE nombre='Historial de escuchados'), 'Historial de escuchados', '2025-06-20 12:05:00'),
 ((SELECT id_usuario FROM usuario WHERE nombre_usuario='marina_ibarra'), (SELECT id_tipo FROM tipo_lista WHERE nombre='Personalizada'),          'Mis favoritos del año',   '2025-06-21 18:00:00');

INSERT INTO lista_album (id_lista, id_album, fecha_agregado)
SELECT l.id_lista, a.id_album, '2025-09-01 20:00:00'
FROM lista l
JOIN usuario u ON u.id_usuario = l.id_usuario AND u.nombre_usuario = 'marina_ibarra'
JOIN album a ON (l.nombre = 'Quiero escuchar'         AND a.titulo IN ('Halide', 'Tectonic', 'Wavelength'))
             OR (l.nombre = 'Favoritos'               AND a.titulo IN ('Salt Year', 'Skyline Static', 'Ceniza'))
             OR (l.nombre = 'Historial de escuchados' AND a.titulo IN ('Reverb Ash', 'Afterglow Freight', 'Static Bloom'))
             OR (l.nombre = 'Mis favoritos del año'   AND a.titulo IN ('Paper Weather', 'Fault Lines', 'Low Tide Radio'));

INSERT INTO bitacora (id_usuario, accion, detalle, fecha) VALUES
 ((SELECT id_usuario FROM usuario WHERE nombre_usuario='valeria_m'), 'RESENA_PUBLICADA', 'valeria_m reseñó el álbum Reverb Ash',            '2025-10-20 18:30:00'),
 ((SELECT id_usuario FROM usuario WHERE nombre_usuario='danielrx'),  'RESENA_PUBLICADA', 'danielrx calificó Reverb Ash con 4 estrellas',    '2025-10-22 21:10:00'),
 ((SELECT id_usuario FROM usuario WHERE nombre_usuario='admin'),     'ALTA_ALBUM',       'admin añadió el álbum Fault Lines',              '2025-06-15 10:00:00');
