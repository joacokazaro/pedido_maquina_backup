import { Router } from "express";
import multer from "multer";

import {
  adminGetMaquinas,
  adminGetMaquinaById,
  adminGetPedidosHistoricosByMaquina,
  adminCreateMaquina,
  adminUpdateMaquina,
  adminDeleteMaquina,
  adminCambiarEstado,
  adminResumenStock,
  adminExportMaquinas,
  adminDownloadMaquinasTemplate,
  adminPreviewImportMaquinas,
  adminConfirmImportMaquinas,
  adminMoverMaquinasMasivo,
  adminGetTiposMaquina,
  adminCreateTipoMaquina,
  adminUpdateTipoMaquina,
  adminDeleteTipoMaquina
} from "../controllers/adminMaquinas.controller.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// LISTADO CON FILTROS
router.get("/maquinas/export", adminExportMaquinas);
router.get("/maquinas/import/template", adminDownloadMaquinasTemplate);
router.post("/maquinas/import/preview", upload.single("file"), adminPreviewImportMaquinas);
router.post("/maquinas/import/confirm", upload.single("file"), adminConfirmImportMaquinas);

// TIPOS DE MÁQUINA
router.get("/maquinas/tipos", adminGetTiposMaquina);
router.post("/maquinas/tipos", adminCreateTipoMaquina);
router.put("/maquinas/tipos/:tipoId", adminUpdateTipoMaquina);
router.delete("/maquinas/tipos/:tipoId", adminDeleteTipoMaquina);

router.get("/maquinas", adminGetMaquinas);

// MOVIMIENTOS MASIVOS
router.post("/maquinas/movimientos-masivos", adminMoverMaquinasMasivo);

// STOCK RESUMEN
router.get("/maquinas/stock-resumen", adminResumenStock);

// HISTÓRICO DE PEDIDOS POR MÁQUINA
router.get("/maquinas/:id/pedidos-historicos", adminGetPedidosHistoricosByMaquina);

// OBTENER UNA
router.get("/maquinas/:id", adminGetMaquinaById);

// CREAR
router.post("/maquinas", adminCreateMaquina);

// EDITAR
router.put("/maquinas/:id", adminUpdateMaquina);

// CAMBIAR SOLO ESTADO
router.put("/maquinas/:id/estado", adminCambiarEstado);

// BAJA LÓGICA
router.delete("/maquinas/:id", adminDeleteMaquina);

export default router;
