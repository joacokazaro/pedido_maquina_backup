import { Router } from "express";
import {
  adminCreateSeguro,
  adminDeleteSeguro,
  adminGetSeguros,
  adminUpdateSeguro,
} from "../controllers/adminSeguros.controller.js";

const router = Router();

router.get("/seguros", adminGetSeguros);
router.post("/seguros", adminCreateSeguro);
router.put("/seguros/:id", adminUpdateSeguro);
router.delete("/seguros/:id", adminDeleteSeguro);

export default router;