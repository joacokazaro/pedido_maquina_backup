// routes/adminPedidos.routes.js
import { Router } from "express";

import {
  adminListPedidos,
  adminGetPedido,
  adminUpdateEstado
} from "../controllers/adminPedidos.controller.js";

const router = Router();

// LISTAR TODOS
// GET /admin/pedidos
router.get("/pedidos", adminListPedidos);

// OBTENER UNO
// GET /admin/pedidos/:id
router.get("/pedidos/:id", adminGetPedido);

// CAMBIAR ESTADO DE UN PEDIDO
// PUT /admin/pedidos/:id/estado
router.put("/pedidos/:id/estado", adminUpdateEstado);

export default router;
