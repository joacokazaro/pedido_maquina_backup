export default function HistorialPedido({ historial }) {
  if (!historial || historial.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow p-4 mb-4">
      <h2 className="text-lg font-semibold mb-3">Historial</h2>

      <div className="space-y-6">
        {[...historial].map((h, idx) => {
          const d = h.detalle || {};

          const tieneContenido =
            (d.devueltas && d.devueltas.length > 0) ||
            (d.faltantes && d.faltantes.length > 0) ||
            (d.devueltasConfirmadas && d.devueltasConfirmadas.length > 0) ||
            (d.faltantesConfirmados && d.faltantesConfirmados.length > 0) ||
            (d.devueltasDeclaradas && d.devueltasDeclaradas.length > 0) ||
            (d.justificacion && String(d.justificacion).trim() !== "") ||
            (d.observacion && String(d.observacion).trim() !== "");

          return (
            <div key={idx} className="flex gap-4">
              {/* Timeline */}
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                {idx !== historial.length - 1 && (
                  <div className="flex-1 w-0.5 bg-gray-200"></div>
                )}
              </div>

              {/* Contenido */}
              <div className="flex-1">
                <div className="flex items-baseline justify-between">
                  <p className="font-semibold text-sm">
                    {String(h.accion || "").replaceAll("_", " ")}
                  </p>
                  <p className="text-xs text-gray-500">{new Date(h.fecha).toLocaleString()}</p>
                </div>

                <p className="text-xs text-gray-500 mb-2">Por: <span className="font-medium text-gray-700">{h.usuario || '—'}</span></p>

                {tieneContenido && (
                  <div className="rounded-lg p-3 border bg-gray-50 space-y-3 text-sm">

                    {renderListaSimple("Devueltas por supervisor", d.devueltas)}
                    {renderListaSimple("Faltantes informados", d.faltantes)}
                    {renderListaSimple("Ingreso confirmado por depósito", d.devueltasConfirmadas)}
                    {renderListaSimple("Faltantes confirmados finales", d.faltantesConfirmados)}
                    {renderListaSimple("Faltantes devueltos posteriormente", d.devueltasDeclaradas)}

                    {d.justificacion && String(d.justificacion).trim() !== "" && (
                      <div className="border p-2 rounded bg-white">
                        <p className="font-semibold text-sm">Justificación</p>
                        <p className="text-sm text-gray-700">{d.justificacion}</p>
                        <p className="text-xs text-gray-500 mt-1">Por: <span className="font-medium text-gray-700">{h.usuario || '—'}</span></p>
                      </div>
                    )}

                    {d.observacion && String(d.observacion).trim() !== "" && (
                      <div className="border p-2 rounded bg-white">
                        <p className="font-semibold text-sm">Observación</p>
                        <p className="text-sm text-gray-700">{d.observacion}</p>
                        <p className="text-xs text-gray-500 mt-1">Por: <span className="font-medium text-gray-700">{h.usuario || '—'}</span></p>
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
  );
}

/* =========================
   Helpers
========================= */

function renderListaSimple(titulo, items) {
  if (!items || items.length === 0) return null;
  return (
    <div className="border p-2 rounded bg-white">
      <div className="flex items-center justify-between mb-1">
        <p className="font-semibold text-sm">{titulo}</p>
        <p className="text-xs text-gray-500">{items.length} ítem{items.length>1?'s':''}</p>
      </div>
      <ul className="list-disc ml-5 text-sm text-gray-700">
        {items.map((i, idx) => (
          <li key={idx}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
