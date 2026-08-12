import { ESTADOS_MAQUINA_VALIDOS } from "../services/inventarioEstados.service.js";
import {
  getMaquinasParaExport,
  buildMaquinaExportRecord,
} from "../services/maquinasExport.service.js";

export async function getMaquinasExternal(req, res) {
  try {
    const { tipo, estado, servicioId } = req.query;
    const where = {};

    if (tipo) where.tipo = String(tipo);

    if (estado) {
      const estadoNormalizado = String(estado).trim().toLowerCase();
      if (!ESTADOS_MAQUINA_VALIDOS.includes(estadoNormalizado)) {
        return res.status(400).json({
          error: `Estado inválido. Valores permitidos: ${ESTADOS_MAQUINA_VALIDOS.join(", ")}`,
        });
      }
      where.estado = estadoNormalizado;
    }

    if (servicioId) {
      const idBrowix = String(servicioId).trim().toUpperCase();
      where.servicio = { idBrowix };
    }

    const { maquinas, asignacionPorMaquina } = await getMaquinasParaExport({ where });

    const data = maquinas.map((maquina) =>
      buildMaquinaExportRecord(maquina, asignacionPorMaquina.get(maquina.id) || null)
    );

    res.json(data);
  } catch (e) {
    console.error("getMaquinasExternal:", e);
    res.status(500).json({ error: "Error obteniendo máquinas" });
  }
}
