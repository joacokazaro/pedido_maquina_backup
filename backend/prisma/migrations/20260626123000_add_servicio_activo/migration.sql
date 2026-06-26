-- Add logical-delete flag for Servicio
ALTER TABLE "Servicio" ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true;
