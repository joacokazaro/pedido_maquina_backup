import { Router } from "express";
import {
  adminListPedidos,
  adminGetPedido,
  adminUpdateEstado
} from "../controllers/adminPedidos.controller.js";

const router = Router();

router.get("/pedidos", adminListPedidos);
router.get("/pedidos/:id", adminGetPedido);
router.put("/pedidos/:id/estado", adminUpdateEstado);

export default router;
