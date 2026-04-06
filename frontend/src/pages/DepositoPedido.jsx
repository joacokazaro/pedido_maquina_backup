import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API_BASE } from "../services/apiBase";
import { useAuth } from "../context/AuthContext";
import HistorialPedido from "../components/HistorialPedido";
import PedidoResumen from "../components/PedidoResumen";
import ConfirmModal from "../components/ConfirmModal";

export default function DepositoPedido() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [pedido, setPedido] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [observacion, setObservacion] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/pedidos/${id}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setPedido(data);
      } catch {
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

  function volverAlListado() {
    if (user.rol === "SUPERVISOR") {
      navigate("/supervisor/prestamos");
    } else {
      navigate("/deposito/pedidos");
    }
  }

  async function marcarEstado(nuevoEstado) {
    await fetch(`${API_BASE}/pedidos/${id}/estado`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        estado: nuevoEstado,
        usuario: user.username,
      }),
    });

    volverAlListado();
  }

  async function entregarPedido() {
    await fetch(`${API_BASE}/pedidos/${id}/entregar`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usuario: user.username,
        observacion: observacion && String(observacion).trim().length > 0 ? observacion : null,
      }),
    });

    volverAlListado();
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

      <h1 className="text-2xl font-bold mb-1">Pedido {pedido.id}</h1>

      <div className="text-sm text-gray-600 mb-4 space-y-1">
        <p>
          Solicitante: <b>{pedido.supervisor ?? "—"}</b>
        </p>
        <p>
          Titular: <b>{pedido.titular ?? "—"}</b>
        </p>
      </div>

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
      <HistorialPedido historial={pedido.historial} />

      {/* ACCIONES */}

      {pedido.estado === "PENDIENTE_PREPARACION" && (
        <>
          <button
            onClick={() => navigate(`/deposito/pedido/${id}/asignar`)}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold mb-3"
          >
            Asignar máquinas
          </button>

          <button
            onClick={() => marcarEstado("PREPARADO")}
            className="w-full bg-yellow-600 text-white py-3 rounded-xl font-semibold mb-3"
          >
            Marcar como PREPARADO
          </button>
        </>
      )}

      {pedido.estado === "PREPARADO" && (
        <button
          onClick={entregarPedido}
          className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold"
        >
          Marcar como ENTREGADO
        </button>
      )}

      {/* Solicitar cancelación (vista depósito): mostrar cuando el pedido tenga destino DEPOSITO */}
      {pedido.destino === "DEPOSITO" && (user?.rol || "").toLowerCase() === "deposito" &&
        !["CANCELADO", "CERRADO", "PENDIENTE_CANCELACION"].includes(pedido.estado) && (
          <>
            <button
              onClick={() => setConfirmOpen(true)}
              className="w-full bg-red-600 text-white py-3 rounded-xl font-semibold mt-3"
            >
              Solicitar cancelación
            </button>

            <ConfirmModal
              open={confirmOpen}
              title={`Solicitar cancelación`}
              message={`¿Confirmás solicitar la cancelación del pedido ${pedido.id}?`}
              confirmLabel="Solicitar"
              cancelLabel="Cancelar"
              requireComment={true}
              commentPlaceholder="Motivo de la solicitud de cancelación..."
              onCancel={() => setConfirmOpen(false)}
              onConfirm={async (comment) => {
                setConfirmOpen(false);
                await fetch(`${API_BASE}/pedidos/${id}/solicitar-cancelacion`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ usuario: user.username, observacion: comment }),
                });
                volverAlListado();
              }}
            />
          </>
        )}

      {["PENDIENTE_CONFIRMACION", "PENDIENTE_CONFIRMACION_FALTANTES"].includes(
        pedido.estado
      ) && (
        <button
          onClick={() => navigate(`/deposito/pedido/${id}/confirmar`)}
          className="w-full bg-orange-600 text-white py-3 rounded-xl font-semibold"
        >
          Confirmar devolución
        </button>
      )}
    </div>
  );
}
