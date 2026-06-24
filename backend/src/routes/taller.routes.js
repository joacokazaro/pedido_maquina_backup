import { Router } from "express";
import {
  adminBatchTallerMaquinas,
  adminBatchTallerVehiculos,
  adminHistorialTallerMaquinas,
  adminHistorialTallerVehiculos,
} from "../controllers/taller.controller.js";

const router = Router();

router.get("/taller/maquinas/historial", adminHistorialTallerMaquinas);
router.get("/taller/vehiculos/historial", adminHistorialTallerVehiculos);
router.post("/taller/maquinas/movimientos", adminBatchTallerMaquinas);
router.post("/taller/vehiculos/movimientos", adminBatchTallerVehiculos);

export default router;