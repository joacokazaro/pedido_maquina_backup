import prisma from "../db/prisma.js";

/* ========================================================
   CONSTANTES Y HELPERS
======================================================== */
const ESTADOS_PEDIDO_VALIDOS = [
  "PENDIENTE_PREPARACION",
  "PREPARADO",
  "ENTREGADO",
  "PENDIENTE_CONFIRMACION",
  "PENDIENTE_CONFIRMACION_FALTANTES",
  "CERRADO",
];

function normalizeEstadoPedido(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replaceAll(" ", "_");
}

function safeParse(detalle) {
  if (!detalle) return null;
  try {
    return JSON.parse(detalle);
  } catch {
    return null;
  }
}

/* ========================================================
   GET /admin/pedidos
======================================================== */
export async function adminListPedidos(req, res) {
  try {
    const { estado, faltantes } = req.query;

    /* =========================
       1) Filtro por estado
    ========================= */
    let where = {};

    if (estado && estado !== "TODOS") {
      const estadoNorm = normalizeEstadoPedido(estado);
      if (!ESTADOS_PEDIDO_VALIDOS.includes(estadoNorm)) {
        return res.status(400).json({
          error: `Estado inválido. Debe ser uno de: ${ESTADOS_PEDIDO_VALIDOS.join(
            ", "
          )}`,
        });
      }
      where.estado = estadoNorm;
    }

    /* =========================
       2) Traer pedidos
    ========================= */
    const pedidos = await prisma.pedido.findMany({
      where,
      include: {
        supervisor: { select: { username: true } },
        servicio: { select: { nombre: true } },
        historial: {
          where: { accion: "DEVOLUCION_CONFIRMADA" },
          orderBy: { fecha: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    /* =========================
       3) Mapear + detectar faltantes
    ========================= */
    let resultado = pedidos.map((p) => {
      const ultimaConfirm = p.historial?.[0];
      const detalle = safeParse(ultimaConfirm?.detalle);

      const faltantesConfirmados =
        detalle?.faltantesConfirmados || [];

      const conFaltantes =
        p.estado === "CERRADO" &&
        Array.isArray(faltantesConfirmados) &&
        faltantesConfirmados.length > 0;

      return {
        ...p,
        supervisorName: p.supervisor?.username ?? "—",
        servicioName: p.servicio?.nombre ?? null,
        conFaltantes,
      };
    });

    /* =========================
       4) Filtro por faltantes
    ========================= */
    if (faltantes === "1") {
      resultado = resultado.filter((p) => p.conFaltantes);
    }

    if (faltantes === "0") {
      resultado = resultado.filter((p) => !p.conFaltantes);
    }

    res.json(resultado);
  } catch (err) {
    console.error("adminListPedidos:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

/* ========================================================
   GET /admin/pedidos/:id
======================================================== */
export async function adminGetPedido(req, res) {
  try {
    const { id } = req.params;

    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: {
        supervisor: { select: { username: true } },
        servicio: { select: { nombre: true } },
        asignadas: {
          include: { maquina: true },
        },
        historial: {
          include: { usuario: { select: { username: true } } },
          orderBy: { fecha: "asc" },
        },
      },
    });

    if (!pedido) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    res.json({
      ...pedido,
      supervisorName: pedido.supervisor?.username ?? "—",
      servicioName: pedido.servicio?.nombre ?? null,
    });
  } catch (err) {
    console.error("adminGetPedido:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

/* ========================================================
   PUT /admin/pedidos/:id/estado
======================================================== */
export async function adminUpdateEstado(req, res) {
  try {
    const { id } = req.params;
    const { estado, usuario } = req.body || {};

    if (!estado) {
      return res.status(400).json({ error: "Debe enviar un estado" });
    }

    const estadoNorm = normalizeEstadoPedido(estado);
    if (!ESTADOS_PEDIDO_VALIDOS.includes(estadoNorm)) {
      return res.status(400).json({
        error: `Estado inválido. Debe ser uno de: ${ESTADOS_PEDIDO_VALIDOS.join(
          ", "
        )}`,
      });
    }

    const pedido = await prisma.pedido.findUnique({ where: { id } });
    if (!pedido) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    const actualizado = await prisma.pedido.update({
      where: { id },
      data: {
        estado: estadoNorm,
        historial: {
          create: {
            accion: "ADMIN_CAMBIO_ESTADO",
            usuarioId: null,
            detalle: JSON.stringify({
              mensaje: "Cambio forzado por administrador",
              usuario: usuario || "admin",
              nuevoEstado: estadoNorm,
            }),
          },
        },
      },
      include: {
        historial: {
          include: { usuario: { select: { username: true } } },
          orderBy: { fecha: "asc" },
        },
      },
    });

    res.json({
      message: "Estado actualizado por el administrador",
      pedido: actualizado,
    });
  } catch (err) {
    console.error("adminUpdateEstado:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

/* ========================================================
   DELETE /admin/pedidos/:id
======================================================== */
export async function adminDeletePedido(req, res) {
  try {
    const { id } = req.params;

    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: { asignadas: true },
    });

    if (!pedido) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    await prisma.$transaction(async (tx) => {
      /* 1️⃣ Liberar máquinas */
      const maquinasIds = pedido.asignadas.map((a) => a.maquinaId);

      if (maquinasIds.length > 0) {
        await tx.maquina.updateMany({
          where: { id: { in: maquinasIds } },
          data: { estado: "disponible" },
        });
      }

      /* 2️⃣ Borrar relaciones */
      await tx.pedidoMaquina.deleteMany({ where: { pedidoId: id } });
      await tx.historialPedido.deleteMany({ where: { pedidoId: id } });

      /* 3️⃣ Borrar pedido */
      await tx.pedido.delete({ where: { id } });
    });

    res.json({ message: `Pedido ${id} eliminado correctamente` });
  } catch (e) {
    console.error("adminDeletePedido:", e);
    res.status(500).json({ error: "Error eliminando pedido" });
  }
}
