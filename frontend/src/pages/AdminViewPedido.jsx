import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

export default function AdminViewPedido() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [pedido, setPedido] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* ============================
        CARGAR PEDIDO
  ============================ */
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(
          `http://localhost:3000/pedidos/${encodeURIComponent(id)}`
        );
        if (!res.ok) throw new Error("No se pudo cargar el pedido");

        const data = await res.json();
        setPedido(data);
      } catch (err) {
        console.error(err);
        setError("Error cargando el pedido");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return <div className="p-6">Cargando pedido…</div>;
  }

  if (error || !pedido) {
    return <div className="p-6 text-red-500">{error || "Pedido no encontrado"}</div>;
  }

  /* ============================
        HELPERS
  ============================ */
  function estadoLabel(estado) {
    return estado.replaceAll("_", " ");
  }

  /* ============================
        RENDER
  ============================ */
  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">

      {/* VOLVER */}
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-2 px-3 py-2 rounded-lg
                   bg-white border border-gray-200 shadow-sm hover:shadow
                   text-gray-700 text-sm font-medium"
      >
        <span className="text-lg">←</span> Volver
      </button>

      {/* HEADER */}
      <h1 className="text-2xl font-bold mb-1">Pedido {pedido.id}</h1>
      <p className="text-sm text-gray-600 mb-2">
        Supervisor: <b>{pedido.supervisor}</b>
      </p>

      <span className="inline-block px-4 py-1.5 rounded-full bg-gray-200 text-gray-800 text-sm font-semibold mb-4">
        {estadoLabel(pedido.estado)}
      </span>

      {/* SERVICIO */}
      {pedido.servicio && (
        <div className="bg-white rounded-xl shadow p-4 mb-4 border-l-4 border-green-500">
          <h2 className="text-lg font-semibold mb-1">Servicio</h2>
          <p className="text-sm text-gray-700">{pedido.servicio}</p>
        </div>
      )}

      {/* OBSERVACIÓN SUPERVISOR */}
      {pedido.observacion && (
        <div className="bg-white rounded-xl shadow p-4 mb-4 border-l-4 border-blue-500">
          <h2 className="text-lg font-semibold mb-1">Observación inicial</h2>
          <p className="text-sm text-gray-700 whitespace-pre-line">
            {pedido.observacion}
          </p>
        </div>
      )}

      {/* ============================
          MÁQUINAS SOLICITADAS
      ============================ */}
      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <h2 className="text-lg font-semibold mb-2">Máquinas solicitadas</h2>

        {(pedido.itemsSolicitados || []).length === 0 ? (
          <p className="text-sm text-gray-500">No hay máquinas solicitadas.</p>
        ) : (
          pedido.itemsSolicitados.map((i, idx) => (
            <div
              key={idx}
              className="flex justify-between bg-gray-50 px-3 py-2 rounded-lg text-sm mb-1"
            >
              <span>{i.tipo}</span>
              <span className="font-bold">{i.cantidad}</span>
            </div>
          ))
        )}
      </div>

      {/* ============================
          MÁQUINAS ASIGNADAS
      ============================ */}
      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <h2 className="text-lg font-semibold mb-2">Máquinas asignadas</h2>

        {(pedido.itemsAsignados || []).length === 0 ? (
          <p className="text-sm text-gray-500">No hay máquinas asignadas.</p>
        ) : (
          pedido.itemsAsignados.map((m, idx) => (
            <div key={idx} className="bg-gray-50 px-3 py-2 rounded-lg text-sm mb-1">
              <p className="font-semibold">
                {m.tipo} — {m.id}
              </p>
              <p className="text-xs text-gray-600">{m.modelo}</p>
              {m.serie && (
                <p className="text-xs text-gray-500">Serie: {m.serie}</p>
              )}
            </div>
          ))
        )}
      </div>

      {/* ============================
          HISTORIAL COMPLETO
      ============================ */}
      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <h2 className="text-lg font-semibold mb-3">Historial</h2>

        <div className="space-y-6">
          {pedido.historial.map((h, idx) => {
            const d = h.detalle || {};

            return (
              <div key={idx} className="flex gap-4">

                {/* TIMELINE */}
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                  {idx !== pedido.historial.length - 1 && (
                    <div className="flex-1 w-0.5 bg-gray-300"></div>
                  )}
                </div>

                {/* CONTENIDO */}
                <div className="flex-1">
                  <p className="font-semibold text-sm">
                    {h.accion.replaceAll("_", " ")}
                  </p>
                  <p className="text-xs text-gray-500 mb-2">
                    {new Date(h.fecha).toLocaleString()}
                  </p>

                  <div className="rounded-lg p-3 border bg-gray-50 space-y-3 text-xs">

                    {d.servicio && (
                      <div>
                        <p className="font-semibold">Servicio:</p>
                        <p>{d.servicio}</p>
                      </div>
                    )}

                    {d.asignadas && (
                      <div>
                        <p className="font-semibold">Asignadas:</p>
                        <ul className="list-disc ml-4">
                          {d.asignadas.map((m, i) => (
                            <li key={i}>
                              {m.tipo} — <b>{m.id}</b>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {d.devueltas && (
                      <div className="bg-green-50 border border-green-300 p-2 rounded">
                        <p className="font-semibold">Devueltas:</p>
                        <ul className="list-disc ml-4">
                          {d.devueltas.map((idMaq, i) => (
                            <li key={i}>{idMaq}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {d.faltantes && d.faltantes.length > 0 && (
                      <div className="bg-yellow-50 border border-yellow-400 p-2 rounded">
                        <p className="font-semibold">Faltantes informados:</p>
                        <ul className="list-disc ml-4">
                          {d.faltantes.map((idMaq, i) => (
                            <li key={i}>{idMaq}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {d.faltantesConfirmados &&
                      d.faltantesConfirmados.length > 0 && (
                        <div className="bg-red-100 border border-red-500 p-2 rounded">
                          <p className="font-semibold">
                            Faltantes confirmados finales:
                          </p>
                          <ul className="list-disc ml-4 text-red-700">
                            {d.faltantesConfirmados.map((idMaq, i) => (
                              <li key={i}>{idMaq}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                    {d.justificacion && (
                      <div>
                        <p className="font-semibold">Justificación:</p>
                        <p>{d.justificacion}</p>
                      </div>
                    )}

                    {d.observacion && (
                      <div>
                        <p className="font-semibold">Observación:</p>
                        <p>{d.observacion}</p>
                      </div>
                    )}

                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
