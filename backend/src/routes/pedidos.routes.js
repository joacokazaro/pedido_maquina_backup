import { Router } from "express";
import {
  crearPedido,
  getPedidosSupervisor,
  getPedidoById,
  registrarDevolucion,
  asignarMaquinas,
  actualizarEstadoPedido,
  marcarEntregado,
  confirmarDevolucion,
  getPedidos,
  completarFaltantes
} from "../controllers/pedidos.controller.js";

const router = Router();

// LISTAR TODOS
router.get("/", getPedidos);

// CREAR PEDIDO
router.post("/", crearPedido);

// LISTAR POR SUPERVISOR
router.get("/supervisor/:supervisorId", getPedidosSupervisor);

// OBTENER PEDIDO POR ID
router.get("/:id", getPedidoById);

// DEVOLUCIÓN (SUPERVISOR)
router.post("/:id/devolucion", registrarDevolucion);

// CONFIRMAR DEVOLUCIÓN (DEPÓSITO) 
router.post("/:id/confirmar-devolucion", confirmarDevolucion);

// ASIGNAR MÁQUINAS
router.post("/:id/asignar", asignarMaquinas);

// CAMBIAR ESTADO
router.put("/:id/estado", actualizarEstadoPedido);

// MARCAR COMO ENTREGADO
router.post("/:id/entregar", marcarEntregado);

// COMPLETAR FALTANTES
router.post("/:id/completar-faltantes", completarFaltantes);


export default router;
