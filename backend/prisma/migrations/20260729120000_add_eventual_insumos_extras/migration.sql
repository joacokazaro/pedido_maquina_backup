-- Insumos cargados a mano en el eventual (JSON), aparte de los importados desde la plataforma de insumos
ALTER TABLE "Eventual" ADD COLUMN "insumosExtras" TEXT;
