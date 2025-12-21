import prisma from "../db/prisma.js";

/* ========================================================
   HELPERS
======================================================== */
function parseId(raw) {
  const id = Number(raw);
  return Number.isNaN(id) ? null : id;
}

function normalizeNombre(nombre) {
  return String(nombre || "").trim();
}

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
      servicios.map((s) => ({
        id: s.id,
        nombre: s.nombre,
        maquinas: s._count.maquinas,
      }))
    );
  } catch (e) {
    console.error("adminGetServicios:", e);
    res.status(500).json({ error: "Error listando servicios" });
  }
}

/* ========================================================
   GET /admin/servicios/:id
======================================================== */
export async function adminGetServicioById(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "ID de servicio inválido" });
    }

    const servicio = await prisma.servicio.findUnique({
      where: { id },
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
    console.error("adminGetServicioById:", e);
    res.status(500).json({ error: "Error obteniendo servicio" });
  }
}

/* ========================================================
   POST /admin/servicios
======================================================== */
export async function adminCreateServicio(req, res) {
  try {
    const nombre = normalizeNombre(req.body?.nombre);

    if (!nombre) {
      return res.status(400).json({ error: "Nombre obligatorio" });
    }

    const existe = await prisma.servicio.findUnique({
      where: { nombre },
    });

    if (existe) {
      return res.status(409).json({ error: "El servicio ya existe" });
    }

    const nuevo = await prisma.servicio.create({
      data: { nombre },
    });

    res.status(201).json({
      message: "Servicio creado correctamente",
      servicio: nuevo,
    });
  } catch (e) {
    console.error("adminCreateServicio:", e);
    res.status(500).json({ error: "Error creando servicio" });
  }
}

/* ========================================================
   PUT /admin/servicios/:id
======================================================== */
export async function adminUpdateServicio(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "ID de servicio inválido" });
    }

    const nombre = normalizeNombre(req.body?.nombre);
    if (!nombre) {
      return res.status(400).json({ error: "Nombre obligatorio" });
    }

    const existe = await prisma.servicio.findUnique({
      where: { id },
    });

    if (!existe) {
      return res.status(404).json({ error: "Servicio no encontrado" });
    }

    const actualizado = await prisma.servicio.update({
      where: { id },
      data: { nombre },
    });

    res.json({
      message: "Servicio actualizado correctamente",
      servicio: actualizado,
    });
  } catch (e) {
    console.error("adminUpdateServicio:", e);
    res.status(500).json({ error: "Error actualizando servicio" });
  }
}
/* ========================================================
   DELETE /admin/servicios/:id
======================================================== */
export async function adminDeleteServicio(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "ID inválido" });
    }

    // Verificar existencia + máquinas asociadas
    const servicio = await prisma.servicio.findUnique({
      where: { id },
      include: {
        _count: { select: { maquinas: true } },
      },
    });

    if (!servicio) {
      return res.status(404).json({ error: "Servicio no encontrado" });
    }

    if (servicio._count.maquinas > 0) {
      return res.status(409).json({
        error: "No se puede eliminar un servicio con máquinas asignadas",
      });
    }

    await prisma.servicio.delete({ where: { id } });

    res.json({ message: "Servicio eliminado correctamente" });
  } catch (e) {
    console.error("adminDeleteServicio:", e);
    res.status(500).json({ error: "Error eliminando servicio" });
  }
}
