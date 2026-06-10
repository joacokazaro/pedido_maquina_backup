import {
  deleteEventual,
  deleteKit,
  getEventualDetail,
  getKitCatalogo,
  getKitDetail,
  listEventuales,
  listKits,
  saveEventual,
  saveKit,
  reactivateKit,
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

export async function adminListKits(req, res) {
  try {
    const kits = await listKits(req.query || {});
    res.json(kits);
  } catch (error) {
    handleError(res, error, "Error listando kits");
  }
}

export async function adminGetKit(req, res) {
  try {
    const kit = await getKitDetail(req.params.id);
    if (!kit) {
      return res.status(404).json({ error: "Kit no encontrado" });
    }
    res.json(kit);
  } catch (error) {
    handleError(res, error, "Error obteniendo kit");
  }
}

export async function adminGetKitCatalogo(req, res) {
  try {
    const catalogo = await getKitCatalogo();
    res.json(catalogo);
  } catch (error) {
    handleError(res, error, "Error obteniendo catalogo de kits");
  }
}

export async function adminCreateKit(req, res) {
  try {
    const kit = await saveKit({
      payload: req.body || {},
      actorUsername: req.body?.usuario,
    });
    res.status(201).json(kit);
  } catch (error) {
    handleError(res, error, "Error creando kit");
  }
}

export async function adminUpdateKit(req, res) {
  try {
    const kit = await saveKit({
      kitId: req.params.id,
      payload: req.body || {},
      actorUsername: req.body?.usuario,
    });
    res.json(kit);
  } catch (error) {
    handleError(res, error, "Error actualizando kit");
  }
}

export async function adminDeleteKit(req, res) {
  try {
    const deleted = await deleteKit(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Kit no encontrado" });
    }
    res.json({ message: "Kit dado de baja" });
  } catch (error) {
    handleError(res, error, "Error dando de baja kit");
  }
}

  export async function adminReactivateKit(req, res) {
    try {
      const reactivated = await reactivateKit(req.params.id);
      if (!reactivated) {
        return res.status(404).json({ error: "Kit no encontrado" });
      }
      res.json({ message: "Kit reactivado" });
    } catch (error) {
      handleError(res, error, "Error reactivando kit");
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
    handleError(res, error, "Error corrigiendo eventual");
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
