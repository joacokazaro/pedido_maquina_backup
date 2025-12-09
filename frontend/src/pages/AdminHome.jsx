import { useNavigate } from "react-router-dom";

export default function AdminHome() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Panel de administración</h1>
        <p className="text-sm text-gray-600 mt-1">
          Gestioná el parque de máquinas, pedidos y tené visibilidad del stock.
        </p>
      </header>

      <div className="space-y-4">

        {/* --- MÁQUINAS --- */}
        <section className="bg-white rounded-2xl shadow p-4">
          <h2 className="text-lg font-semibold mb-2">Máquinas</h2>
          <p className="text-sm text-gray-600 mb-4">
            Alta, baja, edición y estados del inventario de máquinas.
          </p>

          <button
            onClick={() => navigate("/admin/maquinas")}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold"
          >
            Gestionar máquinas
          </button>
        </section>

        {/* --- PEDIDOS --- */}
        <section className="bg-white rounded-2xl shadow p-4">
          <h2 className="text-lg font-semibold mb-2">Pedidos</h2>
          <p className="text-sm text-gray-600 mb-4">
            Visualizar y auditar todos los pedidos del sistema.
            Cambiar estado y ver historial.
          </p>

          <button
            onClick={() => navigate("/admin/pedidos")}
            className="w-full bg-purple-600 text-white py-3 rounded-xl font-semibold"
          >
            Gestionar pedidos
          </button>
        </section>

        {/* --- USUARIOS (futuro) --- */}
        <section className="bg-white rounded-2xl shadow p-4 opacity-60">
          <h2 className="text-lg font-semibold mb-1">Usuarios (futuro)</h2>
          <p className="text-xs text-gray-500">
            Alta y roles de usuarios.
          </p>
        </section>

      </div>
    </div>
  );
}
