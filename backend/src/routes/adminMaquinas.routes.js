import { Router } from "express";

import {
  adminGetMaquinas,
  adminGetMaquinaById,
  adminCreateMaquina,
  adminUpdateMaquina,
  adminDeleteMaquina,
  adminCambiarEstado,
  adminResumenStock
} from "../controllers/adminMaquinas.controller.js";

const router = Router();

// LISTADO CON FILTROS
router.get("/maquinas", adminGetMaquinas);

// STOCK RESUMEN
router.get("/maquinas/stock-resumen", adminResumenStock);

// OBTENER UNA
router.get("/maquinas/:id", adminGetMaquinaById);

// CREAR
router.post("/maquinas", adminCreateMaquina);

// EDITAR
router.put("/maquinas/:id", adminUpdateMaquina);

// CAMBIAR SOLO ESTADO
router.put("/maquinas/:id/estado", adminCambiarEstado);

// BAJA LÓGICA
router.delete("/maquinas/:id", adminDeleteMaquina);

export default router;
