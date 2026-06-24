import { Router } from "express";
import { 
  getMaquinas,
  getMaquinaById,
  getMaquinasPorTipo,
  actualizarEstado,
  marcarMaquinaTaller,
} from "../controllers/maquinas.controller.js";

const router = Router();

router.get("/", getMaquinas);
router.put("/:id/taller", marcarMaquinaTaller);
router.get("/:id", getMaquinaById);
router.get("/tipo/:tipo", getMaquinasPorTipo);
router.put("/:id/estado", actualizarEstado);

export default router;
