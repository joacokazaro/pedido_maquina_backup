// src/App.jsx
import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";

import { waitForBackend } from "./services/waitForBackend";

import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";

// =============================
// SUPERVISOR
// =============================
import SupervisorHome from "./pages/SupervisorHome";
import CreatePedido from "./pages/CreatePedido";
import ViewPedido from "./pages/ViewPedido";
import RegistrarDevolucion from "./pages/RegistrarDevolucion";

// =============================
// DEPÓSITO
// =============================
import DepositoHome from "./pages/DepositoHome";
import DepositoPedido from "./pages/DepositoPedido";
import AsignarMaquinas from "./pages/AsignarMaquinas";
import ConfirmarDevolucion from "./pages/ConfirmarDevolucion";

// =============================
// ADMIN
// =============================
import AdminHome from "./pages/AdminHome";
import AdminUsuarios from "./pages/AdminUsuarios";
import AdminUsuarioForm from "./pages/AdminUsuarioForm";
import AdminPedidos from "./pages/AdminPedidos";
import AdminMaquinas from "./pages/AdminMaquinas";
import AdminMaquinaForm from "./pages/AdminMaquinaForm";
import AdminViewPedido from "./pages/AdminViewPedido";

function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  async function boot() {
    setReady(false);
    setError("");

    try {
      await waitForBackend({
        retries: 12,      // ~30 segundos total
        delayMs: 2500,
      });
      setReady(true);
    } catch (e) {
      setError(
        "El servidor se está iniciando (Render). Puede tardar unos segundos."
      );
    }
  }

  useEffect(() => {
    boot();
  }, []);

  // =============================
  // PANTALLA DE ESPERA (GATE)
  // =============================
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-sm rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
          <p className="text-gray-900 font-semibold">
            Iniciando aplicación…
          </p>

          <p className="text-gray-600 text-sm mt-2">
            {error || "Despertando el backend. Esto puede tardar unos segundos."}
          </p>

          <div className="mt-4 flex gap-2">
            <button
              onClick={boot}
              className="px-4 py-2 rounded-lg bg-black text-white text-sm font-medium"
            >
              Reintentar
            </button>

            <a
              href={import.meta.env.VITE_API_URL}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800 text-sm font-medium"
            >
              Abrir backend
            </a>
          </div>
        </div>
      </div>
    );
  }

  // =============================
  // APP REAL (ROUTES)
  // =============================
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

      <Route path="/admin/pedido/:id" element={<AdminViewPedido />} />

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
