import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import { API_BASE } from "../services/apiBase";

export default function SupervisorHome() {
  const { user } = useAuth();

  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("TODOS");

  /* =========================
     CARGA DE PEDIDOS
  ========================== */
  useEffect(() => {
    if (!user || !user.username) return;

    const controller = new AbortController();

    async function cargarPedidos() {
      try {
        setLoading(true);

        const url = `${API_BASE}
/pedidos/supervisor/${encodeURIComponent(
          user.username
        )}`;

        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error("Error al cargar pedidos");

        const data = await res.json();
        const pedidosArray = Array.isArray(data)
          ? data
          : data.pedidos || [];

        setPedidos(pedidosArray);
      } catch (err) {
        console.error("[SupervisorHome] Error:", err);
        setPedidos([]);
      } finally {
        setLoading(false);
      }
    }

    cargarPedidos();
    return () => controller.abort();
  }, [user]);

  /* =========================
     HELPERS
  ========================== */

  function getEstadoLabel(estado) {
    switch (estado) {
      case "PENDIENTE_PREPARACION":
        return "Pendiente de preparación";
      case "PREPARADO":
        return "Preparado";
      case "ENTREGADO":
        return "Entregado";
      case "PENDIENTE_CONFIRMACION":
        return "Pend. confirmación";
      case "CERRADO":
        return "Cerrado";
      default:
        return estado;
    }
  }

  function getEstadoClasses(estado) {
    switch (estado) {
      case "PENDIENTE_PREPARACION":
        return "bg-yellow-100 text-yellow-700";
      case "PREPARADO":
        return "bg-blue-100 text-blue-700";
      case "ENTREGADO":
        return "bg-green-100 text-green-700";
      case "PENDIENTE_CONFIRMACION":
        return "bg-orange-100 text-orange-700";
      case "CERRADO":
        return "bg-gray-300 text-gray-800";
      default:
        return "bg-gray-200 text-gray-700";
    }
  }

  function tieneFaltantes(pedido) {
    if (pedido.estado !== "CERRADO") return false;

    const confirmacion = [...(pedido.historial || [])]
      .reverse()
      .find((h) => h.accion === "DEVOLUCION_CONFIRMADA");

    const faltantes =
      confirmacion?.detalle?.faltantesConfirmados || [];

    return faltantes.length > 0;
  }

  /* =========================
     FILTROS (MISMA PALETA QUE DEPÓSITO)
  ========================== */
  const filtros = [
    { label: "Todos", value: "TODOS", color: "bg-gray-200 text-gray-700" },
    { label: "Pendientes", value: "PENDIENTE_PREPARACION", color: "bg-yellow-500 text-white" },
    { label: "Preparados", value: "PREPARADO", color: "bg-blue-500 text-white" },
    { label: "Entregados", value: "ENTREGADO", color: "bg-green-500 text-white" },
    { label: "Pend. Confirmación", value: "PENDIENTE_CONFIRMACION", color: "bg-orange-500 text-white" },
    { label: "Cerrados", value: "CERRADO", color: "bg-gray-700 text-white" },
  ];

  const pedidosFiltrados = pedidos.filter((p) => {
    if (filtro === "TODOS") return true;
    return p.estado === filtro;
  });

  /* =========================
     RENDER
  ========================== */

  if (!user || !user.username) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Cargando usuario…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center px-4 py-10">

      {/* TÍTULO */}
      <h1 className="text-3xl font-extrabold text-gray-800 mb-6 text-center">
        Mis Pedidos
      </h1>

      {/* CREAR PEDIDO */}
      <Link
        to="/supervisor/pedido/nuevo"
        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg shadow font-semibold transition"
      >
        Crear nuevo pedido
      </Link>

      {/* FILTROS */}
      <div className="flex flex-wrap justify-center gap-2 mt-6 mb-6">
        {filtros.map((f) => (
          <button
            key={f.value}
            onClick={() => setFiltro(f.value)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition 
              ${
                filtro === f.value
                  ? f.color
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* LISTA */}
      <div className="w-full max-w-xl space-y-4">
        {loading && (
          <p className="text-gray-500 text-center text-sm">
            Cargando pedidos…
          </p>
        )}

        {!loading && pedidosFiltrados.length === 0 && (
          <p className="text-gray-500 text-center text-sm mt-4">
            No hay pedidos en esta categoría.
          </p>
        )}

        {!loading &&
          pedidosFiltrados.map((p) => (
            <Link
              key={p.id}
              to={`/supervisor/pedido/${p.id}`}
              className="block bg-white p-5 rounded-xl shadow hover:shadow-lg transition border border-gray-200"
            >
              <div className="flex justify-between items-center mb-1 gap-2">
                <span className="text-gray-700 font-semibold text-lg">
                  Pedido #{p.id}
                </span>

                <div className="flex items-center gap-2">
                  {tieneFaltantes(p) && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                      ⚠ Con faltantes
                    </span>
                  )}

                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${getEstadoClasses(
                      p.estado
                    )}`}
                  >
                    {getEstadoLabel(p.estado)}
                  </span>
                </div>
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
