import { Router } from "express";
import { getVehiculos, getVehiculoById } from "../controllers/vehiculos.controller.js";

const router = Router();

router.get("/", getVehiculos);
router.get(":id", getVehiculoById);

export default router;
