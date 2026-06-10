import { Router } from "express";
import {
  adminCreateEventual,
  adminCreateKit,
  adminDeleteEventual,
  adminDeleteKit,
  adminGetEventual,
  adminGetKit,
  adminGetKitCatalogo,
  adminListEventuales,
  adminListKits,
  adminReactivateKit,
  adminUpdateEventual,
  adminUpdateKit,
} from "../controllers/adminEventuales.controller.js";

const router = Router();

router.get("/kits/catalogo", adminGetKitCatalogo);
router.get("/kits", adminListKits);
router.get("/kits/:id", adminGetKit);
router.post("/kits", adminCreateKit);
router.put("/kits/:id", adminUpdateKit);
router.delete("/kits/:id", adminDeleteKit);
router.post("/kits/:id/reactivar", adminReactivateKit);

router.get("/eventuales", adminListEventuales);
router.get("/eventuales/:id", adminGetEventual);
router.post("/eventuales", adminCreateEventual);
router.put("/eventuales/:id", adminUpdateEventual);
router.delete("/eventuales/:id", adminDeleteEventual);

export default router;
