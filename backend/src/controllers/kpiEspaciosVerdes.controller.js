import { requireActor } from "../services/requestActor.service.js";
import { getKpisEspaciosVerdes } from "../services/kpiEspaciosVerdes.service.js";

// Mismos roles que el panel de eventuales desde el que se entra
// (`renderReadOnlyModulesPage` en App.jsx): es un tablero de solo lectura.
const ROLES_KPI = ["admin", "coordinador", "consultor"];

export async function adminGetKpisEspaciosVerdes(req, res) {
  const actor = await requireActor(req, res, ROLES_KPI);
  if (!actor) return;

  try {
    const kpis = await getKpisEspaciosVerdes();
    res.json(kpis);
  } catch (error) {
    console.error("adminGetKpisEspaciosVerdes:", error);
    res.status(500).json({ error: "Error obteniendo los KPIs de Espacios Verdes" });
  }
}
