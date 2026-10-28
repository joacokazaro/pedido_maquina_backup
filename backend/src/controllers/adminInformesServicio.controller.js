import {
  createInforme,
  deleteInforme,
  getInformeDetail,
  importarHorasBrowixInforme,
  importarInsumosInforme,
  listInformes,
  listServiciosDisponibles,
  recargarDesdePedidos,
  updateInforme,
} from "../services/informesServicio.service.js";
import { getComponentesCatalogo } from "../services/eventuales.service.js";
import { requireActor } from "../services/requestActor.service.js";

const ROLES_INFORME_SERVICIO = ["admin", "coordinador"];

function handleError(res, error, fallbackMessage) {
  const status = error?.status || 500;
  const payload = error?.payload || null;

  console.error(fallbackMessage, error);
  res.status(status).json({
    error: error?.message || fallbackMessage,
    ...(payload ? payload : {}),
  });
}

// Cada handler resuelve el actor y valida rol; si no está autorizado ya respondió.
function withActor(fallbackMessage, handler) {
  return async (req, res) => {
    const actor = await requireActor(req, res, ROLES_INFORME_SERVICIO);
    if (!actor) return;

    try {
      await handler(req, res, actor);
    } catch (error) {
      handleError(res, error, fallbackMessage);
    }
  };
}

export const adminListServiciosParaInforme = withActor("Error listando servicios", async (req, res) => {
  res.json(await listServiciosDisponibles());
});

export const adminGetCatalogoInforme = withActor("Error obteniendo catálogo de componentes", async (req, res) => {
  res.json(await getComponentesCatalogo());
});

export const adminListInformesServicio = withActor("Error listando informes", async (req, res) => {
  res.json(await listInformes({ servicioId: req.query?.servicioId }));
});

export const adminGetInformeServicio = withActor("Error obteniendo informe", async (req, res) => {
  const informe = await getInformeDetail(req.params.id);
  if (!informe) {
    return res.status(404).json({ error: "Informe no encontrado" });
  }
  res.json(informe);
});

export const adminCreateInformeServicio = withActor("Error creando informe", async (req, res, actor) => {
  const informe = await createInforme({ payload: req.body || {}, actor });
  res.status(201).json(informe);
});

export const adminUpdateInformeServicio = withActor("Error guardando informe", async (req, res, actor) => {
  res.json(await updateInforme({ informeId: req.params.id, payload: req.body || {}, actor }));
});

export const adminRecargarPedidosInforme = withActor("Error trayendo los pedidos del período", async (req, res) => {
  res.json(await recargarDesdePedidos({ informeId: req.params.id }));
});

export const adminImportarHorasBrowixInforme = withActor("Error importando horas de Browix", async (req, res, actor) => {
  res.json(await importarHorasBrowixInforme({ informeId: req.params.id, actor }));
});

export const adminImportarInsumosInforme = withActor("Error importando insumos", async (req, res, actor) => {
  res.json(await importarInsumosInforme({ informeId: req.params.id, actor }));
});

export const adminDeleteInformeServicio = withActor("Error eliminando informe", async (req, res) => {
  const eliminado = await deleteInforme(req.params.id);
  if (!eliminado) {
    return res.status(404).json({ error: "Informe no encontrado" });
  }
  res.json({ message: "Informe eliminado" });
});
