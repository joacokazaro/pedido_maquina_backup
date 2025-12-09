import { Router } from "express";
import { 
  getMaquinas,
  getMaquinaById,
  getMaquinasPorTipo,
  actualizarEstado
} from "../controllers/maquinas.controller.js";

const router = Router();

router.get("/", getMaquinas);
router.get("/:id", getMaquinaById);
router.get("/tipo/:tipo", getMaquinasPorTipo);
router.put("/:id/estado", actualizarEstado);

export default router;
