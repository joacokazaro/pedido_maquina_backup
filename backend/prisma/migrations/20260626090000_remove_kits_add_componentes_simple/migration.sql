-- Remove KIT structure and move Eventual to simplified componentes model
PRAGMA foreign_keys=OFF;

DROP TABLE IF EXISTS "KitMaquina";
DROP TABLE IF EXISTS "KitVehiculo";
DROP TABLE IF EXISTS "Kit";

CREATE TABLE "new_Eventual" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "nombre" TEXT NOT NULL,
  "supervisorId" INTEGER NOT NULL,
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
  CONSTRAINT "Eventual_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_Eventual" (
  "id",
  "nombre",
  "supervisorId",
  "estado",
  "fechaInicio",
  "fechaFin",
  "observaciones",
  "componentesUtilizados",
  "trabajosRealizados",
  "serviciosExtrasSubcontratados",
  "activo",
  "createdAt"
)
SELECT
  "id",
  "nombre",
  "supervisorId",
  "estado",
  "fechaInicio",
  "fechaFin",
  "observaciones",
  "componentesUtilizados",
  "trabajosRealizados",
  "serviciosExtrasSubcontratados",
  "activo",
  "createdAt"
FROM "Eventual";

DROP TABLE "Eventual";
ALTER TABLE "new_Eventual" RENAME TO "Eventual";

CREATE UNIQUE INDEX "Eventual_nombre_key" ON "Eventual"("nombre");

PRAGMA foreign_keys=ON;
