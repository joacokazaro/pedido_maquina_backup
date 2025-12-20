import prisma from "../db/prisma.js";

/* ========================================================
   GET /servicios
   Lista simple de servicios (uso operativo / front)
======================================================== */
export async function getServicios(req, res) {
  try {
    const servicios = await prisma.servicio.findMany({
      orderBy: { nombre: "asc" },
      select: {
        id: true,
        nombre: true,
      },
    });

    res.json(servicios);
  } catch (e) {
    console.error("getServicios:", e);
    res.status(500).json({ error: "Error listando servicios" });
  }
}
