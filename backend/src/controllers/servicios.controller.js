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

/* ========================================================
   GET /servicios/usuario/:username
   Servicios asignados a un supervisor
======================================================== */
export async function getServiciosPorUsuario(req, res) {
  try {
    const { username } = req.params;

    if (!username) {
      return res.status(400).json({ error: "Username requerido" });
    }

    const servicios = await prisma.servicio.findMany({
      where: {
        supervisores: {
          some: {
            usuario: {
              username: username,
            },
          },
        },
      },
      select: {
        id: true,
        nombre: true,
      },
      orderBy: { nombre: "asc" },
    });

    res.json(servicios);
  } catch (e) {
    console.error("getServiciosPorUsuario:", e);
    res.status(500).json({ error: "Error obteniendo servicios del usuario" });
  }
}

