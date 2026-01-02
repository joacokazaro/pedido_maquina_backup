import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API_BASE } from "../services/apiBase";
import HistorialPedido from "../components/HistorialPedido";


export default function AdminViewPedido() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [pedido, setPedido] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* ============================
        CARGAR PEDIDO
  ============================ */
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/pedidos/${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error("No se pudo cargar el pedido");

        const data = await res.json();
        setPedido(data);
      } catch (err) {
        console.error(err);
        setError("Error cargando el pedido");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return <div className="p-6">Cargando pedido…</div>;
  }

  if (error || !pedido) {
    return <div className="p-6 text-red-500">{error || "Pedido no encontrado"}</div>;
  }

  /* ============================
        HELPERS
  ============================ */
  function estadoLabel(estado) {
    return estado.replaceAll("_", " ");
  }

  /* ============================
        RENDER
  ============================ */
  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">

      {/* VOLVER */}
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-2 px-3 py-2 rounded-lg
                   bg-white border border-gray-200 shadow-sm hover:shadow
                   text-gray-700 text-sm font-medium"
      >
        <span className="text-lg">←</span> Volver
      </button>

      {/* HEADER */}
<h1 className="text-2xl font-bold mb-1">Pedido {pedido.id}</h1>

<div className="text-sm text-gray-600 mb-2 space-y-1">
  <p>
    Solicitante:{" "}
    <b>{pedido.supervisorName ?? pedido.supervisor ?? "—"}</b>
  </p>
  <p>
      Titular: <b>{pedido.titular ?? "—"}</b>
  </p>
</div>


      <span className="inline-block px-4 py-1.5 rounded-full bg-gray-200 text-gray-800 text-sm font-semibold mb-4">
        {estadoLabel(pedido.estado)}
      </span>

      {/* SERVICIO */}
      {pedido.servicio && (
        <div className="bg-white rounded-xl shadow p-4 mb-4 border-l-4 border-green-500">
          <h2 className="text-lg font-semibold mb-1">Servicio</h2>
          <p className="text-sm text-gray-700">{pedido.servicio}</p>
        </div>
      )}

      {/* OBSERVACIÓN SUPERVISOR */}
      {pedido.observacion && (
        <div className="bg-white rounded-xl shadow p-4 mb-4 border-l-4 border-blue-500">
          <h2 className="text-lg font-semibold mb-1">Observación inicial</h2>
          <p className="text-sm text-gray-700 whitespace-pre-line">
            {pedido.observacion}
          </p>
        </div>
      )}

      {/* ============================
          MÁQUINAS SOLICITADAS
      ============================ */}
      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <h2 className="text-lg font-semibold mb-2">Máquinas solicitadas</h2>

        {(pedido.itemsSolicitados || []).length === 0 ? (
          <p className="text-sm text-gray-500">No hay máquinas solicitadas.</p>
        ) : (
          pedido.itemsSolicitados.map((i, idx) => (
            <div
              key={idx}
              className="flex justify-between bg-gray-50 px-3 py-2 rounded-lg text-sm mb-1"
            >
              <span>{i.tipo}</span>
              <span className="font-bold">{i.cantidad}</span>
            </div>
          ))
        )}
      </div>

      {/* ============================
          MÁQUINAS ASIGNADAS
      ============================ */}
      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <h2 className="text-lg font-semibold mb-2">Máquinas asignadas</h2>

        {(pedido.itemsAsignados || []).length === 0 ? (
          <p className="text-sm text-gray-500">No hay máquinas asignadas.</p>
        ) : (
          pedido.itemsAsignados.map((m, idx) => (
            <div key={idx} className="bg-gray-50 px-3 py-2 rounded-lg text-sm mb-1">
              <p className="font-semibold">
                {m.tipo} — {m.id}
              </p>
              <p className="text-xs text-gray-600">{m.modelo}</p>
              {m.serie && (
                <p className="text-xs text-gray-500">Serie: {m.serie}</p>
              )}
            </div>
          ))
        )}
      </div>
      <HistorialPedido historial={pedido.historial} />
    </div>
  );
}
