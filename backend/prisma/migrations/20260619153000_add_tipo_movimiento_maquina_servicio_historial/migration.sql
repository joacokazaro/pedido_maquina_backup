-- Add movement type to service history entries
ALTER TABLE "MaquinaServicioHistorial"
ADD COLUMN "tipoMovimiento" TEXT NOT NULL DEFAULT 'individual';
