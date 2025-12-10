// controllers/adminPedidos.controller.js
import { readDB, writeDB } from "../utils/file.js";

/**
 * GET /admin/pedidos
 * Listar todos los pedidos con supervisorName corregido
 */
export function adminListPedidos(req, res) {
  const { estado } = req.query;

  const db = readDB();
  const usuarios = db.usuarios || [];
  const pedidos = db.pedidos || [];

  // Mapa rápido para obtener username por ID
  const userMap = usuarios.reduce((acc, u) => {
    acc[u.id] = u.username;
    acc[u.username] = u.username;
    return acc;
  }, {});

  let resultado = pedidos.map((p) => {
    let supervisorName = "Desconocido";

    if (p.supervisor) {
      supervisorName = p.supervisor;
    } else if (p.supervisorId) {
      supervisorName = userMap[p.supervisorId] || `ID ${p.supervisorId}`;
    }

    return {
      ...p,
      supervisorName
    };
  });

  if (estado) {
    resultado = resultado.filter((p) => p.estado === estado);
  }

  res.json(resultado);
}

/**
 * GET /admin/pedidos/:id
 * Obtiene pedido + supervisorName corregido
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
      error: `Estado inválido. Debe ser uno de: ${ESTADOS_VALIDOS.join(", ")}`,
    });
  }

  const db = readDB();
  const pedido = db.pedidos.find((p) => p.id === id);

  if (!pedido) {
    return res.status(404).json({ error: "Pedido no encontrado" });
  }

  pedido.estado = estado;

  pedido.historial.push({
    accion: "ADMIN_CAMBIO_ESTADO",
    nuevoEstado: estado,
    fecha: new Date().toISOString(),
  });

  writeDB(db);

  res.json({
    message: "Estado actualizado por el admin",
    pedido,
  });
}
