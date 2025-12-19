import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// ROUTES
import authRoutes from "./routes/auth.routes.js";
import maquinasRoutes from "./routes/maquinas.routes.js";
import pedidosRoutes from "./routes/pedidos.routes.js";
import adminMaquinasRoutes from "./routes/adminMaquinas.routes.js";
import adminPedidosRoutes from "./routes/adminPedidos.routes.js";
import adminUsuariosRoutes from "./routes/admin_usuarios.routes.js";
import serviciosRoutes from "./routes/servicios.routes.js";
import adminServiciosRoutes from "./routes/adminServicios.routes.js";

const app = express();

// =======================
// MIDDLEWARES
// =======================
app.use(cors());
app.use(express.json());

// =======================
// API ROUTES
// =======================
app.use("/auth", authRoutes);
app.use("/maquinas", maquinasRoutes);
app.use("/pedidos", pedidosRoutes);

// ADMIN
app.use("/admin-users", adminUsuariosRoutes);
app.use("/admin", adminMaquinasRoutes);
app.use("/admin", adminPedidosRoutes);

app.use("/servicios", serviciosRoutes);
app.use("/admin", adminServiciosRoutes);

// =======================
// HEALTHCHECK (ANTES DEL *)
// =======================
app.get("/health", (req, res) => {
  res.status(200).json({ ok: true, ts: new Date().toISOString() });
});

// =======================
// SERVIR FRONTEND (VITE BUILD)
// =======================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// backend/public
const FRONT_DIST = path.join(__dirname, "../public");

app.use(express.static(FRONT_DIST));

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(FRONT_DIST, "index.html"));
});

// =======================
// START
// =======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor activo en http://localhost:${PORT}`);
});

// =======================
// SHUTDOWN LIMPIO
// =======================
process.on("SIGINT", () => {
  console.log("Servidor detenido");
  process.exit(0);
});
