import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";

export default function SupervisorHome() {
  const { user } = useAuth();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 👇 Si todavía no tenemos user, no pegamos al backend
    if (!user || !user.username) {
      console.log("[SupervisorHome] Esperando usuario...", user);
      return;
    }

    const controller = new AbortController();

    async function cargarPedidos() {
      try {
        setLoading(true);

        const url = `http://localhost:3000/pedidos/supervisor/${encodeURIComponent(
          user.username
        )}`;

        console.log("[SupervisorHome] Fetch a:", url);

        const res = await fetch(url, { signal: controller.signal });

        console.log("[SupervisorHome] Status:", res.status);

        if (!res.ok) {
          throw new Error("Error al cargar pedidos");
        }

        const data = await res.json();
        console.log("[SupervisorHome] Respuesta cruda:", data);

        // Soportamos ambas formas: [ ... ] o { pedidos: [...] }
        const pedidosArray = Array.isArray(data)
          ? data
          : data.pedidos || [];

        console.log("[SupervisorHome] Pedidos seteados:", pedidosArray);

        setPedidos(pedidosArray);
      } catch (err) {
        console.error("[SupervisorHome] Error cargando pedidos:", err);
        setPedidos([]);
      } finally {
        setLoading(false);
      }
    }

    cargarPedidos();

    return () => controller.abort();
  }, [user]); // 👈 importante: depende de user

    console.log("USER DESDE AUTH:", user);

  const getEstadoLabel = (estado) => {
    switch (estado) {
      case "PENDIENTE_PREPARACION":
        return "Pendiente de preparación";
      case "ASIGNADO":
        return "Asignado";
      case "CERRADO":
        return "Cerrado";
      default:
        return estado;
    }
  };

  const getEstadoClasses = (estado) => {
    switch (estado) {
      case "PENDIENTE_PREPARACION":
        return "bg-yellow-100 text-yellow-700";
      case "ASIGNADO":
        return "bg-green-100 text-green-700";
      case "CERRADO":
        return "bg-gray-300 text-gray-800";
      default:
        return "bg-gray-200 text-gray-700";
    }
  };

  // Mientras no tengamos user, evitamos mostrar cualquier cosa rara
  if (!user || !user.username) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Cargando usuario…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center px-4 py-10">
      {/* Título principal */}
      <h1 className="text-3xl font-extrabold text-gray-800 mb-6 text-center">
        Mis Pedidos
      </h1>

      {/* Botón crear pedido */}
      <Link
        to="/supervisor/pedido/nuevo"
        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg shadow font-semibold transition"
      >
        Crear nuevo pedido
      </Link>

      {/* Lista de pedidos */}
      <div className="mt-10 w-full max-w-xl space-y-4">
        {loading && (
          <p className="text-gray-500 text-center text-sm">Cargando pedidos…</p>
        )}

        {!loading && pedidos.length === 0 && (
          <p className="text-gray-500 text-center text-sm mt-4">
            Todavía no realizaste ningún pedido.
          </p>
        )}

        {!loading &&
          pedidos.map((p) => (
            <Link
              key={p.id}
              to={`/supervisor/pedido/${p.id}`}
              className="block bg-white p-5 rounded-xl shadow hover:shadow-lg transition border border-gray-200"
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-gray-700 font-semibold text-lg">
                  Pedido #{p.id}
                </span>

                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${getEstadoClasses(
                    p.estado
                  )}`}
                >
                  {getEstadoLabel(p.estado)}
                </span>
              </div>

              <p className="text-gray-500 text-xs">
                Supervisor:{" "}
                <span className="font-medium">{p.supervisor}</span>
              </p>
            </Link>
          ))}
      </div>
    </div>
  );
}
