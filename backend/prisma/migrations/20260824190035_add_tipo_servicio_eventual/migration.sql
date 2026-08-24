-- Add tipo (LIMPIEZA / ESPACIOS_VERDES) for Servicio and Eventual
ALTER TABLE "Servicio" ADD COLUMN "tipo" TEXT;
ALTER TABLE "Eventual" ADD COLUMN "tipo" TEXT;
