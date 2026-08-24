-- Backfill de Servicio.tipo / Eventual.tipo (LIMPIEZA / ESPACIOS_VERDES).
-- Corrida única y manual contra producción, DESPUÉS de deployar la migración
-- 20260824190035_add_tipo_servicio_eventual. No es parte del pipeline de deploy.
--
-- Uso (ver CLAUDE.md, sección "Base de datos SQLite en producción"):
--   cp pedido.db pedido.db.bak_$(date +%Y%m%d_%H%M%S)
--   sqlite3 pedido.db
--     PRAGMA foreign_keys = ON;
--     BEGIN TRANSACTION;
--     .read backfill-tipo-servicio-eventual.sql
--     -- revisar los SELECT de control antes de:
--     COMMIT;

-- 1) Servicios: clasificar por prefijo de idBrowix (K/C = Kazaró = Limpieza, P = Pazar = Espacios Verdes).
UPDATE Servicio SET tipo = 'LIMPIEZA' WHERE activo = 1 AND (idBrowix GLOB 'K*' OR idBrowix GLOB 'C*');
UPDATE Servicio SET tipo = 'ESPACIOS_VERDES' WHERE activo = 1 AND idBrowix GLOB 'P*';

-- 2) Eventuales: clasificación confirmada a mano por el usuario (2026-08-24).
UPDATE Eventual SET tipo = 'ESPACIOS_VERDES' WHERE id IN (4,11,18,19,21,22,23,25,26,27,30,32,33,35,36,37);
UPDATE Eventual SET tipo = 'LIMPIEZA' WHERE id IN (5,9,10,12,13,14,15,16,17,20,24,28,29,31,34);

-- 3) Propaga el tipo del Eventual a su Servicio homónimo (los "SE - ..." que crearPedido
--    auto-crea al disparar un pedido complementario y que no tienen idBrowix propio).
UPDATE Servicio SET tipo = (SELECT e.tipo FROM Eventual e WHERE e.nombre = Servicio.nombre AND e.tipo IS NOT NULL)
WHERE tipo IS NULL
  AND EXISTS (SELECT 1 FROM Eventual e WHERE e.nombre = Servicio.nombre AND e.tipo IS NOT NULL);

-- Controles post-backfill (deberían dar: 117 servicios activos repartidos entre
-- LIMPIEZA/ESPACIOS_VERDES/NULL, sin ningún otro valor; 31 eventuales, 16 EV / 15 L).
SELECT tipo, COUNT(*) FROM Servicio WHERE activo = 1 GROUP BY tipo;
SELECT tipo, COUNT(*) FROM Eventual GROUP BY tipo;
