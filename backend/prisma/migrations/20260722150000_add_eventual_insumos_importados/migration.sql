-- Resumen de insumos importados desde la API de pedidos (JSON), pisado en cada reimportación
ALTER TABLE "Eventual" ADD COLUMN "insumosImportados" TEXT;
