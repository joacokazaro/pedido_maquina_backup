import express from "express";
import multer from "multer";
import {
  adminGetServicios,
  adminGetServicioById,
  adminCreateServicio,
  adminUpdateServicio,
  adminDeleteServicio,
  adminExportServicios,
  adminDownloadServiciosTemplate,
  adminImportServicios,
} from "../controllers/adminServicios.controller.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/servicios/export", adminExportServicios);
router.get("/servicios/import/template", adminDownloadServiciosTemplate);
router.post("/servicios/import", upload.single("file"), adminImportServicios);
router.get("/servicios", adminGetServicios);
router.get("/servicios/:id", adminGetServicioById);
router.post("/servicios", adminCreateServicio);
router.put("/servicios/:id", adminUpdateServicio);
router.delete("/servicios/:id", adminDeleteServicio);
export default router;
