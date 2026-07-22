-- Maquina.servicioId pasa a ser opcional (una máquina puede darse de alta sin servicio asignado)
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Maquina" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipo" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "serie" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'disponible',
    "servicioId" INTEGER,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "tipoMaquinaId" INTEGER, "estadoAmortizacion" TEXT NOT NULL DEFAULT 'SIN_DATOS', "valorCompra" REAL,
    CONSTRAINT "Maquina_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Maquina_servicioAmortizacionId_fkey" FOREIGN KEY ("servicioAmortizacionId") REFERENCES "Servicio" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Maquina" (
  "id", "tipo", "modelo", "serie", "estado", "servicioId", "fechaCompra", "proveedorFactura", "empresa", "anio", "amortizacion", "antiguedad", "valorUsadaDolares", "valorUsadaPesos", "valorNuevaDolares", "valorNuevaPesos", "origenInfo", "servicioAmortizacionId", "comentarios", "createdAt", "tipoMaquinaId", "estadoAmortizacion", "valorCompra"
)
SELECT
  "id", "tipo", "modelo", "serie", "estado", "servicioId", "fechaCompra", "proveedorFactura", "empresa", "anio", "amortizacion", "antiguedad", "valorUsadaDolares", "valorUsadaPesos", "valorNuevaDolares", "valorNuevaPesos", "origenInfo", "servicioAmortizacionId", "comentarios", "createdAt", "tipoMaquinaId", "estadoAmortizacion", "valorCompra"
FROM "Maquina";
DROP TABLE "Maquina";
ALTER TABLE "new_Maquina" RENAME TO "Maquina";
CREATE INDEX "Maquina_tipoMaquinaId_idx" ON "Maquina"("tipoMaquinaId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
