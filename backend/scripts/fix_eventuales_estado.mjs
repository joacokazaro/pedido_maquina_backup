import prisma from "../src/db/prisma.js";

async function main() {
  console.log("Buscando eventuales con activo=false y estado='activo'...");
  const toUpdate = await prisma.eventual.findMany({ where: { activo: false, estado: 'activo' }, select: { id: true, nombre: true } });
  console.log(`Encontrados: ${toUpdate.length}`);
  if (toUpdate.length) {
    console.log(toUpdate.map((e) => `- ${e.id}: ${e.nombre}`).join("\n"));
    const res = await prisma.eventual.updateMany({ where: { activo: false, estado: 'activo' }, data: { estado: 'cancelado' } });
    console.log(`Registros actualizados: ${res.count}`);
  } else {
    console.log("Nada para actualizar.");
  }
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
