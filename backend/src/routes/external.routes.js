import { Router } from "express";
import rateLimit from "express-rate-limit";
import { apiKeyAuth } from "../middlewares/apiKeyAuth.js";
import {
  getMaquinasExternal,
  getVehiculosExternal,
  postServicioExternal,
  patchServicioExternal,
} from "../controllers/external.controller.js";

const router = Router();

const externalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes. Probá de nuevo en unos minutos." },
});

router.use(externalLimiter, apiKeyAuth);

router.get("/maquinas", getMaquinasExternal);
router.get("/vehiculos", getVehiculosExternal);
router.post("/servicios", postServicioExternal);
router.patch("/servicios/:id", patchServicioExternal);

export default router;
