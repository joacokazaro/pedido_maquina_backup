import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API_BASE } from "../services/apiBase";
import HistorialPedido from "../components/HistorialPedido";
import PedidoResumen from "../components/PedidoResumen";


export default function DepositoPedido() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pedido, setPedido] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/pedidos/${id}`);
        if (!res.ok) throw new Error("No se encontró el pedido");

        const data = await res.json();
        setPedido(data);
      } catch (err) {
        setError("Error cargando el pedido");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) return <div className="p-6">Cargando pedido...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;
  if (!pedido) return null;

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

      {/* Título */}
      <h1 className="text-2xl font-bold mb-1">Pedido {pedido.id}</h1>
      <p className="text-sm text-gray-600 mb-4">
        Supervisor: <b>{pedido.supervisor}</b>
      </p>

      <PedidoResumen pedido={pedido} />

      {/* Historial */}
      <HistorialPedido historial={pedido.historial} />


      {/* BOTONES DE ACCIÓN */}

      {/* Asignar SOLO en pendiente preparación */}
      {pedido.estado === "PENDIENTE_PREPARACION" && (
        <button
          onClick={() => navigate(`/deposito/pedido/${id}/asignar`)}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold shadow hover:bg-blue-700 transition mb-3"
        >
          Asignar máquinas
        </button>
      )}

      {pedido.estado === "PENDIENTE_PREPARACION" && (
        <button
          onClick={() => marcarEstado(id, "PREPARADO", navigate)}
          className="w-full bg-yellow-600 text-white py-3 rounded-xl font-semibold shadow hover:bg-yellow-700 transition mb-3"
        >
          Marcar como PREPARADO
        </button>
      )}

      {pedido.estado === "PREPARADO" && (
        <button
          onClick={() => entregarPedido(id, navigate)}
          className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold shadow hover:bg-green-700 transition"
        >
          Marcar como ENTREGADO
        </button>
      )}

      {pedido.estado === "PENDIENTE_CONFIRMACION" && (
        <button
          onClick={() => navigate(`/deposito/pedido/${id}/confirmar`)}
          className="w-full bg-orange-600 text-white py-3 rounded-xl font-semibold shadow hover:bg-orange-700 transition"
        >
          Confirmar devolución
        </button>
      )}

      {pedido.estado === "PENDIENTE_CONFIRMACION_FALTANTES" && (
  <button
    onClick={() => navigate(`/deposito/pedido/${id}/confirmar`)}
    className="w-full bg-red-600 text-white py-3 rounded-xl font-semibold shadow hover:bg-red-700 transition"
  >
    Confirmar faltantes devueltos
  </button>
)}


    </div>
  );
}

/* ===== AUXILIARES ===== */

async function marcarEstado(id, nuevoEstado, navigate) {
  await fetch(`${API_BASE}/pedidos/${id}/estado`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ estado: nuevoEstado, usuario: "deposito" }),
  });
  navigate("/deposito");
}

async function entregarPedido(id, navigate) {
  await fetch(`${API_BASE}/pedidos/${id}/entregar`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario: "deposito" }),
  });
  navigate("/deposito");
}
