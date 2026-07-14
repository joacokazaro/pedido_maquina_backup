-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Vehiculo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipoMaquinaId" INTEGER,
    "empresa" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "vehiculo" TEXT NOT NULL,
    "patente" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "numeroPoliza" TEXT,
    "motor" TEXT NOT NULL,
    "chasis" TEXT NOT NULL,
    "tipoCobertura" TEXT NOT NULL,
    "seguroId" INTEGER,
    "conductorActualId" INTEGER,
    "vtoSeguro" DATETIME,
    "vtoSeguroAplica" BOOLEAN NOT NULL DEFAULT true,
    "vtoMatafuego" DATETIME,
    "vtoMatafuegoAplica" BOOLEAN NOT NULL DEFAULT true,
    "vtoItv" DATETIME,
    "vtoItvAplica" BOOLEAN NOT NULL DEFAULT true,
    "obleaGnc" DATETIME,
    "obleaGncAplica" BOOLEAN NOT NULL DEFAULT true,
    "pruebaHidraulicaGnc" DATETIME,
    "pruebaHidraulicaGncAplica" BOOLEAN NOT NULL DEFAULT true,
    "tarjetaVerde" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Vehiculo_seguroId_fkey" FOREIGN KEY ("seguroId") REFERENCES "Seguro" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Vehiculo_tipoMaquinaId_fkey" FOREIGN KEY ("tipoMaquinaId") REFERENCES "TipoMaquina" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Vehiculo_conductorActualId_fkey" FOREIGN KEY ("conductorActualId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Vehiculo" (
  "chasis", "conductorActualId", "createdAt", "empresa", "estado", "id", "modelo", "motor", "numeroPoliza", "obleaGnc", "obleaGncAplica", "patente", "pruebaHidraulicaGnc", "pruebaHidraulicaGncAplica", "seguroId", "tarjetaVerde", "tipoCobertura", "tipoMaquinaId", "vehiculo", "vtoItv", "vtoItvAplica", "vtoMatafuego", "vtoMatafuegoAplica", "vtoSeguro", "vtoSeguroAplica"
)
SELECT
  "chasis", "conductorActualId", "createdAt", "empresa", "estado", "id", "modelo", "motor", "numeroPoliza", "obleaGnc", "obleaGncAplica", "patente", "pruebaHidraulicaGnc", "pruebaHidraulicaGncAplica", "seguroId", "tarjetaVerde", "tipoCobertura", "tipoMaquinaId", "vehiculo", "vtoItv", "vtoItvAplica", "vtoMatafuego", "vtoMatafuegoAplica", "vtoSeguro", "vtoSeguroAplica"
FROM "Vehiculo";
DROP TABLE "Vehiculo";
ALTER TABLE "new_Vehiculo" RENAME TO "Vehiculo";
CREATE UNIQUE INDEX "Vehiculo_patente_key" ON "Vehiculo"("patente");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
