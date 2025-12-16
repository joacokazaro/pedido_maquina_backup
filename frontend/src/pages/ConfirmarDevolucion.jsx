import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API_BASE } from "../services/apiBase";

export default function ConfirmarDevolucion() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [pedido, setPedido] = useState(null);
  const [loading, setLoading] = useState(true);
  const [observacion, setObservacion] = useState("");
  const [seleccion, setSeleccion] = useState([]);

  useEffect(() => {
    async function load() {
      const res = await fetch(`${API_BASE}/pedidos/${id}`);
      const data = await res.json();
      setPedido(data);

      let declaradas = [];

      // ================================
      // CASO 1: devolución normal
      // ================================
      if (data.estado === "PENDIENTE_CONFIRMACION") {
        const reg = [...data.historial]
          .reverse()
          .find(h => h.accion === "DEVOLUCION_REGISTRADA");

        declaradas = reg?.detalle?.devueltas || [];
      }

      // ================================
      // CASO 2: faltantes completados
      // ================================
      if (data.estado === "PENDIENTE_CONFIRMACION_FALTANTES") {
        const reg = [...data.historial]
          .reverse()
          .find(h => h.accion === "FALTANTES_DECLARADOS");

        declaradas = reg?.detalle?.devueltasDeclaradas || [];
      }

      setSeleccion(declaradas);
      setLoading(false);
    }

    load();
  }, [id]);

  if (loading || !pedido) {
    return <div className="p-6">Cargando información...</div>;
  }

  const asignadas = pedido.itemsAsignados || [];

  function toggle(idMaq) {
    if (!seleccion.includes(idMaq)) {
      setSeleccion([...seleccion, idMaq]);
    } else {
      setSeleccion(seleccion.filter(x => x !== idMaq));
    }
  }

  async function confirmar() {
    const todas = asignadas.map(m => m.id);
    const faltantesConfirmados = todas.filter(idMaq => !seleccion.includes(idMaq));

    await fetch(`${API_BASE}/pedidos/${id}/confirmar-devolucion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usuario: "deposito",
        devueltas: seleccion,
        faltantes: faltantesConfirmados,
        observacion: observacion.trim() || null
      }),
    });

    navigate("/deposito");
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">

      {/* Volver */}
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-2 px-3 py-2 rounded-lg
                   bg-white border border-gray-200 shadow-sm hover:shadow
                   text-gray-700 text-sm font-medium"
      >
        <span className="text-lg">←</span> Volver
      </button>

      <h1 className="text-2xl font-bold mb-4">Confirmar devolución</h1>

      {/* Checklist */}
      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <h2 className="text-lg font-semibold mb-2">Checklist de devolución</h2>

        <div className="space-y-3">
          {asignadas.map(m => {
            const checked = seleccion.includes(m.id);

            const cardColor = checked
              ? "bg-green-50 border-green-400"
              : "bg-red-50 border-red-300";

            return (
              <label
                key={m.id}
                className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer border ${cardColor}`}
              >
                <div>
                  <p className="font-semibold">{m.tipo} — {m.id}</p>
                  <p className="text-xs text-gray-600">{m.modelo}</p>
                </div>

                <input
                  type="checkbox"
                  className="w-5 h-5"
                  checked={checked}
                  onChange={() => toggle(m.id)}
                />
              </label>
            );
          })}
        </div>
      </div>

      {/* Observación */}
      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <label className="text-sm font-semibold mb-1 block">
          Observación (opcional)
        </label>
        <textarea
          className="w-full p-3 border rounded-xl text-sm"
          rows="3"
          placeholder="Agregar nota…"
          value={observacion}
          onChange={e => setObservacion(e.target.value)}
        />
      </div>

      <button
        onClick={confirmar}
        className="w-full bg-orange-600 text-white py-3 rounded-xl font-semibold shadow hover:bg-orange-700 transition"
      >
        Confirmar devolución
      </button>
    </div>
  );
}
