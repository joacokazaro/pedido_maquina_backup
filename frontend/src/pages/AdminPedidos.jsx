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
        ELIMINAR PEDIDO
  ============================ */
  async function eliminarPedido(id) {
    const ok = window.confirm(
      `⚠️ ¿Eliminar definitivamente el pedido ${id}?\n\nEsta acción NO se puede deshacer.`
    );
    if (!ok) return;

    try {
      const res = await fetch(`${API_BASE}/admin/pedidos/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error eliminando pedido");
      }

      setPedidos(prev => prev.filter(p => p.id !== id));
    } catch (e) {
      alert(e.message || "Error eliminando pedido");
    }
  }

  /* ============================
        FALTANTES
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
        FILTRAR PEDIDOS
  ============================ */
  function filtrarPedidos() {
    return pedidos.filter(p => {
      const texto = search.toLowerCase();
      const faltantes = tieneFaltantes(p);

      /* ---- filtro por estado ---- */
      let coincideEstado = true;

      if (estadoFiltro === "TODOS") {
        coincideEstado = true;
      } else if (estadoFiltro === "CERRADO") {
        coincideEstado = p.estado === "CERRADO" && !faltantes;
      } else if (estadoFiltro === "CERRADO_CON_FALTANTES") {
        coincideEstado = p.estado === "CERRADO" && faltantes;
      } else {
        coincideEstado = p.estado === estadoFiltro;
      }

      if (!coincideEstado) return false;

      /* ---- búsqueda básica ---- */
      const coincideBasico =
        p.id.toLowerCase().includes(texto) ||
        (p.supervisorName || p.supervisor || "")
          .toLowerCase()
          .includes(texto) ||
        (p.servicio?.nombre || "")
          .toLowerCase()
          .includes(texto);

      /* ---- máquinas asignadas ---- */
      const coincideAsignadas = (p.asignadas || []).some(a => {
        const m = a.maquina || a;
        return (
          (m.id || "").toLowerCase().includes(texto) ||
          (m.tipo || "").toLowerCase().includes(texto) ||
          (m.modelo || "").toLowerCase().includes(texto) ||
          (m.serie || "").toLowerCase().includes(texto)
        );
      });

      /* ---- máquinas en historial ---- */
      const coincideHistorial = (p.historial || []).some(h => {
        const d = h.detalle || {};
        const listas = [
          d.devueltas,
          d.faltantes,
          d.devueltasConfirmadas,
          d.faltantesConfirmados,
          d.devueltasDeclaradas,
          d.asignadoPorTipo && Object.keys(d.asignadoPorTipo),
        ]
          .flat()
          .filter(Boolean);

        return listas.some(x =>
          String(x).toLowerCase().includes(texto)
        );
      });

      return coincideBasico || coincideAsignadas || coincideHistorial;
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
    "CERRADO",
    "CERRADO_CON_FALTANTES",
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
        ← Volver
      </button>

      <h1 className="text-2xl font-bold mb-4">Gestión de Pedidos</h1>

      {/* FILTROS */}
      <div className="space-y-3 mb-4">
        <input
          className="w-full p-3 rounded-xl border border-gray-300"
          placeholder="Buscar por código, supervisor, servicio o máquina..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <select
          className="w-full p-3 rounded-xl border border-gray-300 bg-white"
          value={estadoFiltro}
          onChange={e => setEstadoFiltro(e.target.value)}
        >
          {estados.map(e => (
            <option key={e} value={e}>
              {e.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>

      {/* LISTA */}
      <div className="space-y-3">
        {filtrarPedidos().map(p => (
          <div
            key={p.id}
            className="bg-white shadow p-4 rounded-xl hover:shadow-md transition"
          >
            <div className="flex justify-between items-center gap-2">
              <span className="font-bold">{p.id}</span>

              <div className="flex items-center gap-2">
                {tieneFaltantes(p) && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                    ⚠ Con faltantes
                  </span>
                )}

                <span className="text-xs px-3 py-1 rounded-full bg-gray-200">
                  {p.estado.replaceAll("_", " ")}
                </span>

                <button
                  onClick={() => eliminarPedido(p.id)}
                  className="ml-2 px-2 py-1 text-xs rounded-md bg-red-100 text-red-700 hover:bg-red-200"
                >
                  Eliminar
                </button>
              </div>
            </div>

            <div
              className="cursor-pointer"
              onClick={() => navigate(`/admin/pedido/${p.id}`)}
            >
              <p className="text-gray-600 text-sm mt-1">
                Supervisor: <b>{p.supervisorName ?? "—"}</b>
              </p>

              {p.servicio && (
                <p className="text-sm text-gray-800 mt-1">
                  Servicio: <b>{p.servicio.nombre}</b>
                </p>
              )}

              <p className="text-xs text-gray-500 mt-1">
                Ítems solicitados: {p.itemsSolicitados.length}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
