-- CreateTable
CREATE TABLE "PlazoAmortizacion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "meses" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- AlterTable
ALTER TABLE "TipoMaquina" ADD COLUMN "plazoAmortizacionId" INTEGER;
ALTER TABLE "Maquina" ADD COLUMN "tipoMaquinaId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "PlazoAmortizacion_nombre_key" ON "PlazoAmortizacion"("nombre");
CREATE INDEX "TipoMaquina_plazoAmortizacionId_idx" ON "TipoMaquina"("plazoAmortizacionId");
CREATE INDEX "Maquina_tipoMaquinaId_idx" ON "Maquina"("tipoMaquinaId");

-- Backfill and normalization for existing machine types.
INSERT OR IGNORE INTO "TipoMaquina" ("nombre") VALUES ('SIN TIPO');

UPDATE "Maquina"
SET "tipo" = UPPER(TRIM(COALESCE("tipo", '')));

UPDATE "Maquina"
SET "tipo" = 'SIN TIPO'
WHERE "tipo" IS NULL OR TRIM("tipo") = '';

UPDATE "Maquina"
SET "tipoMaquinaId" = (
    SELECT t."id"
    FROM "TipoMaquina" t
    WHERE UPPER(TRIM(t."nombre")) = UPPER(TRIM("Maquina"."tipo"))
    LIMIT 1
);

UPDATE "Maquina"
SET "tipoMaquinaId" = (
    SELECT "id" FROM "TipoMaquina" WHERE "nombre" = 'SIN TIPO' LIMIT 1
)
WHERE "tipoMaquinaId" IS NULL;

UPDATE "Maquina"
SET "tipo" = (
    SELECT t."nombre" FROM "TipoMaquina" t WHERE t."id" = "Maquina"."tipoMaquinaId"
)
WHERE "tipoMaquinaId" IS NOT NULL;
