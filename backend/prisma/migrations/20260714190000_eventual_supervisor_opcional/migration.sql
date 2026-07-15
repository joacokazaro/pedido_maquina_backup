-- Eventual.supervisorId pasa a ser opcional (el eventual puede crearse sin supervisor asignado)
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Eventual" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "nombre" TEXT NOT NULL,
  "supervisorId" INTEGER,
  "estado" TEXT NOT NULL DEFAULT 'activo',
  "fechaInicio" DATETIME,
  "fechaFin" DATETIME,
  "observaciones" TEXT,
  "maquinasUtilizadas" TEXT,
  "vehiculosUtilizados" TEXT,
  "componentesUtilizados" TEXT,
  "trabajosRealizados" TEXT,
  "serviciosExtrasSubcontratados" TEXT,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Eventual_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Eventual" (
  "id", "nombre", "supervisorId", "estado", "fechaInicio", "fechaFin", "observaciones", "maquinasUtilizadas", "vehiculosUtilizados", "componentesUtilizados", "trabajosRealizados", "serviciosExtrasSubcontratados", "activo", "createdAt"
)
SELECT
  "id", "nombre", "supervisorId", "estado", "fechaInicio", "fechaFin", "observaciones", "maquinasUtilizadas", "vehiculosUtilizados", "componentesUtilizados", "trabajosRealizados", "serviciosExtrasSubcontratados", "activo", "createdAt"
FROM "Eventual";
DROP TABLE "Eventual";
ALTER TABLE "new_Eventual" RENAME TO "Eventual";
CREATE UNIQUE INDEX "Eventual_nombre_key" ON "Eventual"("nombre");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
