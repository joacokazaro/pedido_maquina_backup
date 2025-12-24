//C:\Users\TBRHT\Desktop\pedido_maquina_backup\backend\src\routes\admin_supervisores.routes.js
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

// GET /admin/supervisores
router.get("/", adminGetSupervisores);

// GET /admin/supervisores/:id/servicios
router.get("/:id/servicios", adminGetServiciosSupervisor);

// PUT /admin/supervisores/:id/servicios
router.put("/:id/servicios", adminAsignarServiciosSupervisor);

export default router;
