-- Pedido.eventualId: vincula pedidos complementarios disparados desde un eventual
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
    "eventualId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Pedido_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Pedido_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Pedido_eventualId_fkey" FOREIGN KEY ("eventualId") REFERENCES "Eventual" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Pedido" (
  "id", "estado", "observacion", "itemsSolicitados", "itemsDevueltos", "supervisorId", "servicioId", "destino", "supervisorDestinoUsername", "createdAt"
)
SELECT
  "id", "estado", "observacion", "itemsSolicitados", "itemsDevueltos", "supervisorId", "servicioId", "destino", "supervisorDestinoUsername", "createdAt"
FROM "Pedido";
DROP TABLE "Pedido";
ALTER TABLE "new_Pedido" RENAME TO "Pedido";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
