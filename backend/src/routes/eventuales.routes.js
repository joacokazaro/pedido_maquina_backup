import { Router } from "express";
import {
  createSupervisorObservation,
  finalizeEventualBySupervisor,
  getEventualSupervisor,
  getMisEventuales,
} from "../controllers/eventuales.controller.js";

const router = Router();

router.get("/mis/:username", getMisEventuales);
router.get("/:id", getEventualSupervisor);
router.post("/:id/observaciones", createSupervisorObservation);
router.post("/:id/finalizar", finalizeEventualBySupervisor);

export default router;
