-- Multirol support: new UsuarioRol table + backfill from Usuario.rol
CREATE TABLE "UsuarioRol" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "usuarioId" INTEGER NOT NULL,
  "rol" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UsuarioRol_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "UsuarioRol_usuarioId_rol_key" ON "UsuarioRol"("usuarioId", "rol");
CREATE INDEX "UsuarioRol_rol_idx" ON "UsuarioRol"("rol");

INSERT INTO "UsuarioRol" ("usuarioId", "rol", "createdAt")
SELECT "id", LOWER(TRIM("rol")), CURRENT_TIMESTAMP
FROM "Usuario"
WHERE "rol" IS NOT NULL AND TRIM("rol") <> '';
