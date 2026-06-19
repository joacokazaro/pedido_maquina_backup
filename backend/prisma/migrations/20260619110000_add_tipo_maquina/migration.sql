-- CreateTable
CREATE TABLE "TipoMaquina" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "TipoMaquina_nombre_key" ON "TipoMaquina"("nombre");

-- Backfill from current machines.
INSERT OR IGNORE INTO "TipoMaquina" ("nombre")
SELECT DISTINCT TRIM("tipo")
FROM "Maquina"
WHERE "tipo" IS NOT NULL AND TRIM("tipo") <> '';

-- Preserve the historical frontend defaults even when no machine exists yet.
INSERT OR IGNORE INTO "TipoMaquina" ("nombre") VALUES
('LUSTRADORA'),
('SOPLADORA'),
('HIDROLAVADORA'),
('LAVADORA'),
('ASPIRADORA'),
('MOTOGUADAÑA'),
('CARGADOR'),
('CARGADOR AGIBOT'),
('BOMBA DESINFECCION'),
('ROBOT DE LIMPIEZA');
