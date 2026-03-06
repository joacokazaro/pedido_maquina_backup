import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API_BASE } from "../services/apiBase";
import HistorialPedido from "../components/HistorialPedido";
import PedidoResumen from "../components/PedidoResumen";
import ConfirmModal from "../components/ConfirmModal";

export default function ViewPedido() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [pedido, setPedido] = useState(null);
  const [faltantes, setFaltantes] = useState([]);
  const [seleccion, setSeleccion] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  // ✅ USUARIO REAL DESDE AUTH
  const authUser = JSON.parse(localStorage.getItem("authUser") || "{}");
  const usuario = authUser.username;
  const rol = (authUser.rol || "").toLowerCase();

  /* =========================
     GUARDIA DE SESIÓN
  ========================== */
  if (!usuario) {
    return (
      <div className="p-6 text-red-600 font-semibold">
        Sesión inválida. Volvé a iniciar sesión.
      </div>
    );
  }

  useEffect(() => {
    cargarPedido();
  }, [id]);

  async function cargarPedido() {
    try {
      const res = await fetch(`${API_BASE}/pedidos/${id}`);
      if (!res.ok) throw new Error("Error cargando pedido");

      const data = await res.json();
      setPedido(data);

      const confirmacion = [...(data.historial || [])]
        .reverse()
        .find(h => h.accion === "DEVOLUCION_CONFIRMADA");

      const faltantesConfirmados =
        confirmacion?.detalle?.faltantesConfirmados || [];

      setFaltantes(faltantesConfirmados);
      setSeleccion(faltantesConfirmados);
    } catch (e) {
      setError("No se pudo cargar el pedido");
    }
  }

  if (error) {
    return <div className="p-4 text-red-600">{error}</div>;
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

  /* =========================
     COMPLETAR FALTANTES
  ========================== */
  async function completarEntrega() {
    if (seleccion.length === 0) return;

    setEnviando(true);
    setError("");

    try {
      const res = await fetch(
        `${API_BASE}/pedidos/${id}/completar-faltantes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            usuario,            // ✅ CLAVE
            devueltas: seleccion
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error completando faltantes");
      }

      await cargarPedido();
    } catch (e) {
      console.error(e);
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">

      <button
        onClick={() => navigate(-1)}
        className="mb-4 px-3 py-2 bg-white border rounded-lg"
      >
      Volver
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

      {/* COMPLETAR FALTANTES */}
      {puedeCompletarFaltantes && (
        <div className="bg-white p-4 mb-4 border-l-4 border-red-500 rounded-xl shadow">
          <h2 className="font-semibold mb-2">⚠ Faltantes pendientes</h2>

          {faltantes.map(idMaq => (
            <label
              key={idMaq}
              className="flex justify-between bg-gray-50 p-2 rounded mb-2"
            >
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
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl mt-2"
          >
            {enviando ? "Guardando..." : "Completar entrega"}
          </button>
        </div>
      )}

      {/* HISTORIAL */}
      <HistorialPedido historial={pedido.historial} />

      {pedido.estado === "ENTREGADO" && (
        <button
          onClick={() => navigate(`/supervisor/pedido/${id}/devolucion`)}
          className="w-full bg-green-600 text-white py-3 rounded-xl"
        >
          Registrar devolución
        </button>
      )}

      {/* Solicitar cancelación (si el usuario es el receptor) */}
      {((pedido.destino === "DEPOSITO" && rol === "deposito") || (pedido.destino === "SUPERVISOR" && pedido.titular === usuario)) &&
        !["CANCELADO", "CERRADO", "PENDIENTE_CANCELACION"].includes(pedido.estado) && (
          <>
            <button
              onClick={() => setConfirmOpen(true)}
              className="w-full bg-red-600 text-white py-3 rounded-xl mt-3"
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
                try {
                  await fetch(`${API_BASE}/pedidos/${id}/solicitar-cancelacion`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ usuario, observacion: comment }),
                  });
                } catch (e) {
                  console.error(e);
                }
                navigate(-1);
              }}
            />
          </>
        )}
    </div>
  );
}
