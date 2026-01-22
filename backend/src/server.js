import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server as IOServer } from "socket.io";

// ROUTES
import authRoutes from "./routes/auth.routes.js";
import maquinasRoutes from "./routes/maquinas.routes.js";
import pedidosRoutes from "./routes/pedidos.routes.js";

import adminMaquinasRoutes from "./routes/adminMaquinas.routes.js";
import adminPedidosRoutes from "./routes/adminPedidos.routes.js";
import adminUsuariosRoutes from "./routes/admin_usuarios.routes.js";
import adminServiciosRoutes from "./routes/adminServicios.routes.js";
import adminSupervisoresRoutes from "./routes/admin_supervisores.routes.js";

import serviciosRoutes from "./routes/servicios.routes.js";
import notificacionesRoutes from "./routes/notificaciones.routes.js";

const app = express();

/* =======================
   MIDDLEWARES
======================= */
app.use(cors());
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
api.use("/pedidos", pedidosRoutes);
api.use("/servicios", serviciosRoutes);
api.use("/notificaciones", notificacionesRoutes);

// SUPERVISORES (API NORMAL)
api.use("/supervisores", adminSupervisoresRoutes);


/* =======================
   ADMIN (TODO BAJO /api)
======================= */
api.use("/admin-users", adminUsuariosRoutes);
api.use("/admin", adminMaquinasRoutes);
api.use("/admin", adminPedidosRoutes);
api.use("/admin", adminServiciosRoutes);





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

/* ======================= */
const PORT = process.env.PORT || 3000;

// Create HTTP server and attach Socket.IO
const httpServer = createServer(app);

const io = new IOServer(httpServer, {
   cors: {
      origin: true,
      methods: ["GET", "POST"],
   },
});

// Expose io via app so controllers can emit events: req.app.get('io')
app.set("io", io);

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
