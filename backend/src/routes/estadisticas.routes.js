import { Router } from "express";
import {
  adminGetEstadisticasTiempoReal,
  adminGetEstadisticasAvisos,
  adminGetEstadisticasPeriodo,
} from "../controllers/estadisticas.controller.js";

const router = Router();

router.get("/estadisticas/tiempo-real", adminGetEstadisticasTiempoReal);
router.get("/estadisticas/avisos", adminGetEstadisticasAvisos);
router.get("/estadisticas/periodo", adminGetEstadisticasPeriodo);

export default router;
