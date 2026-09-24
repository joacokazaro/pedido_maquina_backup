import { requireActor } from "../services/requestActor.service.js";
import { buscarSimilares, compararEventuales, getCandidatosComparador } from "../services/comparadorEventuales.service.js";

// Mismos roles que los KPI de Espacios Verdes: es una herramienta de solo lectura.
const ROLES_COMPARADOR = ["admin", "coordinador", "consultor"];

function responderError(res, error, fallback) {
  if (error?.status) return res.status(error.status).json({ error: error.message });
  console.error(fallback, error);
  return res.status(500).json({ error: fallback });
}

export async function adminGetCandidatosComparador(req, res) {
  const actor = await requireActor(req, res, ROLES_COMPARADOR);
  if (!actor) return;

  try {
    res.json(await getCandidatosComparador());
  } catch (error) {
    responderError(res, error, "Error obteniendo los eventuales para comparar");
  }
}

export async function adminCompararEventuales(req, res) {
  const actor = await requireActor(req, res, ROLES_COMPARADOR);
  if (!actor) return;

  try {
    res.json(await compararEventuales(req.query?.a, req.query?.b));
  } catch (error) {
    responderError(res, error, "Error comparando eventuales");
  }
}

export async function adminBuscarSimilares(req, res) {
  const actor = await requireActor(req, res, ROLES_COMPARADOR);
  if (!actor) return;

  try {
    res.json(await buscarSimilares(req.body || {}));
  } catch (error) {
    responderError(res, error, "Error buscando eventuales similares");
  }
}
