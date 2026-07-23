import {
  addSupervisorObservation,
  getEventualDetail,
  listEventuales,
  updateEventualComponentesBySupervisor,
} from "../services/eventuales.service.js";

function handleError(res, error, fallbackMessage) {
  const status = error?.status || 500;
  const payload = error?.payload || null;

  console.error(fallbackMessage, error);
  res.status(status).json({
    error: error?.message || fallbackMessage,
    ...(payload ? payload : {}),
  });
}

export async function getMisEventuales(req, res) {
  try {
    const username = String(req.params.username || "").trim();
    const eventuales = await listEventuales({
      ...req.query,
      supervisorUsername: username,
      activo: req.query?.activo ?? "true",
    });
    res.json(eventuales);
  } catch (error) {
    handleError(res, error, "Error listando mis eventuales");
  }
}

export async function getEventualSupervisor(req, res) {
  try {
    const eventual = await getEventualDetail(req.params.id);
    if (!eventual) {
      return res.status(404).json({ error: "Eventual no encontrado" });
    }

    const username = String(req.query.username || "").trim();
    if (username && eventual.supervisor?.username !== username) {
      return res.status(403).json({ error: "No autorizado" });
    }

    res.json(eventual);
  } catch (error) {
    handleError(res, error, "Error obteniendo eventual");
  }
}

export async function updateSupervisorComponentes(req, res) {
  try {
    const eventual = await updateEventualComponentesBySupervisor({
      eventualId: req.params.id,
      actorUsername: req.body?.usuario,
      maquinasUtilizadas: req.body?.maquinasUtilizadas,
      vehiculoIds: req.body?.vehiculoIds,
    });
    res.json(eventual);
  } catch (error) {
    handleError(res, error, "Error guardando componentes del eventual");
  }
}

export async function createSupervisorObservation(req, res) {
  try {
    const eventual = await addSupervisorObservation(
      req.params.id,
      req.body?.usuario,
      req.body?.observacion
    );
    res.json(eventual);
  } catch (error) {
    handleError(res, error, "Error registrando observacion");
  }
}

export async function finalizeEventualBySupervisor(req, res) {
  return res.status(403).json({
    error: "El supervisor ya no tiene permiso para finalizar eventuales",
  });
}
