import { Router } from "express";
import {
  adminActualizarHorasSupervisor,
  adminGetComponentesCatalogo,
  adminCreateEventual,
  adminDeleteEventual,
  adminGetEventual,
  adminImportarHorasBrowix,
  adminImportarInsumos,
  adminListEventuales,
  adminUpdateEventual,
} from "../controllers/adminEventuales.controller.js";

const router = Router();

router.get("/eventuales/componentes/catalogo", adminGetComponentesCatalogo);

router.get("/eventuales", adminListEventuales);
router.get("/eventuales/:id", adminGetEventual);
router.post("/eventuales", adminCreateEventual);
router.put("/eventuales/:id", adminUpdateEventual);
router.post("/eventuales/:id/importar-horas-browix", adminImportarHorasBrowix);
router.post("/eventuales/:id/importar-insumos", adminImportarInsumos);
router.put("/eventuales/:id/horas-supervisor", adminActualizarHorasSupervisor);
router.delete("/eventuales/:id", adminDeleteEventual);

export default router;
