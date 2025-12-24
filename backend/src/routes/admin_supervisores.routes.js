import { Router } from "express";
import {
  adminGetSupervisores,
  adminGetServiciosSupervisor,
  adminAsignarServiciosSupervisor,
} from "../controllers/admin_supervisores.controller.js";

const router = Router();

// GET /admin/supervisores
router.get("/", adminGetSupervisores);

// GET /admin/supervisores/:id/servicios
router.get("/:id/servicios", adminGetServiciosSupervisor);

// PUT /admin/supervisores/:id/servicios
router.put("/:id/servicios", adminAsignarServiciosSupervisor);

export default router;
