import prisma from "../db/prisma.js";

export async function getServicios(req, res) {
  try {
    const servicios = await prisma.servicio.findMany({
      orderBy: { nombre: "asc" },
    });
    res.json(servicios);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error listando servicios" });
  }
}
