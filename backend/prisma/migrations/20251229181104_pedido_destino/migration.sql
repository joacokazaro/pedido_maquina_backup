-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Pedido" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "estado" TEXT NOT NULL,
    "observacion" TEXT,
    "itemsSolicitados" TEXT NOT NULL,
    "itemsDevueltos" TEXT,
    "supervisorId" INTEGER NOT NULL,
    "servicioId" INTEGER NOT NULL,
    "destino" TEXT NOT NULL DEFAULT 'DEPOSITO',
    "supervisorDestinoUsername" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Pedido_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Pedido_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Pedido" ("createdAt", "estado", "id", "itemsDevueltos", "itemsSolicitados", "observacion", "servicioId", "supervisorId") SELECT "createdAt", "estado", "id", "itemsDevueltos", "itemsSolicitados", "observacion", "servicioId", "supervisorId" FROM "Pedido";
DROP TABLE "Pedido";
ALTER TABLE "new_Pedido" RENAME TO "Pedido";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
