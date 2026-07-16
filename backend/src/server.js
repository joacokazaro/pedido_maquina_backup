import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server as IOServer } from "socket.io";

// ROUTES
import authRoutes from "./routes/auth.routes.js";
import maquinasRoutes from "./routes/maquinas.routes.js";
import vehiculosRoutes from "./routes/vehiculos.routes.js";
import pedidosRoutes from "./routes/pedidos.routes.js";

import adminMaquinasRoutes from "./routes/adminMaquinas.routes.js";
import adminPedidosRoutes from "./routes/adminPedidos.routes.js";
import adminUsuariosRoutes from "./routes/admin_usuarios.routes.js";
import adminServiciosRoutes from "./routes/adminServicios.routes.js";
import adminSegurosRoutes from "./routes/adminSeguros.routes.js";
import adminVehiculosRoutes from "./routes/adminVehiculos.routes.js";
import adminSupervisoresRoutes from "./routes/admin_supervisores.routes.js";
import adminEventualesRoutes from "./routes/adminEventuales.routes.js";
import tallerRoutes from "./routes/taller.routes.js";

import serviciosRoutes from "./routes/servicios.routes.js";
import notificacionesRoutes from "./routes/notificaciones.routes.js";
import eventualesRoutes from "./routes/eventuales.routes.js";
import { iniciarMonitorPrestamosProlongados } from "./services/notificaciones.service.js";

const app = express();

// Detrás de nginx en prod: sin esto, express-rate-limit no puede resolver
// el IP real del cliente (X-Forwarded-For) y rompe /api/auth/login para todos.
// "loopback" confía solo en conexiones desde 127.0.0.1/::1 (nginx en el mismo
// servidor que Node). Si nginx corre en OTRA máquina/contenedor separado,
// hay que cambiar esto por la IP/subred real de nginx.
app.set("trust proxy", "loopback");

/* =======================
   CORS
   El frontend siempre habla con la API en el mismo origen
   (proxy de Vite en dev, mismo dominio detrás de nginx en prod),
   así que un navegador nunca necesita CORS para el flujo normal.
   Esta whitelist es solo para accesos cross-origin explícitos
   (herramientas de prueba, otro front, etc).
======================= */
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
};

/* =======================
   MIDDLEWARES
======================= */
app.use(
  helmet({
    // El SPA carga fuentes de Google Fonts e imágenes presignadas de S3;
    // armar un CSP correcto para eso es una tarea aparte, no un quick-fix.
    // El resto de las protecciones de helmet (noSniff, frameguard, HSTS, etc.) quedan activas.
    contentSecurityPolicy: false,
  })
);
app.use(cors(corsOptions));
app.use(express.json());

/* =======================
   API ROOT (CLAVE)
======================= */
const api = express.Router();
app.use("/api", api);

/* =======================
   SOCKET.IO
======================= */
// We will create the HTTP server later and attach Socket.IO to it.


/* =======================
   API ROUTES
======================= */
api.use("/auth", authRoutes);
api.use("/maquinas", maquinasRoutes);
api.use("/vehiculos", vehiculosRoutes);
api.use("/pedidos", pedidosRoutes);
api.use("/servicios", serviciosRoutes);
api.use("/notificaciones", notificacionesRoutes);
api.use("/eventuales", eventualesRoutes);

// SUPERVISORES (API NORMAL)
api.use("/supervisores", adminSupervisoresRoutes);


/* =======================
   ADMIN (TODO BAJO /api)
======================= */
api.use("/admin-users", adminUsuariosRoutes);
api.use("/admin", adminMaquinasRoutes);
api.use("/admin", adminPedidosRoutes);
api.use("/admin", adminServiciosRoutes);
api.use("/admin", adminSegurosRoutes);
api.use("/admin", adminVehiculosRoutes);
api.use("/admin", adminEventualesRoutes);
api.use("/admin", tallerRoutes);





/* =======================
   HEALTHCHECK
======================= */
api.get("/health", (req, res) => {
  res.status(200).json({ ok: true, ts: new Date().toISOString() });
});

/* =======================
   FRONTEND (VITE BUILD)
======================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONT_DIST = path.join(__dirname, "../public");

app.use(express.static(FRONT_DIST));

// SPA fallback (ÚLTIMO)
app.get("*", (req, res) => {
   res.sendFile(path.join(FRONT_DIST, "index.html"));
});

/* =======================
   MANEJADOR DE ERRORES GLOBAL (siempre al final)
======================= */
const isProd = process.env.NODE_ENV === "production";

app.use((err, req, res, _next) => {
   if (err?.message?.startsWith("Origen no permitido por CORS")) {
      return res.status(403).json({ error: "Origen no permitido" });
   }

   console.error("Error no manejado:", err);

   res.status(err.status || 500).json({
      error: isProd ? "Error interno del servidor" : err.message || "Error interno del servidor",
   });
});

/* ======================= */
const PORT = process.env.PORT || 3000;

// Create HTTP server and attach Socket.IO
const httpServer = createServer(app);

const io = new IOServer(httpServer, {
   cors: {
      origin(origin, callback) {
         if (!origin || ALLOWED_ORIGINS.includes(origin)) {
            return callback(null, true);
         }
         return callback(new Error(`Origen no permitido por CORS: ${origin}`));
      },
      methods: ["GET", "POST"],
   },
});

// Expose io via app so controllers can emit events: req.app.get('io')
app.set("io", io);

iniciarMonitorPrestamosProlongados({ io });

// Allow clients to join rooms
io.on("connection", (socket) => {
   console.log("Socket connected:", socket.id, "from", socket.handshake.address);

   socket.on("join", ({ room }) => {
      if (!room) return;
      socket.join(room);
      console.log(`Socket ${socket.id} joined room ${room}`);
   });

   socket.on("leave", ({ room }) => {
      if (!room) return;
      socket.leave(room);
      console.log(`Socket ${socket.id} left room ${room}`);
   });

   socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", socket.id, reason);
   });
});

httpServer.listen(PORT, () => {
   console.log(`Servidor activo en http://localhost:${PORT}`);
});
