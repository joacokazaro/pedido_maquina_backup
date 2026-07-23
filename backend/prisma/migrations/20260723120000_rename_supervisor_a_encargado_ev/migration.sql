-- Rename del rol "supervisor" (ex único rol supervisor) a "encargado_ev".
-- El rol se guarda como String libre (Prisma no soporta enums sobre SQLite),
-- por eso es una migración puramente de datos, sin cambios de schema.
-- Los usuarios afectados conservan intactas sus asignaciones (UsuarioServicio),
-- pedidos (Pedido.supervisorId) y eventuales (Eventual.supervisorId), que
-- referencian el ID del usuario y no el rol.

UPDATE "Usuario"    SET "rol" = 'encargado_ev' WHERE "rol" = 'supervisor';
UPDATE "UsuarioRol" SET "rol" = 'encargado_ev' WHERE "rol" = 'supervisor';
