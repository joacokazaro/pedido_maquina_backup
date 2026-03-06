import { useEffect, useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import ConfirmModal from "../components/ConfirmModal";
import { EstadoBadge, formatEstado } from "../utils/estadoPedido.jsx";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../services/apiBase";

export default function AdminPedidos() {
  const navigate = useNavigate();

  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [estadoFiltro, setEstadoFiltro] = useState("TODOS");
  const [search, setSearch] = useState("");
  const [pedidoAEliminar, setPedidoAEliminar] = useState(null);
  const [pedidoACancelar, setPedidoACancelar] = useState(null);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const { user } = useAuth();
  const [menuOpenId, setMenuOpenId] = useState(null);


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
  async function eliminarPedido() {
  if (!pedidoAEliminar) return;

  try {
    const res = await fetch(
      `${API_BASE}/admin/pedidos/${pedidoAEliminar.id}`,
      { method: "DELETE" }
    );

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Error eliminando pedido");
    }

    setPedidos(prev =>
      prev.filter(p => p.id !== pedidoAEliminar.id)
    );

    setPedidoAEliminar(null);
  } catch (e) {
    console.error(e);
    setPedidoAEliminar(null);
  }
}

  /* ============================
        FALTANTES
  ============================ */
  /* ============================
        FALTANTES
============================ */
function tieneFaltantes(pedido) {
  return pedido.conFaltantes === true;
}


  /* ============================
      TOTAL ÍTEMS SOLICITADOS
============================ */
/* ============================
      TOTAL ÍTEMS SOLICITADOS
============================ */
function totalItemsSolicitados(pedido) {
  let items = pedido.itemsSolicitados;

  if (!items) return 0;

  // 🟡 Si viene como string JSON
  if (typeof items === "string") {
    try {
      items = JSON.parse(items);
    } catch {
      return 0;
    }
  }

  // 🟢 Caso array [{ tipo, cantidad }]
  if (Array.isArray(items)) {
    return items.reduce(
      (acc, it) => acc + (Number(it.cantidad) || 0),
      0
    );
  }

  // 🔵 Caso objeto { LUSTADORA: 2, CARGADOR: 1 }
  if (typeof items === "object") {
    return Object.values(items).reduce(
      (acc, v) => acc + (Number(v) || 0),
      0
    );
  }

  return 0;
}

function pedidoTieneMaquina(pedido, texto) {
  const t = texto.toLowerCase();

  // 1️⃣ asignadas actuales
  const asignadas = (pedido.asignadas || []).some(a => {
    const m = a.maquina || {};
    return (
      (m.id || "").toLowerCase().includes(t) ||
      (m.serie || "").toLowerCase().includes(t)
    );
  });

  // 2️⃣ historial (todas las variantes)
  const historial = (pedido.historial || []).some(h => {
    const d = h.detalle || {};
    const listas = [
      d.devueltas,
      d.faltantes,
      d.devueltasConfirmadas,
      d.faltantesConfirmados,
      d.devueltasDeclaradas,
    ].flat().filter(Boolean);

    return listas.some(x =>
      String(x).toLowerCase().includes(t)
    );
  });

  return asignadas || historial;
}



  

  /* ============================
        FILTRAR PEDIDOS
  ============================ */
  function filtrarPedidos() {
  const texto = search.toLowerCase();

  return pedidos.filter(p => {
    const conFaltantes = p.conFaltantes === true;

    /* =========================
        FILTRO POR ESTADO
    ========================== */
    let coincideEstado = true;

    if (estadoFiltro === "TODOS") {
      coincideEstado = true;
    } else if (estadoFiltro === "CERRADO") {
      coincideEstado = p.estado === "CERRADO" && !conFaltantes;
    } else if (estadoFiltro === "CERRADO_CON_FALTANTES") {
      coincideEstado = p.estado === "CERRADO" && conFaltantes;
    } else {
      coincideEstado = p.estado === estadoFiltro;
    }

    if (!coincideEstado) return false;

    /* =========================
        BÚSQUEDA BÁSICA
    ========================== */
    const coincideBasico =
      p.id?.toLowerCase().includes(texto) ||
      (p.supervisorName || p.supervisor || "")
        .toLowerCase()
        .includes(texto) ||
      (p.servicio?.nombre || "")
        .toLowerCase()
        .includes(texto);

    /* =========================
        MÁQUINAS ASIGNADAS
    ========================== */
    const coincideAsignadas = (p.asignadas || []).some(a => {
      const m = a.maquina || a;
      return (
        (m.id || "").toLowerCase().includes(texto) ||
        (m.tipo || "").toLowerCase().includes(texto) ||
        (m.modelo || "").toLowerCase().includes(texto) ||
        (m.serie || "").toLowerCase().includes(texto)
      );
    });

    /* =========================
        HISTORIAL (todas)
    ========================== */
    const coincideHistorial = (p.historial || []).some(h => {
      let d = h.detalle;

      // 🟡 parsear JSON si viene como string
      if (typeof d === "string") {
        try {
          d = JSON.parse(d);
        } catch {
          return false;
        }
      }

      if (!d || typeof d !== "object") return false;

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

    /* =========================
        RESULTADO FINAL
    ========================== */
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
    "CANCELADO",
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

      <a
  href={`${API_BASE}/admin/pedidos/export`}
  className="inline-block mb-4 px-4 py-2 rounded-lg
             bg-green-600 text-white text-sm font-semibold
             hover:bg-green-700 transition"
>
  Exportar pedidos (CSV)
</a>


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
              {formatEstado(e)}
            </option>
          ))}
        </select>
      </div>

      {/* LISTA */}
      <div className="space-y-3">
        {filtrarPedidos().map(p => (
          <div
            key={p.id}
            className="bg-white shadow p-4 rounded-xl hover:shadow-md transition relative"
            onClick={() => setMenuOpenId(null)}
          >
            <div className="flex justify-between items-center gap-2">
              <span className="font-bold">{p.id}</span>

              <div className="flex items-center gap-2">
                {tieneFaltantes(p) && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                    ⚠ Con faltantes
                  </span>
                )}

                <EstadoBadge estado={p.estado} />
                {/* 3-dots actions menu */}
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === p.id ? null : p.id); }}
                    className="ml-2 w-9 h-9 flex items-center justify-center rounded-full bg-white border text-gray-600 hover:bg-gray-50"
                    aria-label="Más opciones"
                  >
                    ⋮
                  </button>

                  {menuOpenId === p.id && (
                    <div className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow-lg z-50 ring-1 ring-black ring-opacity-5">
                      <button
                        onClick={() => { setPedidoAEliminar(p); setMenuOpenId(null); }}
                        className="w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50 flex items-center gap-2"
                      >
                        <span>🗑️</span> Eliminar
                      </button>

                      {p.estado !== "CANCELADO" && (
                        <button
                          onClick={() => { setPedidoACancelar(p); setConfirmCancelOpen(true); setMenuOpenId(null); }}
                          className="w-full text-left px-4 py-2 text-sm text-yellow-800 hover:bg-yellow-50 flex items-center gap-2"
                        >
                          <span>🚫</span> Marcar como CANCELADO
                        </button>
                      )}
                    </div>
                  )}
                </div>

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
  Ítems solicitados: {totalItemsSolicitados(p)}
</p>

            </div>
          </div>
        ))}
      </div>

      {pedidoAEliminar && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
      
      <h2 className="text-lg font-bold text-red-600 mb-3">
        ⚠ Eliminar pedido
      </h2>

      <p className="text-sm text-gray-700 mb-4">
        Estás por eliminar <b>{pedidoAEliminar.id}</b>.
      </p>

      <p className="text-sm text-red-600 font-semibold mb-6">
        Esta acción es permanente y no se puede deshacer.
      </p>

      <div className="flex justify-end gap-2">
        <button
          onClick={() => setPedidoAEliminar(null)}
          className="px-4 py-2 rounded-lg border text-gray-700 hover:bg-gray-100"
        >
          Cancelar
        </button>

        <button
          onClick={eliminarPedido}
          className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
        >
          Eliminar
        </button>
      </div>
    </div>
  </div>
)}

      {pedidoACancelar && (
  <ConfirmModal
    open={confirmCancelOpen}
    title={`Aprobar cancelación`}
    message={`¿Confirmás marcar el pedido ${pedidoACancelar.id} como CANCELADO? Esto liberará las máquinas asignadas.`}
    confirmLabel="Marcar CANCELADO"
    cancelLabel="Cancelar"
    onCancel={() => { setConfirmCancelOpen(false); setPedidoACancelar(null); }}
    onConfirm={async () => {
      setConfirmCancelOpen(false);
      try {
        const res = await fetch(`${API_BASE}/admin/pedidos/${pedidoACancelar.id}/aprobar-cancelacion`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ usuario: user?.username }),
        });
        if (!res.ok) throw new Error("Error aprobando cancelación");
      } catch (e) {
        console.error(e);
        alert("Error al marcar como CANCELADO");
      } finally {
        setPedidoACancelar(null);
        loadPedidos();
      }
    }}
  />
)}

    </div>
  );
}
