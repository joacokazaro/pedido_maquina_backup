import { normalizeEstadoMaquina } from "./inventarioEstados.service.js";

// Extraído de adminResumenStock (adminMaquinas.controller.js) para poder
// reusarlo también desde el módulo de estadísticas sin duplicar el criterio
// de normalización de estado ni las claves fijas de porTipo.
export function computeResumenStockMaquinas(maquinas) {
  const porEstado = {};
  const porTipo = {};

  for (const m of maquinas) {
    const est = normalizeEstadoMaquina(m.estado);

    porEstado[est] = (porEstado[est] || 0) + 1;

    const tipo = m.tipo || "SIN_TIPO";
    if (!porTipo[tipo]) {
      porTipo[tipo] = {
        total: 0,
        disponible: 0,
        asignada: 0,
        no_devuelta: 0,
        fuera_servicio: 0,
        taller: 0,
        baja: 0,
      };
    }

    porTipo[tipo].total += 1;
    if (porTipo[tipo][est] !== undefined) {
      porTipo[tipo][est] += 1;
    }
  }

  return { porEstado, porTipo };
}
