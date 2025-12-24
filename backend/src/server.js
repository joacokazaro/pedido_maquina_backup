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

/* ======================= */
/* MIDDLEWARES             */
/* ======================= */
app.use(cors());
app.use(express.json());

/* ======================= */
/* API ROUTER              */
/* ======================= */
const api = express.Router();
app.use("/api", api);

/* ======================= */
/* API ROUTES              */
/* ======================= */
api.use("/auth", authRoutes);
api.use("/maquinas", maquinasRoutes);
api.use("/pedidos", pedidosRoutes);
api.use("/servicios", serviciosRoutes);

/* ======================= */
/* ADMIN                   */
/* ======================= */
api.use("/admin-users", adminUsuariosRoutes);
api.use("/admin", adminMaquinasRoutes);
api.use("/admin", adminPedidosRoutes);
api.use("/admin", adminServiciosRoutes);

// ✅ ESTA ES LA CLAVE
api.use("/admin/supervisores", adminSupervisoresRoutes);

/* ======================= */
/* HEALTHCHECK             */
/* ======================= */
api.get("/health", (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

/* ======================= */
/* FRONTEND                */
/* ======================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONT_DIST = path.join(__dirname, "../public");

app.use(express.static(FRONT_DIST));

// ⚠️ SIEMPRE ÚLTIMO
app.get("*", (req, res) => {
  res.sendFile(path.join(FRONT_DIST, "index.html"));
});

/* ======================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor activo en http://localhost:${PORT}`);
});
