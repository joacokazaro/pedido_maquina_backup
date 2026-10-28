-- CreateTable
CREATE TABLE "InformeServicio" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "servicioId" INTEGER NOT NULL,
    "fechaDesde" DATETIME NOT NULL,
    "fechaHasta" DATETIME NOT NULL,
    "maquinasUtilizadas" TEXT,
    "vehiculosUtilizados" TEXT,
    "trabajosRealizados" TEXT,
    "serviciosExtrasSubcontratados" TEXT,
    "horasBrowix" TEXT,
    "insumosImportados" TEXT,
    "insumosExtras" TEXT,
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoPorId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InformeServicio_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InformeServicio_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "InformeServicio_servicioId_fechaDesde_idx" ON "InformeServicio"("servicioId", "fechaDesde");
