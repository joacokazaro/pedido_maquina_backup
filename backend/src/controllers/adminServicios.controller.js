import prisma from "../db/prisma.js";

/* ========================================================
   GET /admin/servicios
   Lista servicios + cantidad de máquinas
======================================================== */
export async function adminGetServicios(req, res) {
  try {
    const servicios = await prisma.servicio.findMany({
      include: {
        _count: {
          select: { maquinas: true },
        },
      },
      orderBy: { nombre: "asc" },
    });

    res.json(
      servicios.map(s => ({
        id: s.id,
        nombre: s.nombre,
        maquinas: s._count.maquinas,
      }))
    );
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error listando servicios" });
  }
}

/* ========================================================
   GET /admin/servicios/:id
   Servicio + máquinas asociadas
======================================================== */
export async function adminGetServicioById(req, res) {
  try {
    const { id } = req.params;

    const servicio = await prisma.servicio.findUnique({
      where: { id: Number(id) },
      include: {
        maquinas: {
          orderBy: { id: "asc" },
        },
      },
    });

    if (!servicio) {
      return res.status(404).json({ error: "Servicio no encontrado" });
    }

    res.json(servicio);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error obteniendo servicio" });
  }
}

/* ========================================================
   POST /admin/servicios
======================================================== */
export async function adminCreateServicio(req, res) {
  try {
    const { nombre } = req.body || {};

    if (!nombre || nombre.trim() === "") {
      return res.status(400).json({ error: "Nombre obligatorio" });
    }

    const existe = await prisma.servicio.findUnique({
      where: { nombre: nombre.trim() },
    });

    if (existe) {
      return res.status(409).json({ error: "El servicio ya existe" });
    }

    const nuevo = await prisma.servicio.create({
      data: { nombre: nombre.trim() },
    });

    res.status(201).json(nuevo);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error creando servicio" });
  }
}

/* ========================================================
   PUT /admin/servicios/:id
======================================================== */
export async function adminUpdateServicio(req, res) {
  try {
    const { id } = req.params;
    const { nombre } = req.body || {};

    if (!nombre || nombre.trim() === "") {
      return res.status(400).json({ error: "Nombre obligatorio" });
    }

    const actualizado = await prisma.servicio.update({
      where: { id: Number(id) },
      data: { nombre: nombre.trim() },
    });

    res.json(actualizado);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error actualizando servicio" });
  }
}
