// controllers/adminPedidos.controller.js
import { readDB, writeDB } from "../utils/file.js";

/**
 * GET /admin/pedidos
 * Permite listar todos los pedidos (opcionalmente filtrados por estado)
 */
export function adminListPedidos(req, res) {
  const { estado, supervisorId } = req.query;

  const db = readDB();
  let pedidos = db.pedidos || [];

  if (estado) {
    pedidos = pedidos.filter(p => p.estado === estado);
  }

  if (supervisorId) {
    pedidos = pedidos.filter(p => p.supervisorId === Number(supervisorId));
  }

  res.json(pedidos);
}

/**
 * GET /admin/pedidos/:id
 * Obtiene un pedido completo con historial
 */
export function adminGetPedido(req, res) {
  const { id } = req.params;

  const db = readDB();
  const pedido = (db.pedidos || []).find(p => p.id === id);

  if (!pedido) {
    return res.status(404).json({ error: "Pedido no encontrado" });
  }

  res.json(pedido);
}

/**
 * PUT /admin/pedidos/:id/estado
 * Admin puede forzar el estado del pedido
 */
export function adminUpdateEstado(req, res) {
  const { id } = req.params;
  const { estado } = req.body || {};

  if (!estado) {
    return res.status(400).json({ error: "Debe enviar un estado" });
  }

  const ESTADOS_VALIDOS = [
    "PENDIENTE_PREPARACION",
    "PREPARADO",
    "ENTREGADO",
    "CERRADO"
  ];

  if (!ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({
      error: `Estado inválido. Debe ser uno de: ${ESTADOS_VALIDOS.join(", ")}`
    });
  }

  const db = readDB();
  const pedido = db.pedidos.find(p => p.id === id);

  if (!pedido) {
    return res.status(404).json({ error: "Pedido no encontrado" });
  }

  pedido.estado = estado;

  // Registrar historial
  pedido.historial.push({
    accion: "ADMIN_CAMBIO_ESTADO",
    nuevoEstado: estado,
    fecha: new Date().toISOString()
  });

  writeDB(db);

  res.json({
    message: "Estado actualizado por el admin",
    pedido
  });
}
