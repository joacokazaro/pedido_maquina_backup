import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API_BASE } from "../services/apiBase";
import HistorialPedido from "../components/HistorialPedido";

export default function ViewPedido() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [pedido, setPedido] = useState(null);
  const [faltantes, setFaltantes] = useState([]);
  const [seleccion, setSeleccion] = useState([]);
  const [enviando, setEnviando] = useState(false);

  const usuario =
    localStorage.getItem("username") || "supervisor";

  useEffect(() => {
    cargarPedido();
  }, [id]);

  async function cargarPedido() {
    const res = await fetch(`${API_BASE}/pedidos/${id}`);
    const data = await res.json();
    setPedido(data);

    const confirmacion = [...(data.historial || [])]
      .reverse()
      .find(h => h.accion === "DEVOLUCION_CONFIRMADA");

    const faltantesConfirmados =
      confirmacion?.detalle?.faltantesConfirmados || [];

    setFaltantes(faltantesConfirmados);
    setSeleccion(faltantesConfirmados);
  }

  if (!pedido) return <div className="p-4">Cargando...</div>;

  const puedeCompletarFaltantes =
    pedido.estado === "CERRADO" && faltantes.length > 0;

  function toggle(idMaq) {
    setSeleccion(prev =>
      prev.includes(idMaq)
        ? prev.filter(x => x !== idMaq)
        : [...prev, idMaq]
    );
  }

  async function completarEntrega() {
    if (seleccion.length === 0) return;

    setEnviando(true);

    await fetch(`${API_BASE}/pedidos/${id}/completar-faltantes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario, devueltas: seleccion })
    });

    await cargarPedido();
    setEnviando(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">

      <button onClick={() => navigate(-1)} className="mb-4 px-3 py-2 bg-white border rounded-lg">
        ← Volver
      </button>

      <h1 className="text-2xl font-bold mb-3">Pedido {pedido.id}</h1>

      <span className="px-4 py-1.5 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold">
        {pedido.estado.replaceAll("_", " ")}
      </span>

      {pedido.servicio && (
        <div className="bg-white p-4 my-4 border-l-4 border-green-500 rounded-xl shadow">
          <h2 className="font-semibold">Servicio</h2>
          <p>{pedido.servicio}</p>
        </div>
      )}

      {pedido.observacion && (
        <div className="bg-white p-4 mb-4 border-l-4 border-blue-500 rounded-xl shadow">
          <h2 className="font-semibold">Observación del supervisor</h2>
          <p className="whitespace-pre-line">{pedido.observacion}</p>
        </div>
      )}

      {/* SOLICITADAS */}
      <div className="bg-white p-4 mb-4 rounded-xl shadow">
        <h2 className="font-semibold mb-2">Máquinas solicitadas</h2>
        {pedido.itemsSolicitados.map((i, idx) => (
          <div key={idx} className="flex justify-between bg-gray-50 p-2 rounded">
            <span>{i.tipo}</span>
            <b>{i.cantidad}</b>
          </div>
        ))}
      </div>

      {/* ASIGNADAS */}
      <div className="bg-white p-4 mb-4 rounded-xl shadow">
        <h2 className="font-semibold mb-2">Máquinas asignadas</h2>
        {pedido.itemsAsignados.map((m, idx) => (
          <div key={idx} className="bg-gray-50 p-2 rounded mb-1">
            <b>{m.tipo} — {m.id}</b>
            <div className="text-xs text-gray-600">{m.modelo}</div>
          </div>
        ))}
      </div>

      {/* COMPLETAR FALTANTES */}
      {puedeCompletarFaltantes && (
        <div className="bg-white p-4 mb-4 border-l-4 border-red-500 rounded-xl shadow">
          <h2 className="font-semibold mb-2">⚠ Faltantes pendientes</h2>

          {faltantes.map(idMaq => (
            <label key={idMaq} className="flex justify-between bg-gray-50 p-2 rounded mb-2">
              <span>{idMaq}</span>
              <input
                type="checkbox"
                checked={seleccion.includes(idMaq)}
                onChange={() => toggle(idMaq)}
              />
            </label>
          ))}

          <button
            disabled={enviando}
            onClick={completarEntrega}
            className="w-full bg-green-600 text-white py-3 rounded-xl mt-2"
          >
            {enviando ? "Guardando..." : "Completar entrega"}
          </button>
        </div>
      )}

      {/* ✅ HISTORIAL UNIFICADO */}
      <HistorialPedido historial={pedido.historial} />

      {pedido.estado === "ENTREGADO" && (
        <button
          onClick={() => navigate(`/supervisor/pedido/${id}/devolucion`)}
          className="w-full bg-green-600 text-white py-3 rounded-xl"
        >
          Registrar devolución
        </button>
      )}
    </div>
  );
}
