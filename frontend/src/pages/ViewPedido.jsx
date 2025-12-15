import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API_BASE } from "../services/apiBase";


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
    const res = await fetch(`${API_BASE}
/pedidos/${id}`);
    const data = await res.json();
    setPedido(data);

    const confirmacion = [...(data.historial || [])]
      .reverse()
      .find((h) => h.accion === "DEVOLUCION_CONFIRMADA");

    const faltantesConfirmados =
      confirmacion?.detalle?.faltantesConfirmados || [];

    setFaltantes(faltantesConfirmados);
    setSeleccion(faltantesConfirmados);
  }

  if (!pedido) return <div className="p-4">Cargando...</div>;

  const puedeCompletarFaltantes =
    pedido.estado === "CERRADO" && faltantes.length > 0;

  function toggle(idMaq) {
    if (seleccion.includes(idMaq)) {
      setSeleccion(seleccion.filter((x) => x !== idMaq));
    } else {
      setSeleccion([...seleccion, idMaq]);
    }
  }

  async function completarEntrega() {
    if (seleccion.length === 0) return;

    setEnviando(true);

    await fetch(
      `${API_BASE}
/pedidos/${id}/completar-faltantes`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario,
          devueltas: seleccion
        })
      }
    );

    await cargarPedido();
    setEnviando(false);
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

      <h1 className="text-2xl font-bold mb-3">
        Pedido {pedido.id}
      </h1>

      <span className="px-4 py-1.5 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold">
        {pedido.estado.replace("_", " ")}
      </span>

      {pedido.servicio && (
        <div className="bg-white rounded-xl shadow p-4 my-4 border-l-4 border-green-500">
          <h2 className="text-lg font-semibold mb-1">Servicio</h2>
          <p className="text-sm text-gray-700">{pedido.servicio}</p>
        </div>
      )}

      {pedido.observacion && (
        <div className="bg-white rounded-xl shadow p-4 mb-4 border-l-4 border-blue-500">
          <h2 className="text-lg font-semibold mb-1">
            Observación del supervisor
          </h2>
          <p className="text-sm text-gray-700 whitespace-pre-line">
            {pedido.observacion}
          </p>
        </div>
      )}

      {/* SOLICITADAS */}
      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <h2 className="text-lg font-semibold mb-2">
          Máquinas solicitadas
        </h2>

        {pedido.itemsSolicitados.map((i, idx) => (
          <div
            key={idx}
            className="flex justify-between bg-gray-50 px-3 py-2 rounded-lg text-sm"
          >
            <span>{i.tipo}</span>
            <span className="font-bold">{i.cantidad}</span>
          </div>
        ))}
      </div>

      {/* ASIGNADAS */}
      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <h2 className="text-lg font-semibold mb-2">
          Máquinas asignadas
        </h2>

        {pedido.itemsAsignados.map((m, idx) => (
          <div
            key={idx}
            className="bg-gray-50 px-3 py-2 rounded-lg text-sm"
          >
            <p className="font-semibold">
              {m.tipo} — {m.id}
            </p>
            <p className="text-xs text-gray-600">{m.modelo}</p>
            <p className="text-xs text-gray-500">
              Serie: {m.serie}
            </p>
          </div>
        ))}
      </div>

      {/* COMPLETAR FALTANTES */}
      {puedeCompletarFaltantes && (
        <div className="bg-white rounded-xl shadow p-4 mb-4 border-l-4 border-red-500">
          <h2 className="text-lg font-semibold mb-2">
            ⚠ Faltantes pendientes
          </h2>

          <div className="space-y-2 mb-4">
            {faltantes.map((idMaq) => (
              <label
                key={idMaq}
                className="flex justify-between items-center bg-gray-50 px-3 py-2 rounded-lg"
              >
                <span className="font-semibold">{idMaq}</span>
                <input
                  type="checkbox"
                  className="w-5 h-5"
                  checked={seleccion.includes(idMaq)}
                  onChange={() => toggle(idMaq)}
                />
              </label>
            ))}
          </div>

          <button
            disabled={enviando}
            onClick={completarEntrega}
            className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold shadow hover:bg-green-700 transition disabled:opacity-60"
          >
            {enviando ? "Guardando..." : "Completar entrega"}
          </button>
        </div>
      )}

      {/* Historial */}
<div className="bg-white rounded-xl shadow p-4 mb-4">
  <h2 className="text-lg font-semibold mb-3">Historial</h2>

  <div className="space-y-6">
    {pedido.historial.map((h, idx) => {
      const detalle = h.detalle || {};

      // ✅ Solo mostramos la "caja gris" si hay algo relevante para mostrar
      const tieneContenido =
        (detalle.devueltas && detalle.devueltas.length > 0) ||
        (detalle.faltantes && detalle.faltantes.length > 0) ||
        (detalle.devueltasConfirmadas && detalle.devueltasConfirmadas.length > 0) ||
        (detalle.faltantesConfirmados && detalle.faltantesConfirmados.length > 0) ||
        (detalle.observacion && String(detalle.observacion).trim() !== "");

      return (
        <div key={idx} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="w-3 h-3 rounded-full bg-blue-600"></div>
            {idx !== pedido.historial.length - 1 && (
              <div className="flex-1 w-0.5 bg-gray-300"></div>
            )}
          </div>

          <div className="flex-1">
            <p className="font-semibold text-sm">
              {h.accion.replace("_", " ")}
            </p>
            <p className="text-xs text-gray-500 mb-2">
              {new Date(h.fecha).toLocaleString()}
            </p>

            {/* ✅ Caja de detalles: SOLO si hay contenido */}
            {tieneContenido && (
              <div className="rounded-lg p-3 border bg-gray-50 space-y-3 text-xs">
                {detalle.devueltas && detalle.devueltas.length > 0 && (
                  <div className="bg-blue-100 border border-blue-400 p-2 rounded">
                    <p className="font-semibold">Devueltas por supervisor:</p>
                    <ul className="list-disc ml-5">
                      {detalle.devueltas.map((id, i) => (
                        <li key={i}>{id}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {detalle.faltantes && detalle.faltantes.length > 0 && (
                  <div className="bg-yellow-100 border border-yellow-500 p-2 rounded">
                    <p className="font-semibold">Faltantes según supervisor:</p>
                    <ul className="list-disc ml-5">
                      {detalle.faltantes.map((id, i) => (
                        <li key={i}>{id}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {detalle.devueltasConfirmadas &&
                  detalle.devueltasConfirmadas.length > 0 && (
                    <div className="bg-green-100 border border-green-500 p-2 rounded">
                      <p className="font-semibold">
                        Ingreso confirmado por depósito:
                      </p>
                      <ul className="list-disc ml-5">
                        {detalle.devueltasConfirmadas.map((id, i) => (
                          <li key={i}>{id}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                {detalle.faltantesConfirmados &&
                  detalle.faltantesConfirmados.length > 0 && (
                    <div className="bg-red-100 border border-red-500 p-2 rounded">
                      <p className="font-semibold">
                        Faltantes confirmados finales:
                      </p>
                      <ul className="list-disc ml-5 text-red-700">
                        {detalle.faltantesConfirmados.map((id, i) => (
                          <li key={i}>{id}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                {detalle.observacion &&
                  String(detalle.observacion).trim() !== "" && (
                    <div className="bg-blue-100 border border-blue-400 p-2 rounded">
                      <p className="font-semibold">Observación depósito:</p>
                      <p>{detalle.observacion}</p>
                    </div>
                  )}
              </div>
            )}
          </div>
        </div>
      );
    })}
  </div>
</div>


      {pedido.estado === "ENTREGADO" && (
        <button
          className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold shadow mt-4"
          onClick={() =>
            navigate(`/supervisor/pedido/${id}/devolucion`)
          }
        >
          Registrar devolución
        </button>
      )}
    </div>
  );
}
