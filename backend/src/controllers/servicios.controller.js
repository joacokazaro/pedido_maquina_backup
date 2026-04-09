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
   GET /servicios/catalogo
   Lista servicios + cantidad de máquinas para vistas read-only
======================================================== */
export async function getServiciosCatalogo(req, res) {
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
    console.error("getServiciosCatalogo:", e);
    res.status(500).json({ error: "Error listando catálogo de servicios" });
  }
}

/* ========================================================
   GET /servicios/catalogo/:id
   Detalle read-only de servicio + máquinas asociadas
======================================================== */
export async function getServicioCatalogoById(req, res) {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({ error: "ID de servicio inválido" });
    }

    const servicio = await prisma.servicio.findUnique({
      where: { id },
      include: {
        maquinas: {
          orderBy: [{ tipo: "asc" }, { id: "asc" }],
        },
      },
    });

    if (!servicio) {
      return res.status(404).json({ error: "Servicio no encontrado" });
    }

    const maquinasIds = servicio.maquinas.map((m) => m.id);

    const asignacionesActivas = maquinasIds.length
      ? await prisma.pedidoMaquina.findMany({
          where: {
            maquinaId: { in: maquinasIds },
            pedido: {
              estado: {
                notIn: ["CERRADO", "CANCELADO"],
              },
            },
          },
          include: {
            pedido: {
              select: {
                id: true,
                estado: true,
                createdAt: true,
                destino: true,
                servicio: {
                  select: { id: true, nombre: true },
                },
              },
            },
          },
          orderBy: {
            pedido: {
              createdAt: "desc",
            },
          },
        })
      : [];

    const asignacionPorMaquina = new Map();
    for (const asignacion of asignacionesActivas) {
      if (!asignacionPorMaquina.has(asignacion.maquinaId)) {
        asignacionPorMaquina.set(asignacion.maquinaId, {
          pedidoId: asignacion.pedido.id,
          estadoPedido: asignacion.pedido.estado,
          destino: asignacion.pedido.destino,
          servicio: asignacion.pedido.servicio,
        });
      }
    }

    res.json({
      ...servicio,
      maquinas: servicio.maquinas.map((maquina) => ({
        ...maquina,
        asignacion: asignacionPorMaquina.get(maquina.id) || null,
      })),
    });
  } catch (e) {
    console.error("getServicioCatalogoById:", e);
    res.status(500).json({ error: "Error obteniendo servicio" });
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

