import { Router } from "express";
import {
  adminGetSupervisores,
  adminGetServiciosSupervisor,
  adminAsignarServiciosSupervisor,
  adminGetUsuariosOperativos,
  getSupervisoresCatalogo,
  getMaquinasPorSupervisor,
} from "../controllers/admin_supervisores.controller.js";

const router = Router();

router.get("/catalogo", getSupervisoresCatalogo);
router.get("/:id/maquinas", getMaquinasPorSupervisor);

// GET /admin/supervisores
router.get("/", adminGetSupervisores);

// GET /admin/supervisores/:id/servicios
router.get("/:id/servicios", adminGetServiciosSupervisor);

// PUT /admin/supervisores/:id/servicios
router.put("/:id/servicios", adminAsignarServiciosSupervisor);

router.get("/usuarios-operativos", adminGetUsuariosOperativos);


export default router;
