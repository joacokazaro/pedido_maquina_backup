import { Router } from "express";
import {
  adminGetSupervisores,
  adminGetServiciosSupervisor,
  adminAsignarServiciosSupervisor,
} from "../controllers/admin_supervisores.controller.js";

const router = Router();

/* ========================================================
   SUPERVISORES ↔ SERVICIOS
======================================================== */

router.get("/supervisores", adminGetSupervisores);
router.get("/supervisores/:id/servicios", adminGetServiciosSupervisor);
router.put("/supervisores/:id/servicios", adminAsignarServiciosSupervisor);

export default router;
