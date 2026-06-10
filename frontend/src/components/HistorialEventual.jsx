import { formatDateTime } from "../utils/date";

function mergeKitWithComponentes(kitSnapshot, componentesSnapshot) {
  if (!kitSnapshot && !componentesSnapshot) return null;

  const base = kitSnapshot
    ? { ...kitSnapshot }
    : {
        nombre: "Sin kit",
        estado: null,
        maquinas: [],
        vehiculos: [],
      };

  if (!componentesSnapshot) return base;

  const maquinas = Array.isArray(componentesSnapshot.maquinas) ? componentesSnapshot.maquinas : (base.maquinas || []);
  const vehiculos = Array.isArray(componentesSnapshot.vehiculos) ? componentesSnapshot.vehiculos : (base.vehiculos || []);

  return {
    ...base,
    maquinas,
    vehiculos,
    resumen: {
      ...(base.resumen || {}),
      maquinas: maquinas.length,
      vehiculos: vehiculos.length,
    },
  };
}

function renderSnapshot(snapshot, title) {
  if (!snapshot) return null;

  const hasStatus = Boolean(snapshot.estado);
  const hasName = Boolean(snapshot.nombre);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-sm text-gray-800">{title}</p>
        {hasStatus ? (
          <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold uppercase text-slate-700 border border-slate-200">
            {snapshot.estado}
          </span>
        ) : null}
      </div>
      {hasName ? <p className="text-sm font-medium text-gray-700">{snapshot.nombre}</p> : null}
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Maquinas</p>
          {(snapshot.maquinas || []).length === 0 ? (
            <p className="text-xs text-gray-500">Sin maquinas</p>
          ) : (
            <ul className="flex flex-wrap gap-2 text-sm text-gray-700">
              {snapshot.maquinas.map((maquina) => (
                <li key={maquina.id} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs">
                  {maquina.tipo} {maquina.id}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Vehiculos</p>
          {(snapshot.vehiculos || []).length === 0 ? (
            <p className="text-xs text-gray-500">Sin vehiculos</p>
          ) : (
            <ul className="flex flex-wrap gap-2 text-sm text-gray-700">
              {snapshot.vehiculos.map((vehiculo) => (
                <li key={vehiculo.id} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs">
                  {vehiculo.vehiculo} {vehiculo.id}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HistorialEventual({ historial }) {
  if (!Array.isArray(historial) || historial.length === 0) return null;

  const parseDetalle = (detalle) => {
    if (!detalle) return {};
    if (typeof detalle === "string") {
      try {
        return JSON.parse(detalle);
      } catch (e) {
        return detalle;
      }
    }

    return detalle;
  };

  // order timeline from oldest to newest for a natural flow
  const sorted = [...historial].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  const states = [];
  let kitOriginal = null;
  let kitFinal = null;

  sorted.forEach((entry, idx) => {
    const detalle = parseDetalle(entry.detalle) || {};
    const fecha = entry.fecha;
    const usuarioName = entry.usuario?.nombre || entry.usuario?.username || "-";

    // initial snapshot -> treat as initial state and initial/final kit seed
    if (detalle.inicial) {
      const estadoInicial = detalle.inicial.estado || "CREADO";
      states.push({ id: entry.id || `s-${idx}`, fecha, previous: null, current: estadoInicial, usuarioName, accion: entry.accion });

      const kitInicial = mergeKitWithComponentes(detalle.inicial.kit, detalle.inicial.componentesUtilizados);
      if (kitInicial) {
        if (!kitOriginal) kitOriginal = kitInicial;
        kitFinal = kitInicial;
      }
    }

    // changes between anterior and actual
    if (detalle.anterior && detalle.actual) {
      const prevEstado = detalle.anterior.estado || null;
      const currEstado = detalle.actual.estado || null;
      if (prevEstado !== currEstado) {
        states.push({ id: entry.id || `s-${idx}`, fecha, previous: prevEstado, current: currEstado, usuarioName, accion: entry.accion });
      }

      const prevKit = mergeKitWithComponentes(detalle.anterior.kit, detalle.anterior.componentesUtilizados);
      const currKit = mergeKitWithComponentes(detalle.actual.kit, detalle.actual.componentesUtilizados);
      if (!kitOriginal && (prevKit || currKit)) {
        kitOriginal = prevKit || currKit;
      }
      if (currKit) {
        kitFinal = currKit;
      } else if (!kitFinal && prevKit) {
        kitFinal = prevKit;
      }
    }
  });

  const kitOriginalView = kitOriginal || kitFinal;
  const kitFinalView = kitFinal || kitOriginal;

  return (
    <div className="rounded-2xl bg-white p-4 shadow space-y-5">
      <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-gray-900">
        <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
        Historial
      </h2>

      {/* Estados */}
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estados</p>
        <div className="mt-3 space-y-3">
          {states.length === 0 ? (
            <p className="text-sm text-slate-600">No se registraron cambios de estado.</p>
          ) : (
            states.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                <div>
                  {s.previous ? (
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 border border-slate-200">{String(s.previous).toUpperCase()}</span>
                      <span className="text-sm text-slate-400">→</span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-900 border border-slate-200">{String(s.current).toUpperCase()}</span>
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-slate-900">{String(s.current).toUpperCase()}</p>
                  )}
                  <p className="text-xs text-slate-500 mt-1">Por {s.usuarioName}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{formatDateTime(s.fecha)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Historial de Kit */}
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Historial de kit</p>
        <div className="mt-3 space-y-4">
          {!kitOriginalView && !kitFinalView ? (
            <p className="text-sm text-slate-600">No hay kit registrado en el historial.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              <div>{renderSnapshot(kitOriginalView, "Kit original")}</div>
              <div>{renderSnapshot(kitFinalView, "Kit final")}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
