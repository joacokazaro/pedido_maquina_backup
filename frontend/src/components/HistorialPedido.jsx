export default function HistorialPedido({ historial }) {
  if (!historial || historial.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow p-4 mb-4">
      <h2 className="text-lg font-semibold mb-3">Historial</h2>

      <div className="space-y-6">
        {historial.map((h, idx) => {
          const d = h.detalle || {};

          const tieneContenido =
            (d.devueltas && d.devueltas.length > 0) ||
            (d.faltantes && d.faltantes.length > 0) ||
            (d.devueltasConfirmadas && d.devueltasConfirmadas.length > 0) ||
            (d.faltantesConfirmados && d.faltantesConfirmados.length > 0) ||
            (d.devueltasDeclaradas && d.devueltasDeclaradas.length > 0) ||
            (d.comentario && d.comentario.trim() !== "");

          return (
            <div key={idx} className="flex gap-4">
              {/* Línea temporal */}
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                {idx !== historial.length - 1 && (
                  <div className="flex-1 w-0.5 bg-gray-300"></div>
                )}
              </div>

              {/* Contenido */}
              <div className="flex-1">
                <p className="font-semibold text-sm">
                  {h.accion.replaceAll("_", " ")}
                </p>

                <p className="text-xs text-gray-500 mb-2">
                  {new Date(h.fecha).toLocaleString()} · {h.usuario}
                </p>

                {tieneContenido && (
                  <div className="rounded-lg p-3 border bg-gray-50 space-y-3 text-xs">

                    {renderLista("Devueltas", d.devueltas, "blue")}
                    {renderLista("Faltantes", d.faltantes, "yellow")}
                    {renderLista("Devueltas confirmadas", d.devueltasConfirmadas, "green")}
                    {renderLista("Faltantes confirmados", d.faltantesConfirmados, "red")}
                    {renderLista("Faltantes declarados", d.devueltasDeclaradas, "orange")}

                    {d.comentario && (
                      <div className="bg-gray-100 border p-2 rounded">
                        <p className="font-semibold">Comentario</p>
                        <p>{d.comentario}</p>
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

/* ===== Helpers ===== */

function renderLista(titulo, items, color) {
  if (!items || items.length === 0) return null;

  const colores = {
    blue: "bg-blue-100 border-blue-400",
    yellow: "bg-yellow-100 border-yellow-500",
    green: "bg-green-100 border-green-500",
    red: "bg-red-100 border-red-500",
    orange: "bg-orange-100 border-orange-500"
  };

  return (
    <div className={`${colores[color]} border p-2 rounded`}>
      <p className="font-semibold">{titulo}:</p>
      <ul className="list-disc ml-5">
        {items.map((i, idx) => (
          <li key={idx}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
