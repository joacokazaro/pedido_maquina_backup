import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API_BASE } from "../services/apiBase";
import { useAuth } from "../context/AuthContext";

export default function ConfirmarDevolucion() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

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

      if (data.estado === "PENDIENTE_CONFIRMACION") {
        const reg = [...data.historial]
          .reverse()
          .find((h) => h.accion === "DEVOLUCION_REGISTRADA");

        declaradas = reg?.detalle?.devueltas || [];
      }

      if (data.estado === "PENDIENTE_CONFIRMACION_FALTANTES") {
        const reg = [...data.historial]
          .reverse()
          .find((h) => h.accion === "FALTANTES_DECLARADOS");

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
    setSeleccion((prev) =>
      prev.includes(idMaq)
        ? prev.filter((x) => x !== idMaq)
        : [...prev, idMaq]
    );
  }

  function volverAlListado() {
    if (user.rol === "DEPOSITO") {
      navigate("/deposito");
    } else {
      navigate("/supervisor/prestamos");
    }
  }

  async function confirmar() {
    const todas = asignadas.map((m) => m.id);
    const faltantesConfirmados = todas.filter(
      (idMaq) => !seleccion.includes(idMaq)
    );

    await fetch(`${API_BASE}/pedidos/${id}/confirmar-devolucion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usuario: user.username,
        devueltas: seleccion,
        faltantes: faltantesConfirmados,
        observacion: observacion.trim() || null,
      }),
    });

    volverAlListado();
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">

      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-2 px-3 py-2 rounded-lg
                   bg-white border border-gray-200 shadow-sm
                   text-gray-700 text-sm font-medium"
      >
        ← Volver
      </button>

      <h1 className="text-2xl font-bold mb-4">Confirmar devolución</h1>

      <div className="bg-white rounded-xl shadow p-4 mb-4 space-y-3">
        {asignadas.map((m) => {
          const checked = seleccion.includes(m.id);
          return (
            <label
              key={m.id}
              className={`flex justify-between items-center p-3 rounded-lg border cursor-pointer
                ${
                  checked
                    ? "bg-green-50 border-green-400"
                    : "bg-red-50 border-red-300"
                }`}
            >
              <div>
                <p className="font-semibold">
                  {m.tipo} — {m.id}
                </p>
                <p className="text-xs text-gray-600">{m.modelo}</p>
              </div>

              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(m.id)}
                className="w-5 h-5"
              />
            </label>
          );
        })}
      </div>

      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <label className="block text-sm font-semibold mb-1">
          Observación (opcional)
        </label>
        <textarea
          className="w-full p-3 border rounded-xl text-sm"
          rows="3"
          value={observacion}
          onChange={(e) => setObservacion(e.target.value)}
        />
      </div>

      <button
        onClick={confirmar}
        className="w-full bg-orange-600 text-white py-3 rounded-xl font-semibold"
      >
        Confirmar devolución
      </button>
    </div>
  );
}
