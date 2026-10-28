import { Router } from "express";
import {
  adminCreateInformeServicio,
  adminDeleteInformeServicio,
  adminGetCatalogoInforme,
  adminGetInformeServicio,
  adminImportarHorasBrowixInforme,
  adminImportarInsumosInforme,
  adminListInformesServicio,
  adminListServiciosParaInforme,
  adminRecargarPedidosInforme,
  adminUpdateInformeServicio,
} from "../controllers/adminInformesServicio.controller.js";

const router = Router();

// Las rutas fijas van antes de `/:id` para que "servicios" y "catalogo" no se lean como un id.
router.get("/informes-servicio/servicios", adminListServiciosParaInforme);
router.get("/informes-servicio/catalogo", adminGetCatalogoInforme);

router.get("/informes-servicio", adminListInformesServicio);
router.post("/informes-servicio", adminCreateInformeServicio);
router.get("/informes-servicio/:id", adminGetInformeServicio);
router.put("/informes-servicio/:id", adminUpdateInformeServicio);
router.post("/informes-servicio/:id/recargar-pedidos", adminRecargarPedidosInforme);
router.post("/informes-servicio/:id/importar-horas-browix", adminImportarHorasBrowixInforme);
router.post("/informes-servicio/:id/importar-insumos", adminImportarInsumosInforme);
router.delete("/informes-servicio/:id", adminDeleteInformeServicio);

export default router;
