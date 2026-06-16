-- AlterTable
ALTER TABLE "Eventual" ADD COLUMN "serviciosExtrasSubcontratados" TEXT;
ALTER TABLE "Eventual" ADD COLUMN "trabajosRealizados" TEXT;

-- CreateTable
CREATE TABLE "PedidoVehiculo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pedidoId" TEXT NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    CONSTRAINT "PedidoVehiculo_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PedidoVehiculo_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Maquina" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipo" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "serie" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'disponible',
    "servicioId" INTEGER NOT NULL,
    "fechaCompra" DATETIME,
    "proveedorFactura" TEXT,
    "empresa" TEXT,
    "anio" INTEGER,
    "amortizacion" INTEGER,
    "antiguedad" INTEGER,
    "valorUsadaDolares" REAL,
    "valorUsadaPesos" REAL,
    "valorNuevaDolares" REAL,
    "valorNuevaPesos" REAL,
    "origenInfo" TEXT,
    "servicioAmortizacionId" INTEGER,
    "comentarios" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Maquina_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Maquina_servicioAmortizacionId_fkey" FOREIGN KEY ("servicioAmortizacionId") REFERENCES "Servicio" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Maquina" ("createdAt", "estado", "id", "modelo", "serie", "servicioId", "tipo") SELECT "createdAt", "estado", "id", "modelo", "serie", "servicioId", "tipo" FROM "Maquina";
DROP TABLE "Maquina";
ALTER TABLE "new_Maquina" RENAME TO "Maquina";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE UNIQUE INDEX "PedidoVehiculo_pedidoId_vehiculoId_key" ON "PedidoVehiculo"("pedidoId", "vehiculoId");