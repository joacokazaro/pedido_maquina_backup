import { Router } from "express";
import {
  adminActualizarHorasSupervisor,
  adminGetComponentesCatalogo,
  adminCreateEventual,
  adminDeleteEventual,
  adminDesvincularPedidoComplementario,
  adminGetEventual,
  adminImportarHorasBrowix,
  adminImportarInsumos,
  adminListEventuales,
  adminUpdateEventual,
} from "../controllers/adminEventuales.controller.js";
import { adminGetKpisEspaciosVerdes } from "../controllers/kpiEspaciosVerdes.controller.js";

import {
  adminBuscarSimilares,
  adminCompararEventuales,
  adminGetCandidatosComparador,
} from "../controllers/comparadorEventuales.controller.js";

const router = Router();

router.get("/eventuales/comparador/candidatos", adminGetCandidatosComparador);
router.get("/eventuales/comparador/versus", adminCompararEventuales);
router.post("/eventuales/comparador/similares", adminBuscarSimilares);
router.get("/eventuales/componentes/catalogo", adminGetComponentesCatalogo);
router.get("/eventuales/kpis/espacios-verdes", adminGetKpisEspaciosVerdes);

router.get("/eventuales", adminListEventuales);
router.get("/eventuales/:id", adminGetEventual);
router.post("/eventuales", adminCreateEventual);
router.put("/eventuales/:id", adminUpdateEventual);
router.post("/eventuales/:id/importar-horas-browix", adminImportarHorasBrowix);
router.post("/eventuales/:id/importar-insumos", adminImportarInsumos);
router.put("/eventuales/:id/horas-supervisor", adminActualizarHorasSupervisor);
router.delete("/eventuales/:id/pedidos/:pedidoId", adminDesvincularPedidoComplementario);
router.delete("/eventuales/:id", adminDeleteEventual);

export default router;
