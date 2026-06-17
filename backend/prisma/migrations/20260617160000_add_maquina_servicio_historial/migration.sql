-- CreateTable
CREATE TABLE "MaquinaServicioHistorial" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "maquinaId" TEXT NOT NULL,
    "servicioId" INTEGER NOT NULL,
    "fechaAsignacion" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaquinaServicioHistorial_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "Maquina" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MaquinaServicioHistorial_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Seed current machine-service assignments as the initial route.
INSERT INTO "MaquinaServicioHistorial" ("maquinaId", "servicioId", "fechaAsignacion")
SELECT "id", "servicioId", COALESCE("createdAt", CURRENT_TIMESTAMP)
FROM "Maquina";

-- CreateIndex
CREATE INDEX "MaquinaServicioHistorial_maquinaId_fechaAsignacion_idx" ON "MaquinaServicioHistorial"("maquinaId", "fechaAsignacion");

-- CreateIndex
CREATE INDEX "MaquinaServicioHistorial_servicioId_idx" ON "MaquinaServicioHistorial"("servicioId");
