CREATE TABLE "TipoMaquinaReferencia" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tipoMaquinaId" INTEGER NOT NULL,
    "s3Key" TEXT NOT NULL,
    "originalName" TEXT,
    "mimeType" TEXT,
    "descripcion" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TipoMaquinaReferencia_tipoMaquinaId_fkey" FOREIGN KEY ("tipoMaquinaId") REFERENCES "TipoMaquina" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TipoMaquinaReferencia_s3Key_key" ON "TipoMaquinaReferencia"("s3Key");
CREATE INDEX "TipoMaquinaReferencia_tipoMaquinaId_createdAt_idx" ON "TipoMaquinaReferencia"("tipoMaquinaId", "createdAt");
