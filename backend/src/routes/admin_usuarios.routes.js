import { Router } from "express";
import {
  adminGetUsuarios,
  adminGetUsuarioByUsername,
  adminCreateUsuario,
  adminUpdateUsuario,
  adminDeleteUsuario,
} from "../controllers/admin_usuarios.controller.js";

const router = Router();

router.get("/", adminGetUsuarios);
router.post("/", adminCreateUsuario);
router.get("/:username", adminGetUsuarioByUsername);
router.put("/:username", adminUpdateUsuario);
router.delete("/:username", adminDeleteUsuario);

export default router;
