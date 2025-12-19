import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const r1 = await prisma.usuario.updateMany({
    where: { nombre: null },
    data: { nombre: "Usuario sin nombre" },
  });

  const r2 = await prisma.usuario.updateMany({
    where: { password: null },
    data: { password: "changeme" },
  });

  console.log("Usuarios actualizados:");
  console.log("nombre:", r1.count);
  console.log("password:", r2.count);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
