import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

export default function DepositoPedido() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [pedido, setPedido] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`http://localhost:3000/pedidos/${id}`)
      .then(res => res.json())
      .then(data => {
        setPedido(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Error cargando el pedido");
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div className="p-6">Cargando pedido...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <h1 className="text-2xl font-bold mb-4">Pedido {pedido.id}</h1>

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
          <div key={idx} className="flex justify-between py-1 text-sm">
            <span>{i.tipo}</span>
            <span className="font-bold">{i.cantidad}</span>
          </div>
        ))}
      </div>

      {/* ASIGNADO */}
      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <h2 className="text-lg font-semibold mb-2">Máquinas asignadas</h2>

        {pedido.itemsAsignados.length === 0 && (
          <p className="text-sm text-gray-500">Aún no se asignaron máquinas.</p>
        )}

        {pedido.itemsAsignados.map((m, idx) => (
          <div key={idx} className="py-1 text-sm">
            <div className="flex justify-between">
              <span>{m.tipo} — #{m.id}</span>
            </div>
            <span className="text-gray-600 text-xs">{m.modelo}</span>
          </div>
        ))}
      </div>

      {/* HISTORIAL */}
      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <h2 className="text-lg font-semibold mb-2">Historial</h2>

        {pedido.historial.map((h, idx) => (
          <div key={idx} className="mb-3 text-sm text-gray-700">
            <p className="font-semibold">{h.accion}</p>
            <p className="text-xs text-gray-500">
              {new Date(h.fecha).toLocaleString()}
            </p>

            {h.detalle && (
              <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                {JSON.stringify(h.detalle, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>

      {/* ACCIONES */}
      <div className="space-y-3">
        {/* Ir a asignar máquinas */}
        <button
          onClick={() => navigate(`/deposito/pedido/${id}/asignar`)}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold shadow"
        >
          Asignar máquinas
        </button>

        {/* Marcar como PREPARADO */}
        {pedido.estado === "PENDIENTE_PREPARACION" && (
          <button
            onClick={() => marcarEstado(id, "PREPARADO", navigate)}
            className="w-full bg-yellow-600 text-white py-3 rounded-xl font-semibold shadow"
          >
            Marcar como PREPARADO
          </button>
        )}

        {/* Marcar como ENTREGADO */}
        {pedido.estado === "PREPARADO" && (
          <button
            onClick={() => entregarPedido(id, navigate)}
            className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold shadow"
          >
            Marcar como ENTREGADO
          </button>
        )}
      </div>
    </div>
  );
}

/* ============================
   FUNCIONES AUXILIARES
============================ */

async function marcarEstado(id, nuevoEstado, navigate) {
  await fetch(`http://localhost:3000/pedidos/${id}/estado`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ estado: nuevoEstado })
  });

  navigate("/deposito");
}

async function entregarPedido(id, navigate) {
  await fetch(`http://localhost:3000/pedidos/${id}/entregar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuarioId: 999 }) // mock por ahora
  });

  navigate("/deposito");
}
