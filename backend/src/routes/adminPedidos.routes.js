import { Router } from "express";
import {
  adminListPedidos,
  adminGetPedido,
  adminUpdateEstado,
  adminDeletePedido,
  adminAprobarCancelacion,
  adminExportPedidos
} from "../controllers/adminPedidos.controller.js";

const router = Router();

router.get("/pedidos/export", adminExportPedidos);
router.get("/pedidos", adminListPedidos);
router.get("/pedidos/:id", adminGetPedido);
router.put("/pedidos/:id/estado", adminUpdateEstado);
router.post("/pedidos/:id/aprobar-cancelacion", adminAprobarCancelacion);
router.delete("/pedidos/:id", adminDeletePedido);





export default router;
