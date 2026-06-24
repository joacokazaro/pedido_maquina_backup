CREATE TABLE "TallerMovimiento" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "tipo" TEXT NOT NULL,
  "maquinaId" TEXT,
  "vehiculoId" TEXT,
  "accion" TEXT NOT NULL,
  "observacion" TEXT,
  "usuarioId" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TallerMovimiento_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "Maquina" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "TallerMovimiento_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "TallerMovimiento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "TallerMovimiento_tipo_createdAt_idx" ON "TallerMovimiento"("tipo", "createdAt");
CREATE INDEX "TallerMovimiento_maquinaId_createdAt_idx" ON "TallerMovimiento"("maquinaId", "createdAt");
CREATE INDEX "TallerMovimiento_vehiculoId_createdAt_idx" ON "TallerMovimiento"("vehiculoId", "createdAt");
CREATE INDEX "TallerMovimiento_usuarioId_createdAt_idx" ON "TallerMovimiento"("usuarioId", "createdAt");