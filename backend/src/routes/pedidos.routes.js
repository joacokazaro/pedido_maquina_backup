import { Router } from "express";
import {
  crearPedido,
  getPedidosSupervisor,
  getPedidoById,
  registrarDevolucion,
  asignarMaquinas,
  actualizarEstadoPedido,
  marcarEntregado,
  getPedidos
} from "../controllers/pedidos.controller.js";

const router = Router();

// LISTAR TODOS LOS PEDIDOS → SIEMPRE PRIMERO
router.get("/", getPedidos);

// CREAR PEDIDO
router.post("/", crearPedido);

// LISTAR POR SUPERVISOR
router.get("/supervisor/:supervisorId", getPedidosSupervisor);

// OBTENER UN PEDIDO POR ID
router.get("/:id", getPedidoById);

// DEVOLUCIÓN
router.post("/:id/devolucion", registrarDevolucion);

// ASIGNAR MÁQUINAS
router.post("/:id/asignar", asignarMaquinas);

// CAMBIAR ESTADO
router.put("/:id/estado", actualizarEstadoPedido);

// MARCAR COMO ENTREGADO
router.post("/:id/entregar", marcarEntregado);

export default router;
