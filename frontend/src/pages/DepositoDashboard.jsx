import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function DepositoDashboard() {
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
        Panel de Depósito
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-3xl">
        <Link
          to="/deposito/maquinas"
          className="bg-white rounded-2xl shadow p-8 hover:shadow-lg transition border border-gray-200 flex flex-col items-center text-center"
        >
          <span className="text-5xl mb-4">🛠</span>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Mis máquinas
          </h2>
          <p className="text-gray-500 text-sm">
            Revisá tus máquinas y dónde están asignadas si fueron prestadas.
          </p>
        </Link>

        <Link
          to="/deposito/pedidos"
          className="bg-white rounded-2xl shadow p-8 hover:shadow-lg transition border border-gray-200 flex flex-col items-center text-center"
        >
          <span className="text-5xl mb-4">🧾</span>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Pedidos a gestionar
          </h2>
          <p className="text-gray-500 text-sm">
            Accedé al listado operativo para preparar, entregar y confirmar devoluciones.
          </p>
        </Link>
      </div>
    </div>
  );
}