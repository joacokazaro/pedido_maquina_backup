-- CreateTable
CREATE TABLE "Kit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "observaciones" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'disponible',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "KitMaquina" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kitId" INTEGER NOT NULL,
    "maquinaId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KitMaquina_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "Kit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "KitMaquina_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "Maquina" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KitVehiculo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kitId" INTEGER NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KitVehiculo_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "Kit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "KitVehiculo_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Eventual" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "supervisorId" INTEGER NOT NULL,
    "kitId" INTEGER,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "fechaInicio" DATETIME,
    "fechaFin" DATETIME,
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Eventual_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Eventual_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "Kit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HistorialEventual" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eventualId" INTEGER NOT NULL,
    "accion" TEXT NOT NULL,
    "detalle" TEXT,
    "usuarioId" INTEGER NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HistorialEventual_eventualId_fkey" FOREIGN KEY ("eventualId") REFERENCES "Eventual" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HistorialEventual_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Kit_nombre_key" ON "Kit"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "KitMaquina_maquinaId_key" ON "KitMaquina"("maquinaId");

-- CreateIndex
CREATE UNIQUE INDEX "KitMaquina_kitId_maquinaId_key" ON "KitMaquina"("kitId", "maquinaId");

-- CreateIndex
CREATE UNIQUE INDEX "KitVehiculo_vehiculoId_key" ON "KitVehiculo"("vehiculoId");

-- CreateIndex
CREATE UNIQUE INDEX "KitVehiculo_kitId_vehiculoId_key" ON "KitVehiculo"("kitId", "vehiculoId");

-- CreateIndex
CREATE UNIQUE INDEX "Eventual_nombre_key" ON "Eventual"("nombre");

-- CreateIndex
CREATE INDEX "HistorialEventual_eventualId_fecha_idx" ON "HistorialEventual"("eventualId", "fecha");
