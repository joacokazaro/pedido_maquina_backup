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

      {/* BOTÓN VOLVER */}
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-2 px-3 py-2 rounded-lg 
                   bg-white border border-gray-200 shadow-sm 
                   hover:shadow transition text-gray-700 text-sm font-medium"
      >
        <span className="text-lg">←</span> Volver
      </button>

      {/* TÍTULO */}
      <h1 className="text-2xl font-bold mb-3">Pedido {pedido.id}</h1>

      {/* ESTADO */}
      <div className="mb-4">
        <span className="px-4 py-1.5 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold">
          {pedido.estado.replace("_", " ")}
        </span>
      </div>

      {/* OBSERVACIÓN — NUEVO BLOQUE */}
      {pedido.observacion && (
        <div className="bg-white rounded-xl shadow p-4 mb-4 border-l-4 border-blue-500">
          <h2 className="text-lg font-semibold mb-1">Observación del supervisor</h2>
          <p className="text-sm text-gray-700 whitespace-pre-line">
            {pedido.observacion}
          </p>
        </div>
      )}

      {/* SOLICITADO */}
      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <h2 className="text-lg font-semibold mb-2">Solicitado</h2>

        <div className="space-y-2">
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
      </div>

      {/* ASIGNADO */}
      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <h2 className="text-lg font-semibold mb-2">Máquinas asignadas</h2>

        {pedido.itemsAsignados.length === 0 ? (
          <p className="text-xs text-gray-500">Aún no se asignaron máquinas.</p>
        ) : (
          <div className="space-y-3">
            {pedido.itemsAsignados.map((m, idx) => (
              <div key={idx} className="bg-gray-50 px-3 py-2 rounded-lg text-sm">
                <p className="font-semibold">{m.tipo} — {m.id}</p>
                <p className="text-xs text-gray-600">{m.modelo}</p>
                <p className="text-xs text-gray-500">Serie: {m.serie}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* HISTORIAL */}
      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <h2 className="text-lg font-semibold mb-3">Historial</h2>

        <div className="space-y-5">
          {pedido.historial.map((h, idx) => (
            <div key={idx} className="flex gap-4">

              {/* Línea temporal */}
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                {idx !== pedido.historial.length - 1 && (
                  <div className="flex-1 w-0.5 bg-gray-300"></div>
                )}
              </div>

              {/* Contenido del historial */}
              <div className="flex-1">
                <p className="font-semibold text-sm">
                  {h.accion.replace("_", " ")}
                </p>
                <p className="text-xs text-gray-500 mb-2">
                  {new Date(h.fecha).toLocaleString()}
                </p>
                

                {/* Detalles formateados */}
                {h.detalle && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-700 space-y-2">

                    {h.detalle.observacion && (
                      <div>
                        <p className="font-semibold">Observación:</p>
                        <p>{h.detalle.observacion}</p>
                      </div>
                    )}

                    {"asignadas" in h.detalle && (
                      <div>
                        <p className="font-semibold">Máquinas asignadas:</p>
                        <ul className="list-disc ml-5">
                          {h.detalle.asignadas.map((m, i) => (
                            <li key={i}>{m.tipo} – {m.id}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {"solicitado" in h.detalle && (
                      <div>
                        <p className="font-semibold">Solicitado:</p>
                        <ul className="list-disc ml-5">
                          {Object.entries(h.detalle.solicitado).map(([tipo, cant]) => (
                            <li key={tipo}>{tipo}: {cant}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {"asignadoPorTipo" in h.detalle && (
                      <div>
                        <p className="font-semibold">Asignado por tipo:</p>
                        <ul className="list-disc ml-5">
                          {Object.entries(h.detalle.asignadoPorTipo).map(([tipo, cant]) => (
                            <li key={tipo}>{tipo}: {cant}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {"justificacion" in h.detalle && h.detalle.justificacion && (
                      <div>
                        <p className="font-semibold">Justificación:</p>
                        <p>{h.detalle.justificacion}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          ))}
        </div>
      </div>
            {/* ACCIÓN: REGISTRAR DEVOLUCIÓN */}
{pedido.estado === "ENTREGADO" && (
  <button
    className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold shadow mt-4"
    onClick={() => navigate(`/supervisor/pedido/${id}/devolucion`)}
  >
    Registrar devolución
  </button>
)}

    </div>
  );
}
