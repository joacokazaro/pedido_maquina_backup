-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN "vtoCarnetConductor" DATETIME;

-- CreateTable
CREATE TABLE "Seguro" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Vehiculo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresa" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "vehiculo" TEXT NOT NULL,
    "patente" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "motor" TEXT NOT NULL,
    "chasis" TEXT NOT NULL,
    "tipoCobertura" TEXT NOT NULL,
    "seguroId" INTEGER NOT NULL,
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
    CONSTRAINT "Vehiculo_seguroId_fkey" FOREIGN KEY ("seguroId") REFERENCES "Seguro" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Vehiculo_conductorActualId_fkey" FOREIGN KEY ("conductorActualId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VehiculoAsignacion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vehiculoId" TEXT NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "asignadoPorId" INTEGER,
    "fechaDesde" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaHasta" DATETIME,
    "observacion" TEXT,
    CONSTRAINT "VehiculoAsignacion_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VehiculoAsignacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VehiculoAsignacion_asignadoPorId_fkey" FOREIGN KEY ("asignadoPorId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Seguro_nombre_key" ON "Seguro"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Vehiculo_patente_key" ON "Vehiculo"("patente");

-- CreateIndex
CREATE INDEX "VehiculoAsignacion_vehiculoId_fechaHasta_idx" ON "VehiculoAsignacion"("vehiculoId", "fechaHasta");

-- CreateIndex
CREATE INDEX "VehiculoAsignacion_usuarioId_fechaHasta_idx" ON "VehiculoAsignacion"("usuarioId", "fechaHasta");
