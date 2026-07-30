function parseDetalle(historialItem) {
  if (!historialItem || !historialItem.detalle) return null;
  try {
    return typeof historialItem.detalle === "string"
      ? JSON.parse(historialItem.detalle)
      : historialItem.detalle;
  } catch (e) {
    return null;
  }
}

// Reconstruye, a partir del historial completo de un pedido, qué ítems
// (máquinas o vehículos) quedan como faltantes "finales": unión de todo lo
// declarado faltante en algún momento, menos todo lo que en algún momento
// se marcó como devuelto (registrado, declarado o confirmado).
export function computeFaltantesFinalesFromHistorial(historial) {
  if (!Array.isArray(historial) || historial.length === 0) return [];

  const faltantes = new Set();
  const devueltas = new Set();

  for (const h of historial) {
    const d = parseDetalle(h);
    if (!d) continue;

    const f = d.faltantes || d.faltantesConfirmados || [];
    const dv = [].concat(d.devueltas || [], d.devueltasConfirmadas || [], d.devueltasDeclaradas || []);

    if (Array.isArray(f)) {
      for (const id of f) if (id) faltantes.add(String(id));
    }

    if (Array.isArray(dv)) {
      for (const id of dv) if (id) devueltas.add(String(id));
    }
  }

  for (const id of devueltas) {
    if (faltantes.has(id)) faltantes.delete(id);
  }

  return Array.from(faltantes);
}

// Devoluciones ya confirmadas por depósito, según la última confirmación
// registrada (cada `DEVOLUCION_CONFIRMADA`/`_DIRECTA` acumula lo devuelto en
// rondas anteriores, ver confirmarDevolucion en pedidos.controller.js). Sirve
// para excluir ítems puntuales ya devueltos aunque el pedido como un todo
// siga abierto por otros ítems todavía faltantes (devolución hecha de a
// tandas) — a diferencia de computeFaltantesFinalesFromHistorial, no depende
// de que el pedido esté CERRADO.
export function getDevueltasConfirmadasFromHistorial(historial) {
  if (!Array.isArray(historial) || historial.length === 0) return new Set();

  let ultimaConfirmacion = null;
  for (const h of historial) {
    if (h?.accion === "DEVOLUCION_CONFIRMADA" || h?.accion === "DEVOLUCION_CONFIRMADA_DIRECTA") {
      ultimaConfirmacion = h;
    }
  }
  if (!ultimaConfirmacion) return new Set();

  const detalle = parseDetalle(ultimaConfirmacion);
  const devueltas = Array.isArray(detalle?.devueltasConfirmadas) ? detalle.devueltasConfirmadas : [];
  return new Set(devueltas.map((itemId) => String(itemId)));
}
