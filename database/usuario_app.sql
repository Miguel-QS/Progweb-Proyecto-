-- Usuario de MySQL con permisos mínimos para la aplicación (no puede crear ni borrar tablas).
-- Ejecútalo como root DESPUÉS de importar albummatch.sql, cambia la clave y ponla en api/config.local.php.
CREATE USER IF NOT EXISTS 'albummatch_app'@'localhost' IDENTIFIED BY 'CAMBIA_ESTA_CLAVE';
GRANT SELECT, INSERT, UPDATE, DELETE ON albummatch.* TO 'albummatch_app'@'localhost';
FLUSH PRIVILEGES;
