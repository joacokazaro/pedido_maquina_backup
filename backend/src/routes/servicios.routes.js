// routes/servicios.routes.js
import express from "express";
import { getServicios,
        getServiciosPorUsuario
 } from "../controllers/servicios.controller.js";

const router = express.Router();

router.get("/", getServicios);
router.get("/usuario/:username", getServiciosPorUsuario);


export default router;
