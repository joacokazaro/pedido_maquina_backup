import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import SupervisorHome from "./pages/SupervisorHome";
import DepositoHome from "./pages/DepositoHome";
import AdminHome from "./pages/AdminHome";
import ProtectedRoute from "./components/ProtectedRoute";
import CreatePedido from "./pages/CreatePedido";
import ViewPedido from "./pages/ViewPedido";
import RegistrarDevolucion from "./pages/RegistrarDevolucion";
import DepositoPedido from "./pages/DepositoPedido";
import AsignarMaquinas from "./pages/AsignarMaquinas"; 
import AdminPedidos from "./pages/AdminPedidos";


// NUEVOS IMPORTS ADMIN
import AdminMaquinas from "./pages/AdminMaquinas";
import AdminMaquinaForm from "./pages/AdminMaquinaForm";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />

      {/* SUPERVISOR */}
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
      <Route path="/admin/pedidos" element={<AdminPedidos />} />

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

      {/* DEPÓSITO */}
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

      {/* ADMIN */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <AdminHome />
          </ProtectedRoute>
        }
      />

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
