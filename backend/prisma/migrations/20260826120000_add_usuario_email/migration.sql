-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN "email" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");
