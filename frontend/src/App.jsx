// src/App.jsx
import { Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";

// SUPERVISOR
import SupervisorHome from "./pages/SupervisorHome";
import CreatePedido from "./pages/CreatePedido";
import ViewPedido from "./pages/ViewPedido";
import RegistrarDevolucion from "./pages/RegistrarDevolucion";

// DEPÓSITO
import DepositoHome from "./pages/DepositoHome";
import DepositoPedido from "./pages/DepositoPedido";
import AsignarMaquinas from "./pages/AsignarMaquinas";
import ConfirmarDevolucion from "./pages/ConfirmarDevolucion";

// ADMIN
import AdminHome from "./pages/AdminHome";
import AdminUsuarios from "./pages/AdminUsuarios";
import AdminUsuarioForm from "./pages/AdminUsuarioForm";
import AdminPedidos from "./pages/AdminPedidos";
import AdminMaquinas from "./pages/AdminMaquinas";
import AdminMaquinaForm from "./pages/AdminMaquinaForm";

function App() {
  return (
    <Routes>
      {/* LOGIN */}
      <Route path="/" element={<Login />} />

      {/* =============================
                SUPERVISOR
      ============================== */}
      <Route
        path="/supervisor"
        element={
          <ProtectedRoute allowedRoles={["SUPERVISOR"]}>
            <SupervisorHome />
          </ProtectedRoute>
        }
      />

      <Route
        path="/supervisor/pedido/nuevo"
        element={
          <ProtectedRoute allowedRoles={["SUPERVISOR"]}>
            <CreatePedido />
          </ProtectedRoute>
        }
      />

      <Route
        path="/supervisor/pedido/:id"
        element={
          <ProtectedRoute allowedRoles={["SUPERVISOR"]}>
            <ViewPedido />
          </ProtectedRoute>
        }
      />

      <Route
        path="/supervisor/pedido/:id/devolucion"
        element={
          <ProtectedRoute allowedRoles={["SUPERVISOR"]}>
            <RegistrarDevolucion />
          </ProtectedRoute>
        }
      />

      {/* =============================
                DEPÓSITO
      ============================== */}
      <Route
        path="/deposito"
        element={
          <ProtectedRoute allowedRoles={["DEPOSITO"]}>
            <DepositoHome />
          </ProtectedRoute>
        }
      />

      <Route
        path="/deposito/pedido/:id"
        element={
          <ProtectedRoute allowedRoles={["DEPOSITO"]}>
            <DepositoPedido />
          </ProtectedRoute>
        }
      />

      <Route
        path="/deposito/pedido/:id/asignar"
        element={
          <ProtectedRoute allowedRoles={["DEPOSITO"]}>
            <AsignarMaquinas />
          </ProtectedRoute>
        }
      />

      {/* 🆕 CONFIRMAR DEVOLUCIÓN */}
      <Route
        path="/deposito/pedido/:id/confirmar"
        element={
          <ProtectedRoute allowedRoles={["DEPOSITO"]}>
            <ConfirmarDevolucion />
          </ProtectedRoute>
        }
      />

      {/* =============================
                  ADMIN
      ============================== */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <AdminHome />
          </ProtectedRoute>
        }
      />

      <Route path="/admin/pedidos" element={<AdminPedidos />} />
      <Route path="/admin/usuarios" element={<AdminUsuarios />} />
      <Route path="/admin/usuarios/nuevo" element={<AdminUsuarioForm />} />
      <Route path="/admin/usuarios/:id" element={<AdminUsuarioForm />} />

      <Route
        path="/admin/maquinas"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <AdminMaquinas />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/maquinas/nueva"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <AdminMaquinaForm />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/maquinas/:id"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <AdminMaquinaForm />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
