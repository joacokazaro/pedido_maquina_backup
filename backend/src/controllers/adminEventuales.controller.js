import {
  getComponentesCatalogo,
  deleteEventual,
  getEventualDetail,
  importarHorasBrowixEventual,
  listEventuales,
  saveEventual,
} from "../services/eventuales.service.js";
import { requireActor } from "../services/requestActor.service.js";

const ROLES_HORAS_BROWIX = ["admin", "coordinador"];

function handleError(res, error, fallbackMessage) {
  const status = error?.status || 500;
  const payload = error?.payload || null;

  console.error(fallbackMessage, error);
  res.status(status).json({
    error: error?.message || fallbackMessage,
    ...(payload ? payload : {}),
  });
}

export async function adminGetComponentesCatalogo(req, res) {
  try {
    const catalogo = await getComponentesCatalogo();
    res.json(catalogo);
  } catch (error) {
    handleError(res, error, "Error obteniendo catalogo de componentes");
  }
}

export async function adminListEventuales(req, res) {
  try {
    const eventuales = await listEventuales(req.query || {});
    res.json(eventuales);
  } catch (error) {
    handleError(res, error, "Error listando eventuales");
  }
}

export async function adminGetEventual(req, res) {
  try {
    const eventual = await getEventualDetail(req.params.id);
    if (!eventual) {
      return res.status(404).json({ error: "Eventual no encontrado" });
    }
    res.json(eventual);
  } catch (error) {
    handleError(res, error, "Error obteniendo eventual");
  }
}

export async function adminCreateEventual(req, res) {
  try {
    const eventual = await saveEventual({
      payload: req.body || {},
      actorUsername: req.body?.usuario,
    });
    res.status(201).json(eventual);
  } catch (error) {
    handleError(res, error, "Error creando eventual");
  }
}

export async function adminUpdateEventual(req, res) {
  try {
    const eventual = await saveEventual({
      eventualId: req.params.id,
      payload: req.body || {},
      actorUsername: req.body?.usuario,
    });
    res.json(eventual);
  } catch (error) {
    handleError(res, error, "Error completando datos del eventual");
  }
}

export async function adminImportarHorasBrowix(req, res) {
  const actor = await requireActor(req, res, ROLES_HORAS_BROWIX);
  if (!actor) return;

  try {
    const eventual = await importarHorasBrowixEventual({
      eventualId: req.params.id,
      actorId: actor.id,
      actorNombre: actor.nombre || actor.username,
    });
    res.json(eventual);
  } catch (error) {
    handleError(res, error, "Error importando horas de Browix");
  }
}

export async function adminDeleteEventual(req, res) {
  try {
    const deleted = await deleteEventual(req.params.id, req.body?.usuario);
    if (!deleted) {
      return res.status(404).json({ error: "Eventual no encontrado" });
    }
    res.json({ message: "Eventual dado de baja" });
  } catch (error) {
    handleError(res, error, "Error dando de baja eventual");
  }
}
