import { requireActor } from "../services/requestActor.service.js";
import {
  aplicarMovimientoTaller,
  getHistorialTaller,
  TALLER_TIPO_MAQUINA,
  TALLER_TIPO_VEHICULO,
} from "../services/taller.service.js";
import { respondWithError } from "../services/httpError.service.js";

const ROLES_TALLER_LECTURA = ["admin", "coordinador", "consultor", "taller"];
const ROLES_TALLER_EDICION = ["admin", "taller"];

async function handleMovimiento(req, res, tipo) {
  const actor = await requireActor(req, res, ROLES_TALLER_EDICION);
  if (!actor) return;

  try {
    const { ids, accion, observacion } = req.body || {};
    const resultado = await aplicarMovimientoTaller({
      tipo,
      ids,
      accion,
      observacion,
      actorId: actor.id,
    });

    res.json({
      message: `Movimiento de taller aplicado sobre ${resultado.actualizados.length} registro(s)`,
      ...resultado,
    });
  } catch (error) {
    respondWithError(res, error, "Error procesando movimiento de taller");
  }
}

async function handleHistorial(req, res, tipo) {
  const actor = await requireActor(req, res, ROLES_TALLER_LECTURA);
  if (!actor) return;

  try {
    const limit = Math.min(Number(req.query.limit) || 100, 300);
    const historial = await getHistorialTaller(tipo, limit);
    res.json(historial);
  } catch (error) {
    console.error("handleHistorialTaller:", error);
    res.status(500).json({ error: "Error obteniendo historial de taller" });
  }
}

export function adminBatchTallerMaquinas(req, res) {
  return handleMovimiento(req, res, TALLER_TIPO_MAQUINA);
}

export function adminBatchTallerVehiculos(req, res) {
  return handleMovimiento(req, res, TALLER_TIPO_VEHICULO);
}

export function adminHistorialTallerMaquinas(req, res) {
  return handleHistorial(req, res, TALLER_TIPO_MAQUINA);
}

export function adminHistorialTallerVehiculos(req, res) {
  return handleHistorial(req, res, TALLER_TIPO_VEHICULO);
}