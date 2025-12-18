// controllers/adminPedidos.controller.js
import { readDB, writeDB } from "../utils/file.js";
import {
  ESTADOS_PEDIDO,
  ESTADOS_PEDIDO_VALIDOS,
  normalizeEstadoPedido
} from "../constants/estadosPedidos.js";

void ESTADOS_PEDIDO;
/**
 * GET /admin/pedidos
 * Lista todos los pedidos con nombre de supervisor
 */

export function adminListPedidos(req, res) {
  const { estado } = req.query;

  const db = readDB();
  const usuarios = db.usuarios || [];
  const pedidos = db.pedidos || [];

  const userMap = usuarios.reduce((acc, u) => {
    acc[u.id] = u.username;
    acc[u.username] = u.username;
    return acc;
  }, {});

  let resultado = pedidos.map((p) => {
    const supervisorName =
      p.supervisor ||
      userMap[p.supervisorId] ||
      `ID ${p.supervisorId ?? "?"}`;

    return {
      ...p,
      supervisorName
    };
  });

  // 🔒 Filtro por estado normalizado
  if (estado) {
    const estadoNorm = normalizeEstadoPedido(estado);
    resultado = resultado.filter((p) => p.estado === estadoNorm);
  }

  res.json(resultado);
}

/**
 * GET /admin/pedidos/:id
 * Devuelve pedido con supervisorName
 */
export function adminGetPedido(req, res) {
  const { id } = req.params;
  const db = readDB();

  const usuarios = db.usuarios || [];
  const userMap = usuarios.reduce((acc, u) => {
    acc[u.id] = u.username;
    acc[u.username] = u.username;
    return acc;
  }, {});

  const pedido = db.pedidos.find((p) => p.id === id);

  if (!pedido) {
    return res.status(404).json({ error: "Pedido no encontrado" });
  }

  const supervisorName =
    pedido.supervisor ||
    userMap[pedido.supervisorId] ||
    `ID ${pedido.supervisorId ?? "?"}`;

  res.json({
    ...pedido,
    supervisorName
  });
}

/**
 * PUT /admin/pedidos/:id/estado
 * Admin puede forzar cualquier cambio de estado
 */
export function adminUpdateEstado(req, res) {
  const { id } = req.params;
  const { estado } = req.body || {};

  if (!estado) {
    return res.status(400).json({ error: "Debe enviar un estado" });
  }

  const estadoNormalizado = normalizeEstadoPedido(estado);

  if (!ESTADOS_PEDIDO_VALIDOS.includes(estadoNormalizado)) {
    return res.status(400).json({
      error: `Estado inválido. Debe ser uno de: ${ESTADOS_PEDIDO_VALIDOS.join(", ")}`
    });
  }

  const db = readDB();
  const pedido = db.pedidos.find((p) => p.id === id);

  if (!pedido) {
    return res.status(404).json({ error: "Pedido no encontrado" });
  }

  pedido.estado = estadoNormalizado;

  pedido.historial.push({
    accion: "ADMIN_CAMBIO_ESTADO",
    nuevoEstado: estadoNormalizado,
    fecha: new Date().toISOString(),
    detalle: {
      mensaje: "Cambio forzado por administrador"
    }
  });

  writeDB(db);

  res.json({
    message: "Estado actualizado por el administrador",
    pedido
  });
}
