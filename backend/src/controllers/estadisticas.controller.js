import { requireActor } from "../services/requestActor.service.js";
import { getResumenTiempoReal, getResumenAvisos, getResumenPeriodo } from "../services/estadisticas.service.js";

const ROLES_ESTADISTICAS = ["admin"];

export async function adminGetEstadisticasTiempoReal(req, res) {
  const actor = await requireActor(req, res, ROLES_ESTADISTICAS);
  if (!actor) return;

  try {
    const resumen = await getResumenTiempoReal();
    res.json(resumen);
  } catch (error) {
    console.error("adminGetEstadisticasTiempoReal:", error);
    res.status(500).json({ error: "Error obteniendo estadísticas en tiempo real" });
  }
}

export async function adminGetEstadisticasAvisos(req, res) {
  const actor = await requireActor(req, res, ROLES_ESTADISTICAS);
  if (!actor) return;

  try {
    const { umbralAmarillo, umbralRojo, diasVentanaVencimiento } = req.query;
    const resumen = await getResumenAvisos({ umbralAmarillo, umbralRojo, diasVentanaVencimiento });
    res.json(resumen);
  } catch (error) {
    console.error("adminGetEstadisticasAvisos:", error);
    res.status(500).json({ error: "Error obteniendo avisos" });
  }
}

export async function adminGetEstadisticasPeriodo(req, res) {
  const actor = await requireActor(req, res, ROLES_ESTADISTICAS);
  if (!actor) return;

  try {
    const { desde, hasta } = req.query;
    const resumen = await getResumenPeriodo({ desde, hasta });
    res.json(resumen);
  } catch (error) {
    console.error("adminGetEstadisticasPeriodo:", error);
    res.status(500).json({ error: "Error obteniendo estadísticas del período" });
  }
}
