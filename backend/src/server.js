import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.routes.js';
import maquinasRoutes from './routes/maquinas.routes.js';
import pedidosRoutes from './routes/pedidos.routes.js';
import adminMaquinasRoutes from "./routes/adminMaquinas.routes.js";
import adminPedidosRoutes from "./routes/adminPedidos.routes.js";
import adminUsuariosRoutes from "./routes/admin_usuarios.routes.js";



const app = express();
app.use(cors());
app.use(express.json());

// Rutas
app.use('/auth', authRoutes);
app.use('/maquinas', maquinasRoutes);
app.use('/pedidos', pedidosRoutes);

// Rutas de ADMIN
app.use("/admin-users", adminUsuariosRoutes);
app.use("/admin", adminMaquinasRoutes);
app.use("/admin", adminPedidosRoutes);



const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Backend funcionando en http://localhost:${PORT}`);
});
