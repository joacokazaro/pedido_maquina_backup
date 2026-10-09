// Primero: que .env esté cargado antes de que cualquier módulo lea process.env al importarse.
import "dotenv/config";
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
import estadisticasRoutes from "./routes/estadisticas.routes.js";

import serviciosRoutes from "./routes/servicios.routes.js";
import notificacionesRoutes from "./routes/notificaciones.routes.js";
import eventualesRoutes from "./routes/eventuales.routes.js";
import externalRoutes from "./routes/external.routes.js";
import { iniciarMonitorPrestamosProlongados } from "./services/notificaciones.service.js";
import { authenticate, legacyHeaderEnabled } from "./middlewares/authenticate.js";
import { assertSessionConfig, verifySessionToken } from "./services/sessionToken.service.js";
import prisma from "./db/prisma.js";
import { userHasRole } from "./services/roles.service.js";

// En producción, sin SESSION_JWT_SECRET no se arranca (mejor que firmar con un secreto débil).
assertSessionConfig();

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
// PÚBLICO (login) y EXTERNO (API key propia): van antes de `authenticate`.
api.use("/auth", authRoutes);
api.get("/health", (req, res) => {
  res.status(200).json({ ok: true, ts: new Date().toISOString() });
});
// EXTERNO (autenticación por API key, sin sesión de usuario)
api.use("/external", externalRoutes);

// Desde acá TODO exige sesión firmada (o, en transición, el header viejo: ver AUTH_LEGACY_HEADER).
api.use(authenticate);

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
api.use("/admin", estadisticasRoutes);





// 404 JSON para cualquier /api/* que no matcheó ningún router de arriba
// (sin esto, cae en el fallback SPA de más abajo y responde HTML con 200).
api.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
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

// Identifica al socket con el mismo token firmado que usa la API. En transición
// (AUTH_LEGACY_HEADER) se deja pasar uno sin token, como antes.
io.use(async (socket, next) => {
   const token = socket.handshake.auth?.token;
   if (token) {
      try {
         socket.data.auth = await verifySessionToken(String(token));
         return next();
      } catch {
         return next(new Error("Sesión inválida o vencida"));
      }
   }
   if (legacyHeaderEnabled()) return next();
   return next(new Error("Falta iniciar sesión"));
});

// Un socket con sesión solo puede entrar a SU sala (USER:<username>) y, si tiene rol de
// depósito, a DEPOSITO. Sin sesión (solo en transición) se mantiene el comportamiento viejo.
async function puedeUnirseASala(socket, room) {
   const auth = socket.data.auth;
   if (!auth) return true;
   if (room === `USER:${auth.username}`) return true;
   if (room !== "DEPOSITO") return false;

   const user = await prisma.usuario.findUnique({
      where: { username: auth.username },
      select: { rol: true, roles: { select: { rol: true } }, activo: true },
   });
   return Boolean(user?.activo && userHasRole(user, "deposito"));
}

// Allow clients to join rooms
io.on("connection", (socket) => {
   console.log("Socket connected:", socket.id, "from", socket.handshake.address);

   socket.on("join", async ({ room } = {}) => {
      if (!room) return;
      if (!(await puedeUnirseASala(socket, room))) {
         console.warn(`Socket ${socket.id} rechazado al unirse a ${room}`);
         return;
      }
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
