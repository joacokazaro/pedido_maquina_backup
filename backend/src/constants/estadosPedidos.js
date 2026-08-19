// src/constants/estadosPedido.js

// Fuente única de verdad
const ESTADOS_PEDIDO = {
  PENDIENTE_PREPARACION: "PENDIENTE_PREPARACION",
  PREPARADO: "PREPARADO",
  ENTREGADO: "ENTREGADO",
  PENDIENTE_CONFIRMACION: "PENDIENTE_CONFIRMACION",
  PENDIENTE_CONFIRMACION_FALTANTES: "PENDIENTE_CONFIRMACION_FALTANTES",
  CERRADO: "CERRADO",
  ENTREGA_CONFIRMADA: "ENTREGA_CONFIRMADA",
  PENDIENTE_CANCELACION: "PENDIENTE_CANCELACION",
  CANCELADO: "CANCELADO",
};

// ✅ Lista válida derivada (no duplicada)
const ESTADOS_PEDIDO_VALIDOS = Object.values(ESTADOS_PEDIDO);

// Estados finales de un pedido: no se espera ningún movimiento más sobre él.
// Usado para filtrar "pedidos abiertos" en estadísticas y avisos.
const ESTADOS_PEDIDO_TERMINALES = [ESTADOS_PEDIDO.CERRADO, ESTADOS_PEDIDO.CANCELADO];

/**
 * Normaliza cualquier string a un estado válido si existe
 * - "cerrado" → "CERRADO"
 * - "Pendiente confirmacion" → "PENDIENTE_CONFIRMACION"
 */
function normalizeEstadoPedido(raw) {
  if (!raw) return raw;

  const v = String(raw).trim();

  if (ESTADOS_PEDIDO_VALIDOS.includes(v)) return v;

  const normalizado = v.toUpperCase().replaceAll(" ", "_");

  if (ESTADOS_PEDIDO_VALIDOS.includes(normalizado)) {
    return normalizado;
  }

  return raw;
}

export {
  ESTADOS_PEDIDO,
  ESTADOS_PEDIDO_VALIDOS,
  ESTADOS_PEDIDO_TERMINALES,
  normalizeEstadoPedido
};
