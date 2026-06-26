import { formatDateTime } from "../utils/date";

function parseDetalle(detalle) {
  if (!detalle) return {};
  if (typeof detalle === "string") {
    try {
      return JSON.parse(detalle);
    } catch {
      return {};
    }
  }
  return detalle;
}

function buildEstadoTimeline(historial) {
  const entries = [...historial].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  const rows = [];

  for (const entry of entries) {
    const detalle = parseDetalle(entry.detalle);
    const user = entry.usuario?.nombre || entry.usuario?.username || "-";

    if (detalle?.inicial?.estado) {
      rows.push({
        id: `${entry.id}-init`,
        fecha: entry.fecha,
        previous: null,
        current: detalle.inicial.estado,
        user,
      });
    }

    if (detalle?.anterior?.estado && detalle?.actual?.estado && detalle.anterior.estado !== detalle.actual.estado) {
      rows.push({
        id: `${entry.id}-chg`,
        fecha: entry.fecha,
        previous: detalle.anterior.estado,
        current: detalle.actual.estado,
        user,
      });
    }
  }

  return rows;
}

export default function HistorialEventual({ historial }) {
  if (!Array.isArray(historial) || historial.length === 0) return null;

  const states = buildEstadoTimeline(historial);

  return (
    <div className="rounded-2xl bg-white p-4 shadow space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Historial</h2>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estados</p>
        <div className="mt-3 space-y-3">
          {states.length === 0 ? (
            <p className="text-sm text-slate-600">No se registraron cambios de estado.</p>
          ) : (
            states.map((row) => (
              <div key={row.id} className="flex items-center justify-between rounded-lg bg-white p-3">
                <div>
                  {row.previous ? (
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-slate-200 px-3 py-1 text-xs">{String(row.previous).toUpperCase()}</span>
                      <span className="text-slate-400">→</span>
                      <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold">{String(row.current).toUpperCase()}</span>
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-slate-900">{String(row.current).toUpperCase()}</p>
                  )}
                  <p className="mt-1 text-xs text-slate-500">Por {row.user}</p>
                </div>
                <p className="text-xs text-slate-500">{formatDateTime(row.fecha)}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
