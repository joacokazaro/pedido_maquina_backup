// routes/servicios.routes.js
import express from "express";
import { getServicios } from "../controllers/servicios.controller.js";

const router = express.Router();
router.get("/", getServicios);
export default router;
