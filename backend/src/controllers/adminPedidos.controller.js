// backend/src/controllers/adminPedidos.controller.js
import prisma from "../db/prisma.js";
import {
  ESTADOS_PEDIDO_VALIDOS,
  normalizeEstadoPedido,
} from "../constants/estadosPedidos.js";

/* ========================================================
   GET /admin/pedidos
======================================================== */
export async function adminListPedidos(req, res) {
  try {
    const { estado } = req.query;

    let estadoFiltro;
    if (estado) {
      const estadoNorm = normalizeEstadoPedido(estado);
      if (!ESTADOS_PEDIDO_VALIDOS.includes(estadoNorm)) {
        return res.status(400).json({
          error: `Estado inválido. Debe ser uno de: ${ESTADOS_PEDIDO_VALIDOS.join(", ")}`,
        });
      }
      estadoFiltro = estadoNorm;
    }

    const pedidos = await prisma.pedido.findMany({
      where: estadoFiltro ? { estado: estadoFiltro } : undefined,
      include: {
        supervisor: { select: { username: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const resultado = pedidos.map(p => ({
      ...p,
      supervisorName: p.supervisor?.username ?? "—",
    }));

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
        historial: {
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
    });
  } catch (err) {
    console.error("adminGetPedido:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

/* ========================================================
   PUT /admin/pedidos/:id/estado
   Admin puede forzar cualquier cambio de estado
======================================================== */
export async function adminUpdateEstado(req, res) {
  try {
    const { id } = req.params;
    const { estado, usuario } = req.body || {};

    if (!estado) {
      return res.status(400).json({ error: "Debe enviar un estado" });
    }

    const estadoNormalizado = normalizeEstadoPedido(estado);
    if (!ESTADOS_PEDIDO_VALIDOS.includes(estadoNormalizado)) {
      return res.status(400).json({
        error: `Estado inválido. Debe ser uno de: ${ESTADOS_PEDIDO_VALIDOS.join(", ")}`,
      });
    }

    const pedido = await prisma.pedido.findUnique({ where: { id } });
    if (!pedido) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    const actualizado = await prisma.pedido.update({
      where: { id },
      data: {
        estado: estadoNormalizado,
        historial: {
          create: {
            accion: "ADMIN_CAMBIO_ESTADO",
            fecha: new Date(),
            usuario: usuario || "admin", // 👈 STRING
            detalle: {
              mensaje: "Cambio forzado por administrador",
            },
          },
        },
      },
      include: {
        historial: {
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
