import { Router } from "express";
import {
  adminListPedidos,
  adminGetPedido,
  adminUpdateEstado,
  adminDeletePedido,
  adminExportPedidos
} from "../controllers/adminPedidos.controller.js";

const router = Router();

router.get("/pedidos/export", adminExportPedidos);
router.get("/pedidos", adminListPedidos);
router.get("/pedidos/:id", adminGetPedido);
router.put("/pedidos/:id/estado", adminUpdateEstado);
router.delete("/pedidos/:id", adminDeletePedido);





export default router;
