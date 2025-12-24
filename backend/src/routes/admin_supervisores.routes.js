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

router.get("/supervisores", adminGetSupervisores);
router.get("/supervisores/:id/servicios", adminGetServiciosSupervisor);
router.put("/supervisores/:id/servicios", adminAsignarServiciosSupervisor);


export default router;
