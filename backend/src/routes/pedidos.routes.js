import express from "express";
import {
  crearPedido,
  getPedidosSupervisor,
  getPedidoById,
  getPedidos,
  marcarEntregado,
  actualizarEstadoPedido,
  asignarMaquinas,
  registrarDevolucion,
  confirmarDevolucion,
  completarFaltantes,
} from "../controllers/pedidos.controller.js";

const router = express.Router();

// =========================
// CREAR / LISTAR
// =========================
router.post("/", crearPedido);
router.get("/", getPedidos);
router.get("/supervisor/:supervisorId", getPedidosSupervisor);
router.get("/:id", getPedidoById);

// =========================
// ESTADOS
// =========================
router.put("/:id/estado", actualizarEstadoPedido);
router.put("/:id/entregar", marcarEntregado);

// =========================
// ASIGNACIÓN
// =========================
router.post("/:id/asignar", asignarMaquinas);

// =========================
// DEVOLUCIONES
// =========================
router.post("/:id/devolucion", registrarDevolucion);
router.post("/:id/confirmar-devolucion", confirmarDevolucion);
router.post("/:id/completar-faltantes", completarFaltantes);

export default router;
