import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// ROUTES
import authRoutes from "./routes/auth.routes.js";
import maquinasRoutes from "./routes/maquinas.routes.js";
import pedidosRoutes from "./routes/pedidos.routes.js";
import serviciosRoutes from "./routes/servicios.routes.js";

import adminMaquinasRoutes from "./routes/adminMaquinas.routes.js";
import adminPedidosRoutes from "./routes/adminPedidos.routes.js";
import adminUsuariosRoutes from "./routes/admin_usuarios.routes.js";
import adminServiciosRoutes from "./routes/adminServicios.routes.js";
import adminSupervisoresRoutes from "./routes/admin_supervisores.routes.js";

const app = express();

// =======================
// MIDDLEWARES
// =======================
app.use(cors());
app.use(express.json());

// =======================
// API ROUTER
// =======================
const api = express.Router();

// Core
api.use("/auth", authRoutes);
api.use("/maquinas", maquinasRoutes);
api.use("/pedidos", pedidosRoutes);
api.use("/servicios", serviciosRoutes);

// Admin
api.use("/admin-users", adminUsuariosRoutes);
api.use("/admin", adminMaquinasRoutes);
api.use("/admin", adminPedidosRoutes);
api.use("/admin", adminServiciosRoutes);

// ✅ Supervisores x servicios
api.use("/admin/supervisores", adminSupervisoresRoutes);

// Health
api.get("/health", (req, res) => {
  res.status(200).json({ ok: true, ts: new Date().toISOString() });
});

// Montar /api
app.use("/api", api);

// ✅ CLAVE: si no matchea /api, devolvé 404 JSON (NO index.html)
app.use("/api", (req, res) => {
  res.status(404).json({ error: "API route not found", path: req.originalUrl });
});

// =======================
// FRONTEND
// =======================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONT_DIST = path.join(__dirname, "../public");

app.use(express.static(FRONT_DIST));

// ✅ SPA fallback, pero EXCLUYE /api
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(FRONT_DIST, "index.html"));
});

// =======================
// START
// =======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor activo en http://localhost:${PORT}`);
});
