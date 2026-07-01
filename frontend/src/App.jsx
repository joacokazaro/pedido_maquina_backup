// src/App.jsx
import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import { waitForBackend } from "./services/waitForBackend";

import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import ConsultorHome from "./pages/ConsultorHome";
import TallerHome from "./pages/TallerHome";
import TallerModuleHome from "./pages/taller/TallerModuleHome";
import TallerMovimientosMaquinas from "./pages/taller/TallerMovimientosMaquinas";
import TallerMovimientosVehiculos from "./pages/taller/TallerMovimientosVehiculos";
import TallerVerMaquinas from "./pages/taller/TallerVerMaquinas";
import TallerVerVehiculos from "./pages/taller/TallerVerVehiculos";
import TallerRegistrarHome from "./pages/taller/TallerRegistrarHome";
import TallerVerHome from "./pages/taller/TallerVerHome";

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
import AdminAmortizacionesPanel from "./pages/AdminAmortizacionesPanel";
import AdminMaquinaForm from "./pages/AdminMaquinaForm";
import AdminMaquinaHistorial from "./pages/AdminMaquinaHistorial";
import AdminTiposMaquina from "./pages/AdminTiposMaquina";
import AdminPlazosAmortizacion from "./pages/AdminPlazosAmortizacion";
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

  const renderInventarioTallerPage = (page) => (
    <ProtectedRoute allowedRoles={["ADMIN", "COORDINADOR", "CONSULTOR", "TALLER"]}>
      <AdminLayout>{page}</AdminLayout>
    </ProtectedRoute>
  );

  const renderAdminConsultorPage = (page) => (
    <ProtectedRoute allowedRoles={["ADMIN", "CONSULTOR"]}>
      <AdminLayout>{page}</AdminLayout>
    </ProtectedRoute>
  );

  const renderDepositoPage = (page) => (
    <ProtectedRoute allowedRoles={["DEPOSITO"]}>
      <AdminLayout>{page}</AdminLayout>
    </ProtectedRoute>
  );

  const renderDepositoOperativoPage = (page) => (
    <ProtectedRoute allowedRoles={ROLES_OPERATIVOS}>
      {String(user?.rol || "").toUpperCase() === "DEPOSITO"
        ? <AdminLayout>{page}</AdminLayout>
        : page}
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
    const id = window.setTimeout(() => {
      boot();
    }, 0);
    return () => window.clearTimeout(id);
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
      {user &&
        location.pathname !== "/" &&
        user.rol !== "ADMIN" &&
        !location.pathname.startsWith("/admin") &&
        !(String(user.rol || "").toUpperCase() === "DEPOSITO" && location.pathname.startsWith("/deposito")) &&
        <Notificaciones />}
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
        element={renderDepositoPage(<DepositoDashboard />)}
      />

      <Route
        path="/deposito/pedidos"
        element={renderDepositoPage(<DepositoHome />)}
      />

      <Route
        path="/deposito/maquinas"
        element={renderDepositoPage(<DepositoMaquinas />)}
      />

      <Route
        path="/deposito/servicios"
        element={renderDepositoPage(<DepositoServicios />)}
      />

      <Route
        path="/deposito/servicios/:id"
        element={renderDepositoPage(<DepositoServicioDetalle />)}
      />

      <Route
        path="/deposito/supervisores"
        element={renderDepositoPage(<DepositoSupervisores />)}
      />

      <Route
        path="/deposito/pedido/:id"
        element={renderDepositoOperativoPage(<DepositoPedido />)}
      />

      <Route
        path="/deposito/pedido/:id/asignar"
        element={renderDepositoOperativoPage(<AsignarMaquinas />)}
      />

      <Route
        path="/deposito/pedido/:id/confirmar"
        element={renderDepositoOperativoPage(<ConfirmarDevolucion />)}
      />

      {/* =============================
                ADMIN
      ============================== */}
      <Route
        path="/admin"
        element={renderInventarioTallerPage(
          String(user?.rol || "").toUpperCase() === "COORDINADOR"
            ? <CoordinadorHome />
            : String(user?.rol || "").toUpperCase() === "CONSULTOR"
              ? <ConsultorHome />
              : String(user?.rol || "").toUpperCase() === "TALLER"
                ? <TallerHome />
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
        element={renderInventarioTallerPage(<AdminMaquinas />)}
      />

      <Route
        path="/admin/maquinas/amortizaciones"
        element={renderReadOnlyModulesPage(<AdminAmortizacionesPanel />)}
      />

      <Route
        path="/admin/maquinas/nueva"
        element={renderAdminOnlyPage(<AdminMaquinaForm />)}
      />

      <Route
        path="/admin/maquinas/tipos"
        element={renderReadOnlyModulesPage(<AdminTiposMaquina />)}
      />

      <Route
        path="/admin/plazos-amortizacion"
        element={renderReadOnlyModulesPage(<AdminPlazosAmortizacion />)}
      />

      <Route
        path="/admin/maquinas/:id/pedidos-historicos"
        element={renderReadOnlyModulesPage(<AdminMaquinaHistorial />)}
      />

      <Route
        path="/admin/maquinas/:id"
        element={renderInventarioTallerPage(<AdminMaquinaForm />)}
      />

      <Route
        path="/admin/vehiculos"
        element={renderInventarioTallerPage(<AdminVehiculos />)}
      />

      <Route
        path="/admin/taller"
        element={renderInventarioTallerPage(<TallerModuleHome />)}
      />

      <Route
        path="/admin/taller/registrar"
        element={renderInventarioTallerPage(<TallerRegistrarHome />)}
      />

      <Route
        path="/admin/taller/registrar/maquinas"
        element={renderInventarioTallerPage(<TallerMovimientosMaquinas />)}
      />

      <Route
        path="/admin/taller/registrar/vehiculos"
        element={renderInventarioTallerPage(<TallerMovimientosVehiculos />)}
      />

      <Route
        path="/admin/taller/ver"
        element={renderInventarioTallerPage(<TallerVerHome />)}
      />

      <Route
        path="/admin/taller/ver/maquinas"
        element={renderInventarioTallerPage(<TallerVerMaquinas />)}
      />

      <Route
        path="/admin/taller/ver/vehiculos"
        element={renderInventarioTallerPage(<TallerVerVehiculos />)}
      />

      <Route path="/admin/taller/movimientos/maquinas" element={<Navigate to="/admin/taller/registrar/maquinas" replace />} />
      <Route path="/admin/taller/movimientos/vehiculos" element={<Navigate to="/admin/taller/registrar/vehiculos" replace />} />
      <Route path="/admin/taller/historial/maquinas" element={<Navigate to="/admin/taller/ver/maquinas" replace />} />
      <Route path="/admin/taller/historial/vehiculos" element={<Navigate to="/admin/taller/ver/vehiculos" replace />} />

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
        element={renderInventarioTallerPage(<AdminVehiculoHistorial />)}
      />

      <Route
        path="/admin/vehiculos/:id"
        element={renderInventarioTallerPage(<AdminVehiculoForm />)}
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
        element={renderBackofficePage(<AdminEventualForm />)}
      />

      <Route
        path="/admin/eventuales/:id/finalizar"
        element={
          <ProtectedRoute allowedRoles={["COORDINADOR"]}>
            <AdminLayout><AdminEventualForm modoFinalizacionCoordinador /></AdminLayout>
          </ProtectedRoute>
        }
      />

      </Routes>
    </>
  );
}

export default App;
