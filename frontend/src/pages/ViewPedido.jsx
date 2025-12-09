// src/pages/ViewPedido.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

export default function ViewPedido() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pedido, setPedido] = useState(null);

  useEffect(() => {
    fetch(`http://localhost:3000/pedidos/${id}`)
      .then(r => r.json())
      .then(setPedido);
  }, [id]);

  if (!pedido) return <div className="p-4">Cargando...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <h1 className="text-2xl font-bold mb-3">Pedido {pedido.id}</h1>

      {/* ESTADO */}
      <div className="mb-4">
        <span className="px-4 py-2 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold">
          {pedido.estado.replace("_", " ")}
        </span>
      </div>

      {/* SOLICITADO */}
      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <h2 className="text-lg font-semibold mb-2">Solicitado</h2>
        {pedido.itemsSolicitados.map((i, idx) => (
          <div key={idx} className="flex justify-between text-sm py-1">
            <span>{i.tipo}</span>
            <span className="font-bold">{i.cantidad}</span>
          </div>
        ))}
      </div>

      {/* ASIGNADO */}
      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <h2 className="text-lg font-semibold mb-2">Máquinas asignadas</h2>

        {pedido.itemsAsignados.length === 0 ? (
          <p className="text-xs text-gray-500">Aún no se asignaron máquinas.</p>
        ) : (
          pedido.itemsAsignados.map((m, idx) => (
            <div key={idx} className="py-1 text-sm">
              <p className="font-semibold">{m.tipo} — {m.id}</p>
              <p className="text-xs text-gray-600">{m.modelo}</p>
            </div>
          ))
        )}
      </div>

      {/* HISTORIAL */}
      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <h2 className="text-lg font-semibold mb-2">Historial</h2>
        {pedido.historial.map((h, idx) => (
          <div key={idx} className="mb-3 text-sm">
            <p className="font-semibold">{h.accion}</p>
            <p className="text-xs text-gray-500">
              {new Date(h.fecha).toLocaleString()}
            </p>
            {h.detalle && (
              <pre className="text-xs bg-gray-100 p-2 rounded mt-1">
                {JSON.stringify(h.detalle, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>

      {/* ACCIÓN: REGISTRAR DEVOLUCIÓN */}
      {pedido.estado === "ENTREGADO" && (
        <button
          className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold shadow"
          onClick={() => navigate(`/supervisor/pedido/${id}/devolucion`)}
        >
          Registrar devolución
        </button>
      )}
    </div>
  );
}
