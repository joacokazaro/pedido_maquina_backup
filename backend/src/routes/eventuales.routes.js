import { Router } from "express";
import {
  createSupervisorObservation,
  finalizeEventualBySupervisor,
  getEventualSupervisor,
  getMisEventuales,
  updateSupervisorComponentes,
} from "../controllers/eventuales.controller.js";

const router = Router();

router.get("/mis/:username", getMisEventuales);
router.get("/:id", getEventualSupervisor);
router.put("/:id/componentes", updateSupervisorComponentes);
router.post("/:id/observaciones", createSupervisorObservation);
router.post("/:id/finalizar", finalizeEventualBySupervisor);

export default router;
