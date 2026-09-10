-- Add legajo/dni for matching supervisores desde integraciones externas (Kazaró 360)
ALTER TABLE "Usuario" ADD COLUMN "legajo" TEXT;
ALTER TABLE "Usuario" ADD COLUMN "dni" TEXT;
CREATE UNIQUE INDEX "Usuario_legajo_key" ON "Usuario"("legajo");
CREATE UNIQUE INDEX "Usuario_dni_key" ON "Usuario"("dni");
