import { Router } from "express";
import { getVehiculos, getVehiculoById, marcarVehiculoTaller } from "../controllers/vehiculos.controller.js";

const router = Router();

router.get("/", getVehiculos);
router.put("/:id/taller", marcarVehiculoTaller);
router.get("/:id", getVehiculoById);

export default router;
