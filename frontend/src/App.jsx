// src/App.jsx
import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import { waitForBackend } from "./services/waitForBackend";

import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import ConsultorHome from "./pages/ConsultorHome";

// =============================
// SUPERVISOR
// =============================
import SupervisorDashboard from "./pages/SupervisorDashboard";
import SupervisorMaquinas from "./pages/SupervisorMaquinas";
import SupervisorVehiculos from "./pages/SupervisorVehiculos";
import SupervisorMaquinaDetalle from "./pages/SupervisorMaquinaDetalle";
import SupervisorMisPedidos from "./pages/SupervisorMisPedidos";
import SupervisorMisPrestamos from "./pages/SupervisorMisPrestamos";
import SupervisorPrestamo from "./pages/SupervisorPrestamo";
import CreatePedido from "./pages/CreatePedido";
import ViewPedido from "./pages/ViewPedido";
import RegistrarDevolucion from "./pages/RegistrarDevolucion";
import AsignarMaquinasPrestamo from "./pages/AsignarMaquinasPrestamo";

// =============================
// DEPÓSITO
// =============================
import DepositoDashboard from "./pages/DepositoDashboard";
import DepositoHome from "./pages/DepositoHome";
import DepositoMaquinas from "./pages/DepositoMaquinas";
import DepositoPedido from "./pages/DepositoPedido";
import DepositoServicios from "./pages/DepositoServicios";
import DepositoServicioDetalle from "./pages/DepositoServicioDetalle";
import DepositoSupervisores from "./pages/DepositoSupervisores";
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
import AdminMaquinaHistorial from "./pages/AdminMaquinaHistorial";
import AdminVehiculos from "./pages/AdminVehiculos";
import AdminVehiculoForm from "./pages/AdminVehiculoForm";
import AdminVehiculoHistorial from "./pages/AdminVehiculoHistorial";
import AdminVehiculosImport from "./pages/AdminVehiculosImport";
import AdminViewPedido from "./pages/AdminViewPedido";
import AdminServicios from "./pages/AdminServicios";
import AdminServicioForm from "./pages/AdminServicioForm";
import AdminSeguros from "./pages/AdminSeguros";
import AdminSupervisoresServicios from "./pages/AdminSupervisoresServicios";
import AdminEventualesPanel from "./pages/AdminEventualesPanel";
import AdminEventualesHistorial from "./pages/AdminEventualesHistorial";
import AdminEventualForm from "./pages/AdminEventualForm";
import AdminEventualDetalle from "./pages/AdminEventualDetalle";
import AdminKits from "./pages/AdminKits";
import AdminKitForm from "./pages/AdminKitForm";
import CoordinadorHome from "./pages/CoordinadorHome";
import SupervisorMisEventuales from "./pages/SupervisorMisEventuales";
import SupervisorEventualDetalle from "./pages/SupervisorEventualDetalle";
import Notificaciones from "./components/Notificaciones";
import AdminLayout from "./layouts/AdminLayout";
import { useAuth } from "./context/AuthContext";

function App() {
  const { user } = useAuth();
  const location = useLocation();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  // 👉 Roles que participan del ciclo OPERATIVO de préstamo
  const ROLES_OPERATIVOS = ["SUPERVISOR", "DEPOSITO"];
  const renderAdminOnlyPage = (page) => (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <AdminLayout>{page}</AdminLayout>
    </ProtectedRoute>
  );

  const renderBackofficePage = (page) => (
    <ProtectedRoute allowedRoles={["ADMIN", "COORDINADOR"]}>
      <AdminLayout>{page}</AdminLayout>
    </ProtectedRoute>
  );

  const renderReadOnlyModulesPage = (page) => (
    <ProtectedRoute allowedRoles={["ADMIN", "COORDINADOR", "CONSULTOR"]}>
      <AdminLayout>{page}</AdminLayout>
    </ProtectedRoute>
  );

  const renderAdminConsultorPage = (page) => (
    <ProtectedRoute allowedRoles={["ADMIN", "CONSULTOR"]}>
      <AdminLayout>{page}</AdminLayout>
    </ProtectedRoute>
  );
  async function boot() {
    setReady(false);
    setError("");

    try {
      await waitForBackend({
        retries: 12,
        delayMs: 2500,
      });
      setReady(true);
    } catch {
      setError(
        "El servidor se está iniciando (Render). Puede tardar unos segundos."
      );
    }
  }

  useEffect(() => {
    boot();
  }, []);

  /* =============================
     PANTALLA DE ESPERA
  ============================== */
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-sm rounded-2xl bg-white border shadow-sm p-5">
          <p className="text-gray-900 font-semibold">
            Iniciando aplicación…
          </p>

          <p className="text-gray-600 text-sm mt-2">
            {error ||
              "Despertando el backend. Esto puede tardar unos segundos."}
          </p>

          <div className="mt-4 flex gap-2">
            <button
              onClick={boot}
              className="px-4 py-2 rounded-lg bg-black text-white text-sm font-medium"
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* =============================
     RUTAS
  ============================== */
  return (
    <>
      {user && location.pathname !== "/" && user.rol !== "ADMIN" && <Notificaciones />}
      <Routes>
      {/* LOGIN */}
      <Route path="/" element={<Login />} />

      {/* =============================
            SUPERVISOR (VISTAS PROPIAS)
      ============================== */}
      <Route
        path="/supervisor"
        element={
          <ProtectedRoute allowedRoles={["SUPERVISOR"]}>
            <SupervisorDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/supervisor/pedidos"
        element={
          <ProtectedRoute allowedRoles={["SUPERVISOR"]}>
            <SupervisorMisPedidos />
          </ProtectedRoute>
        }
      />

      <Route
        path="/supervisor/maquinas"
        element={
          <ProtectedRoute allowedRoles={["SUPERVISOR"]}>
            <SupervisorMaquinas />
          </ProtectedRoute>
        }
      />

      <Route
        path="/supervisor/vehiculos"
        element={
          <ProtectedRoute allowedRoles={["SUPERVISOR"]}>
            <SupervisorVehiculos />
          </ProtectedRoute>
        }
      />

      <Route
        path="/supervisor/maquinas/:id"
        element={
          <ProtectedRoute allowedRoles={["SUPERVISOR"]}>
            <SupervisorMaquinaDetalle />
          </ProtectedRoute>
        }
      />

      <Route
        path="/supervisor/prestamos"
        element={
          <ProtectedRoute allowedRoles={["SUPERVISOR"]}>
            <SupervisorMisPrestamos />
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
        path="/supervisor/eventuales"
        element={
          <ProtectedRoute allowedRoles={["SUPERVISOR"]}>
            <SupervisorMisEventuales />
          </ProtectedRoute>
        }
      />

      <Route
        path="/supervisor/eventuales/:id"
        element={
          <ProtectedRoute allowedRoles={["SUPERVISOR"]}>
            <SupervisorEventualDetalle />
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
            CICLO DE PRÉSTAMO (OPERATIVO)
            SUPERVISOR + DEPÓSITO
      ============================== */}

      <Route
        path="/supervisor/prestamo/:id"
        element={
          <ProtectedRoute allowedRoles={ROLES_OPERATIVOS}>
            <SupervisorPrestamo />
          </ProtectedRoute>
        }
      />

      <Route
        path="/supervisor/prestamo/:id/asignar"
        element={
          <ProtectedRoute allowedRoles={ROLES_OPERATIVOS}>
            <AsignarMaquinasPrestamo />
          </ProtectedRoute>
        }
      />

      <Route
        path="/supervisor/prestamo/:id/confirmar"
        element={
          <ProtectedRoute allowedRoles={ROLES_OPERATIVOS}>
            <ConfirmarDevolucion />
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
            <DepositoDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/deposito/pedidos"
        element={
          <ProtectedRoute allowedRoles={["DEPOSITO"]}>
            <DepositoHome />
          </ProtectedRoute>
        }
      />

      <Route
        path="/deposito/maquinas"
        element={
          <ProtectedRoute allowedRoles={["DEPOSITO"]}>
            <DepositoMaquinas />
          </ProtectedRoute>
        }
      />

      <Route
        path="/deposito/servicios"
        element={
          <ProtectedRoute allowedRoles={["DEPOSITO"]}>
            <DepositoServicios />
          </ProtectedRoute>
        }
      />

      <Route
        path="/deposito/servicios/:id"
        element={
          <ProtectedRoute allowedRoles={["DEPOSITO"]}>
            <DepositoServicioDetalle />
          </ProtectedRoute>
        }
      />

      <Route
        path="/deposito/supervisores"
        element={
          <ProtectedRoute allowedRoles={["DEPOSITO"]}>
            <DepositoSupervisores />
          </ProtectedRoute>
        }
      />

      <Route
        path="/deposito/pedido/:id"
        element={
          <ProtectedRoute allowedRoles={ROLES_OPERATIVOS}>
            <DepositoPedido />
          </ProtectedRoute>
        }
      />

      <Route
        path="/deposito/pedido/:id/asignar"
        element={
          <ProtectedRoute allowedRoles={ROLES_OPERATIVOS}>
            <AsignarMaquinas />
          </ProtectedRoute>
        }
      />

      <Route
        path="/deposito/pedido/:id/confirmar"
        element={
          <ProtectedRoute allowedRoles={ROLES_OPERATIVOS}>
            <ConfirmarDevolucion />
          </ProtectedRoute>
        }
      />

      {/* =============================
                ADMIN
      ============================== */}
      <Route
        path="/admin"
        element={renderReadOnlyModulesPage(
          String(user?.rol || "").toUpperCase() === "COORDINADOR"
            ? <CoordinadorHome />
            : String(user?.rol || "").toUpperCase() === "CONSULTOR"
              ? <ConsultorHome />
              : <AdminHome />
        )}
      />

      <Route
        path="/admin/pedidos"
        element={renderAdminOnlyPage(<AdminPedidos />)}
      />

      <Route
        path="/admin/usuarios"
        element={renderAdminOnlyPage(<AdminUsuarios />)}
      />

      <Route
        path="/admin/usuarios/nuevo"
        element={renderAdminOnlyPage(<AdminUsuarioForm />)}
      />

      <Route
        path="/admin/usuarios/:username"
        element={renderAdminOnlyPage(<AdminUsuarioForm />)}
      />

      <Route
        path="/admin/supervisores"
        element={<Navigate to="/admin/supervisores-servicios" replace />}
      />

      <Route
        path="/admin/supervisores-servicios"
        element={renderAdminConsultorPage(<AdminSupervisoresServicios />)}
      />

      <Route
        path="/admin/maquinas"
        element={renderReadOnlyModulesPage(<AdminMaquinas />)}
      />

      <Route
        path="/admin/maquinas/nueva"
        element={renderAdminOnlyPage(<AdminMaquinaForm />)}
      />

      <Route
        path="/admin/maquinas/:id/pedidos-historicos"
        element={renderReadOnlyModulesPage(<AdminMaquinaHistorial />)}
      />

      <Route
        path="/admin/maquinas/:id"
        element={renderReadOnlyModulesPage(<AdminMaquinaForm />)}
      />

      <Route
        path="/admin/vehiculos"
        element={renderReadOnlyModulesPage(<AdminVehiculos />)}
      />

      <Route
        path="/admin/vehiculos/nuevo"
        element={renderAdminOnlyPage(<AdminVehiculoForm />)}
      />

      <Route
        path="/admin/vehiculos/importar"
        element={renderAdminOnlyPage(<AdminVehiculosImport />)}
      />

      <Route
        path="/admin/vehiculos/:id/historial"
        element={renderReadOnlyModulesPage(<AdminVehiculoHistorial />)}
      />

      <Route
        path="/admin/vehiculos/:id"
        element={renderReadOnlyModulesPage(<AdminVehiculoForm />)}
      />

      <Route
        path="/admin/pedido/:id"
        element={renderAdminOnlyPage(<AdminViewPedido />)}
      />

      <Route
        path="/admin/servicios"
        element={renderAdminConsultorPage(<AdminServicios />)}
      />

      <Route
        path="/admin/servicios/nuevo"
        element={renderAdminOnlyPage(<AdminServicioForm />)}
      />

      <Route
        path="/admin/servicios/:id"
        element={renderAdminConsultorPage(<AdminServicioForm />)}
      />

      <Route
        path="/admin/seguros"
        element={renderAdminOnlyPage(<AdminSeguros />)}
      />

      <Route
        path="/admin/eventuales"
        element={renderReadOnlyModulesPage(<AdminEventualesPanel />)}
      />

      <Route
        path="/admin/eventuales/historial"
        element={renderReadOnlyModulesPage(<AdminEventualesHistorial />)}
      />

      <Route
        path="/admin/eventuales/nuevo"
        element={renderAdminOnlyPage(<AdminEventualForm />)}
      />

      <Route
        path="/admin/eventuales/:id"
        element={renderReadOnlyModulesPage(<AdminEventualDetalle />)}
      />

      <Route
        path="/admin/eventuales/:id/corregir"
        element={renderAdminOnlyPage(<AdminEventualForm />)}
      />

      <Route
        path="/admin/eventuales/:id/finalizar"
        element={
          <ProtectedRoute allowedRoles={["COORDINADOR"]}>
            <AdminLayout><AdminEventualForm modoFinalizacionCoordinador /></AdminLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/kits"
        element={renderReadOnlyModulesPage(<AdminKits />)}
      />

      <Route
        path="/admin/kits/nuevo"
        element={renderAdminOnlyPage(<AdminKitForm />)}
      />

      <Route
        path="/admin/kits/:id"
        element={renderReadOnlyModulesPage(<AdminKitForm />)}
      />
      </Routes>
    </>
  );
}

export default App;
