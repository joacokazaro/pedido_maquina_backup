import { Router } from "express";
import multer from "multer";
import {
  adminAsignarVehiculo,
  adminCreateVehiculo,
  adminDeleteVehiculo,
  adminDesasignarVehiculo,
  adminDownloadVehiculosTemplate,
  adminExportVehiculos,
  adminGetHistorialVehiculo,
  adminGetVehiculoById,
  adminGetVehiculos,
  adminImportVehiculos,
  adminUpdateVehiculo,
} from "../controllers/adminVehiculos.controller.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/vehiculos/export", adminExportVehiculos);
router.get("/vehiculos/import/template", adminDownloadVehiculosTemplate);
router.post("/vehiculos/import", upload.single("file"), adminImportVehiculos);
router.get("/vehiculos", adminGetVehiculos);
router.get("/vehiculos/:id/historial", adminGetHistorialVehiculo);
router.get("/vehiculos/:id", adminGetVehiculoById);
router.post("/vehiculos", adminCreateVehiculo);
router.put("/vehiculos/:id", adminUpdateVehiculo);
router.delete("/vehiculos/:id", adminDeleteVehiculo);
router.post("/vehiculos/:id/asignaciones", adminAsignarVehiculo);
router.delete("/vehiculos/:id/asignaciones/actual", adminDesasignarVehiculo);

export default router;
