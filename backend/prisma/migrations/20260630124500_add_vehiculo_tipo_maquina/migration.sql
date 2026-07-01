-- Ensure vehicle machine type exists.
INSERT OR IGNORE INTO "TipoMaquina" ("nombre") VALUES ('VEHICULO');

-- Add relation field in Vehiculo.
ALTER TABLE "Vehiculo" ADD COLUMN "tipoMaquinaId" INTEGER;

-- Backfill existing vehicles to VEHICULO type.
UPDATE "Vehiculo"
SET "tipoMaquinaId" = (
  SELECT "id" FROM "TipoMaquina" WHERE "nombre" = 'VEHICULO' LIMIT 1
)
WHERE "tipoMaquinaId" IS NULL;

-- Add index for lookups.
CREATE INDEX "Vehiculo_tipoMaquinaId_idx" ON "Vehiculo"("tipoMaquinaId");
