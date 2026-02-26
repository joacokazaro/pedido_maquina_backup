import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API_BASE } from "../services/apiBase";
import HistorialPedido from "../components/HistorialPedido";
import PedidoResumen from "../components/PedidoResumen";
import { useAuth } from "../context/AuthContext";



export default function SupervisorPrestamo() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pedido, setPedido] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [observacion, setObservacion] = useState("");
  const { user } = useAuth();


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
      <p>
    Solicitante: <b>{pedido.supervisor ?? "—"}</b>
  </p>
  <p>
    Titular: <b>{pedido.titular ?? "—"}</b>
  </p>

      <PedidoResumen pedido={pedido} />
      <div className="mb-4 bg-white p-3 rounded-xl border">
        <label className="block text-sm font-medium text-gray-700 mb-1">Observación al entregar (opcional)</label>
        <textarea
          className="w-full p-2 border rounded-lg"
          rows={2}
          value={observacion}
          onChange={(e) => setObservacion(e.target.value)}
          placeholder="Agregar una observación opcional al marcar como entregado..."
        />
      </div>

      {/* Historial */}
      <HistorialPedido historial={pedido.historial} />


      {/* BOTONES DE ACCIÓN */}

      {/* Asignar SOLO en pendiente preparación */}
      {pedido.estado === "PENDIENTE_PREPARACION" && (
        <button
          onClick={() => navigate(`/supervisor/prestamo/${id}/asignar`)}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold shadow hover:bg-blue-700 transition mb-3"
        >
          Asignar máquinas
        </button>
      )}

      {pedido.estado === "PENDIENTE_PREPARACION" && (
  <button
    onClick={() =>
      marcarEstado(id, "PREPARADO", navigate, user.username)
    }
    className="w-full bg-yellow-600 text-white py-3 rounded-xl font-semibold"
  >
    Marcar como PREPARADO
  </button>
)}

{pedido.estado === "PREPARADO" && (
  <button
    onClick={() =>
      entregarPedido(id, navigate, user.username, observacion)
    }
    className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold"
  >
    Marcar como ENTREGADO
  </button>
)}


     {pedido.estado === "PENDIENTE_CONFIRMACION" && (
  <button
    onClick={() => navigate(`/supervisor/prestamo/${id}/confirmar`)}
    className="w-full bg-orange-600 text-white py-3 rounded-xl font-semibold shadow hover:bg-orange-700 transition"
  >
    Confirmar devolución
  </button>
)}

{pedido.estado === "PENDIENTE_CONFIRMACION_FALTANTES" && (
  <button
    onClick={() => navigate(`/supervisor/prestamo/${id}/confirmar`)}
    className="w-full bg-red-600 text-white py-3 rounded-xl font-semibold shadow hover:bg-red-700 transition"
  >
    Confirmar faltantes devueltos
  </button>
)}

    </div>
  );
}

/* ===== AUXILIARES ===== */

async function marcarEstado(id, nuevoEstado, navigate, username) {
  await fetch(`${API_BASE}/pedidos/${id}/estado`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      estado: nuevoEstado,
      usuario: username, // 👈 supervisor real
    }),
  });

  navigate("/supervisor/prestamos"); // 👈 ruta correcta
}


async function entregarPedido(id, navigate, username, observacion) {
  await fetch(`${API_BASE}/pedidos/${id}/entregar`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      usuario: username, // 👈 supervisor real
      observacion: observacion && String(observacion).trim().length > 0 ? observacion : null,
    }),
  });

  navigate("/supervisor/prestamos");
}

