import { Router } from "express";
import {
  adminGetUsuarios,
  adminExportUsuarios,
  adminGetUsuarioByUsername,
  adminCreateUsuario,
  adminUpdateUsuario,
  adminDeleteUsuario,
} from "../controllers/admin_usuarios.controller.js";

const router = Router();

router.get("/", adminGetUsuarios);
router.post("/", adminCreateUsuario);
// antes de "/:username" para que no se lo coma como username
router.get("/export", adminExportUsuarios);
router.get("/:username", adminGetUsuarioByUsername);
router.put("/:username", adminUpdateUsuario);
router.delete("/:username", adminDeleteUsuario);

export default router;
