import express from "express";
import {
  adminGetServicios,
  adminGetServicioById,
  adminCreateServicio,
  adminUpdateServicio,
  adminDeleteServicio,
} from "../controllers/adminServicios.controller.js";

const router = express.Router();

router.get("/servicios", adminGetServicios);
router.get("/servicios/:id", adminGetServicioById);
router.post("/servicios", adminCreateServicio);
router.put("/servicios/:id", adminUpdateServicio);
router.delete("/servicios/:id", adminDeleteServicio);
export default router;
