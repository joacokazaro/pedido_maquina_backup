// controllers/adminPedidos.controller.js
import { readDB, writeDB } from "../utils/file.js";

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
      supervisorName,
    };
  });

  if (estado) {
    resultado = resultado.filter((p) => p.estado === estado);
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
    supervisorName,
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

  // 🆕 Agregamos el nuevo estado válido
  const ESTADOS_VALIDOS = [
    "PENDIENTE_PREPARACION",
    "PREPARADO",
    "ENTREGADO",
    "PENDIENTE_CONFIRMACION", // ← agregado
    "CERRADO"
  ];

  if (!ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({
      error: `Estado inválido. Debe ser uno de: ${ESTADOS_VALIDOS.join(", ")}`,
    });
  }

  const db = readDB();
  const pedido = db.pedidos.find((p) => p.id === id);

  if (!pedido) {
    return res.status(404).json({ error: "Pedido no encontrado" });
  }

  pedido.estado = estado;

  // 🆕 Historial más claro para auditoría
  pedido.historial.push({
    accion: "ADMIN_CAMBIO_ESTADO",
    nuevoEstado: estado,
    fecha: new Date().toISOString(),
    detalle: {
      mensaje: "Cambio forzado por administrador"
    }
  });

  writeDB(db);

  res.json({
    message: "Estado actualizado por el administrador",
    pedido,
  });
}
