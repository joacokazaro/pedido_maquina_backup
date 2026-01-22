import { Router } from "express";
import {
  getNotificaciones,
  marcarNotificacionLeida,
} from "../controllers/notificaciones.controller.js";

const router = Router();

router.get("/", getNotificaciones);
router.put("/:id/leida", marcarNotificacionLeida);

export default router;
