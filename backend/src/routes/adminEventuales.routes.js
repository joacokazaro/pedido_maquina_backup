import { Router } from "express";
import {
  adminGetComponentesCatalogo,
  adminCreateEventual,
  adminDeleteEventual,
  adminGetEventual,
  adminListEventuales,
  adminUpdateEventual,
} from "../controllers/adminEventuales.controller.js";

const router = Router();

router.get("/eventuales/componentes/catalogo", adminGetComponentesCatalogo);

router.get("/eventuales", adminListEventuales);
router.get("/eventuales/:id", adminGetEventual);
router.post("/eventuales", adminCreateEventual);
router.put("/eventuales/:id", adminUpdateEventual);
router.delete("/eventuales/:id", adminDeleteEventual);

export default router;
