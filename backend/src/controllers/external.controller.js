import { ESTADOS_MAQUINA_VALIDOS } from "../services/inventarioEstados.service.js";
import {
  getMaquinasParaExport,
  buildMaquinaExportRecord,
} from "../services/maquinasExport.service.js";
import {
  getVehiculosParaExport,
  buildVehiculoExportRecord,
} from "../services/vehiculosExport.service.js";

function parseListParam(raw) {
  return String(raw)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

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

export async function getVehiculosExternal(req, res) {
  try {
    const { empresa, patente, conductorId } = req.query;
    const where = {};

    if (empresa) where.empresa = { in: parseListParam(empresa) };

    if (patente) where.patente = { in: parseListParam(patente) };

    if (conductorId) {
      const ids = parseListParam(conductorId).map(Number);
      if (ids.some((id) => !Number.isInteger(id))) {
        return res.status(400).json({ error: "conductorId debe ser un entero o una lista de enteros separados por coma" });
      }
      where.conductorActualId = { in: ids };
    }

    const { vehiculos } = await getVehiculosParaExport({ where });
    const data = vehiculos.map((vehiculo) => buildVehiculoExportRecord(vehiculo));

    res.json(data);
  } catch (e) {
    console.error("getVehiculosExternal:", e);
    res.status(500).json({ error: "Error obteniendo vehículos" });
  }
}
