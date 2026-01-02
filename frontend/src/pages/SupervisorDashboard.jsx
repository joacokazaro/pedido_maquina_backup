import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function SupervisorDashboard() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Cargando usuario…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center px-4 py-12">
      <h1 className="text-3xl font-extrabold text-gray-800 mb-10 text-center">
        Panel del Supervisor
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-3xl">
        
        {/* MIS PEDIDOS */}
        <Link
          to="/supervisor/pedidos"
          className="bg-white rounded-2xl shadow p-8 hover:shadow-lg transition border border-gray-200 flex flex-col items-center text-center"
        >
          <span className="text-5xl mb-4">🧾</span>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Mis pedidos
          </h2>
          <p className="text-gray-500 text-sm">
            Pedidos que realizaste al depósito o a otros supervisores
          </p>
        </Link>

        {/* MIS PRÉSTAMOS */}
        <Link
          to="/supervisor/prestamos"
          className="bg-white rounded-2xl shadow p-8 hover:shadow-lg transition border border-gray-200 flex flex-col items-center text-center"
        >
          <span className="text-5xl mb-4">🔄</span>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Mis préstamos
          </h2>
          <p className="text-gray-500 text-sm">
            Pedidos que otros supervisores te realizaron
          </p>
        </Link>

      </div>
    </div>
  );
}
