import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../services/apiBase";




export default function AdminPedidos() {
  const navigate = useNavigate();

  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [estadoFiltro, setEstadoFiltro] = useState("TODOS");
  const [search, setSearch] = useState("");

  /* ============================
        CARGAR PEDIDOS
  ============================ */
  useEffect(() => {
    loadPedidos();
  }, []);

  async function loadPedidos() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/pedidos`);
      const data = await res.json();
      setPedidos(data);
    } catch (err) {
      console.error("Error cargando pedidos:", err);
    }
    setLoading(false);
  }

  /* ============================
        HELPERS
  ============================ */

  function tieneFaltantes(pedido) {
    if (pedido.estado !== "CERRADO") return false;

    const confirmacion = [...(pedido.historial || [])]
      .reverse()
      .find(h => h.accion === "DEVOLUCION_CONFIRMADA");

    const faltantes =
      confirmacion?.detalle?.faltantesConfirmados || [];

    return faltantes.length > 0;
  }

  /* ============================
        FILTRO + BUSCADOR
  ============================ */
  function filtrarPedidos() {
    return pedidos.filter((p) => {
      const coincideEstado =
        estadoFiltro === "TODOS" || p.estado === estadoFiltro;

      const texto = search.toLowerCase();

      const coincideTexto =
        p.id.toLowerCase().includes(texto) ||
        (p.supervisorName || p.supervisor || "").toLowerCase().includes(texto) ||
        (p.servicio || "").toLowerCase().includes(texto);

      return coincideEstado && coincideTexto;
    });
  }

  /* ============================
        ESTADOS
  ============================ */
  const estados = [
    "TODOS",
    "PENDIENTE_PREPARACION",
    "PREPARADO",
    "ENTREGADO",
    "PENDIENTE_CONFIRMACION",
    "CERRADO"
  ];

  if (loading) {
    return <div className="p-6">Cargando pedidos...</div>;
  }

  return (
    <div className="p-4 min-h-screen bg-gray-50 pb-24">

      {/* VOLVER */}
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-2 px-3 py-2 rounded-lg 
                 bg-white border border-gray-200 shadow-sm 
                 hover:shadow transition text-gray-700 text-sm font-medium"
      >
        <span className="text-lg">←</span> Volver
      </button>

      <h1 className="text-2xl font-bold mb-4">Gestión de Pedidos</h1>

      {/* ============================
          FILTROS
      ============================ */}
      <div className="space-y-3 mb-4">
        <input
          className="w-full p-3 rounded-xl border border-gray-300"
          placeholder="Buscar por código, supervisor o servicio..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="w-full p-3 rounded-xl border border-gray-300 bg-white"
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value)}
        >
          {estados.map((e) => (
            <option key={e} value={e}>
              {e.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>

      {/* ============================
          LISTA DE PEDIDOS
      ============================ */}
      <div className="space-y-3">
        {filtrarPedidos().map((p) => (
          <div
            key={p.id}
            className="bg-white shadow p-4 rounded-xl cursor-pointer hover:shadow-md transition"
            onClick={() => navigate(`/admin/pedido/${p.id}`)}
          >
            {/* HEADER */}
            <div className="flex justify-between items-center gap-2">
              <span className="font-bold">{p.id}</span>

              <div className="flex items-center gap-2">
                {tieneFaltantes(p) && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                    ⚠ Con faltantes
                  </span>
                )}

                <span
                  className={`text-xs px-3 py-1 rounded-full ${
                    p.estado === "PENDIENTE_PREPARACION"
                      ? "bg-yellow-100 text-yellow-800"
                      : p.estado === "PREPARADO"
                      ? "bg-blue-100 text-blue-700"
                      : p.estado === "ENTREGADO"
                      ? "bg-green-100 text-green-700"
                      : p.estado === "PENDIENTE_CONFIRMACION"
                      ? "bg-orange-100 text-orange-700"
                      : p.estado === "CERRADO"
                      ? "bg-gray-300 text-gray-800"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {p.estado.replace("_", " ")}
                </span>
              </div>
            </div>

            {/* INFO */}
            <p className="text-gray-600 text-sm mt-1">
              Supervisor:{" "}
              <b>{p.supervisorName ?? p.supervisor ?? "—"}</b>
            </p>

            {p.servicio && (
              <p className="text-sm text-gray-800 mt-1">
                Servicio: <b>{p.servicio}</b>
              </p>
            )}

            <p className="text-xs text-gray-500 mt-1">
              Ítems solicitados: {p.itemsSolicitados.length}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
