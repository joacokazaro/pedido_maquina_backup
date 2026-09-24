import { useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE } from "../../services/apiBase";
import { buildActorHeaders } from "../../utils/authHeaders";
import { formatNumero } from "../kpiEspaciosVerdes/formato";
import Metrica from "../kpiEspaciosVerdes/components/Metrica";

const UMBRAL_INICIAL = 60;

const inputClase = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800";

function Campo({ etiqueta, ayuda, children }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{etiqueta}</p>
      {ayuda ? <p className="mb-1.5 text-xs text-slate-400">{ayuda}</p> : <div className="mb-1.5" />}
      {children}
    </div>
  );
}

/** Lista editable de filas "tipo + cantidad" (trabajos, máquinas, vehículos). */
function FilasEditor({ filas, opciones, unidadDe, onChange, textoAgregar }) {
  const disponibles = opciones.filter((o) => !filas.some((f) => f.tipo === o.valor));

  function actualizar(indice, cambios) {
    onChange(filas.map((f, i) => (i === indice ? { ...f, ...cambios } : f)));
  }

  return (
    <div className="space-y-2">
      {filas.map((fila, i) => {
        const propias = opciones.filter((o) => o.valor === fila.tipo || !filas.some((f) => f.tipo === o.valor));
        const unidad = unidadDe ? unidadDe(fila.tipo) : null;
        return (
          <div key={fila.tipo} className="flex items-center gap-2">
            <select value={fila.tipo} onChange={(e) => actualizar(i, { tipo: e.target.value })} className={`${inputClase} min-w-0 flex-1`}>
              {propias.map((o) => (
                <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              value={fila.cantidad}
              onChange={(e) => actualizar(i, { cantidad: e.target.value })}
              placeholder="Cantidad"
              className={`${inputClase} w-28`}
            />
            {unidad ? <span className="w-10 text-xs text-slate-400">{unidad}</span> : null}
            <button
              type="button"
              onClick={() => onChange(filas.filter((_, j) => j !== i))}
              className="rounded-lg px-2 py-1.5 text-sm font-bold text-slate-400 transition hover:bg-red-50 hover:text-red-600"
              aria-label="Quitar"
            >
              ✕
            </button>
          </div>
        );
      })}
      {disponibles.length > 0 ? (
        <button
          type="button"
          onClick={() => onChange([...filas, { tipo: disponibles[0].valor, cantidad: "" }])}
          className="text-sm font-semibold text-kazaro-blue transition hover:text-kazaro-deep"
        >
          + {textoAgregar}
        </button>
      ) : null}
    </div>
  );
}

function colorSimilitud(valor) {
  if (valor >= 80) return "bg-emerald-500";
  if (valor >= 60) return "bg-kazaro-blue";
  return "bg-amber-500";
}

function Resultado({ r }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/admin/eventuales/${r.id}`} className="font-display text-base font-extrabold text-kazaro-navy hover:underline">
            {r.nombre}
          </Link>
          <p className="mt-0.5 text-xs text-slate-500">
            {r.supervisor ? `${r.supervisor} · ` : ""}
            {r.resumen.mes ? `${r.resumen.mes} · ` : ""}
            {r.resumen.dias ? `${r.resumen.dias} día(s) · ` : ""}
            {r.resumen.personas ? `${r.resumen.personas} persona(s) · ` : ""}
            {r.resumen.horas ? `${formatNumero(r.resumen.horas, 0)} hs` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-3xl font-black tabular-nums text-kazaro-navy">
            {formatNumero(r.similitud, 0)}
            <span className="text-lg text-slate-400">%</span>
          </p>
          <p className="text-xs text-slate-400">evaluado en {r.evaluados} de {r.pedidos}</p>
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${colorSimilitud(r.similitud)}`} style={{ width: `${Math.min(100, r.similitud)}%` }} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {r.grupos.map((g) => (
          <span key={g.clave} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-600">
            {g.label} <strong className="font-semibold text-kazaro-deep">{formatNumero(g.similitud, 0)}%</strong>
          </span>
        ))}
      </div>

      {r.resumen.trabajos.length > 0 ? (
        <p className="mt-2.5 text-xs text-slate-500">{r.resumen.trabajos.join(" · ")}</p>
      ) : null}
    </article>
  );
}

function Estimacion({ estimacion }) {
  const { personas, dias, horas, combustibleLitros, equipos, base } = estimacion;

  return (
    <section className="rounded-2xl border border-kazaro-ice bg-kazaro-mist/70 p-4 sm:p-6">
      <h3 className="font-display text-lg font-extrabold text-kazaro-navy">Referencia para el nuevo eventual</h3>
      <p className="mb-4 mt-1 text-xs text-slate-500">
        Mediana de lo que usaron los {base} eventual(es) parecidos. Se usa la mediana y no el promedio porque hay pocos casos y un solo
        eventual muy grande lo distorsionaría.
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metrica etiqueta="Personas" valor={personas.mediana} unidad="pers." tamano="grande" ayuda={personas.n > 0 ? `De ${formatNumero(personas.min, 0)} a ${formatNumero(personas.max, 0)} · ${personas.n} casos` : "Sin datos"} />
        <Metrica etiqueta="Duración" valor={dias.mediana} unidad="días" tamano="grande" tono="blue" ayuda={dias.n > 0 ? `De ${formatNumero(dias.min, 0)} a ${formatNumero(dias.max, 0)} · ${dias.n} casos` : "Sin datos"} />
        <Metrica etiqueta="Horas-hombre" valor={horas.mediana} unidad="hs" tamano="grande" tono="navy" decimales={0} ayuda={horas.n > 0 ? `De ${formatNumero(horas.min, 0)} a ${formatNumero(horas.max, 0)} · ${horas.n} casos` : "Sin datos"} />
        <Metrica etiqueta="Combustible" valor={combustibleLitros.mediana} unidad="litros" tamano="grande" tono="slate" ayuda={combustibleLitros.n > 0 ? `De ${formatNumero(combustibleLitros.min, 0)} a ${formatNumero(combustibleLitros.max, 0)} · ${combustibleLitros.n} casos` : "Sin datos"} />
      </div>

      {equipos.length > 0 ? (
        <div className="mt-5">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Equipos más usados</h4>
          <div className="overflow-x-auto rounded-xl border border-kazaro-ice bg-white">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Equipo</th>
                  <th className="px-4 py-2 text-right font-medium">Presencia</th>
                  <th className="px-4 py-2 text-right font-medium">Cantidad habitual</th>
                </tr>
              </thead>
              <tbody>
                {equipos.map((e) => (
                  <tr key={e.tipo} className="border-t border-slate-100">
                    <td className="px-4 py-2 text-slate-700">{e.tipo}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatNumero(e.presencia, 0)}% <span className="text-xs text-slate-400">({e.eventuales} de {base})</span></td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums">{formatNumero(e.cantidadMediana)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default function SimilitudTab({ catalogo, user }) {
  const [trabajos, setTrabajos] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [dias, setDias] = useState("");
  const [personas, setPersonas] = useState("");
  const [mes, setMes] = useState("");
  const [umbral, setUmbral] = useState(UMBRAL_INICIAL);
  const [respuesta, setRespuesta] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const opcionesTrabajo = catalogo.trabajos.map((t) => ({ valor: t.tipo, etiqueta: t.etiqueta }));
  const unidadTrabajo = (tipo) => catalogo.trabajos.find((t) => t.tipo === tipo)?.unidadLabel;
  const opcionesMaquina = catalogo.maquinas.map((m) => ({ valor: m, etiqueta: m }));
  const opcionesVehiculo = catalogo.vehiculos.map((v) => ({ valor: v, etiqueta: v }));

  async function buscar(e) {
    e.preventDefault();
    try {
      setCargando(true);
      setError("");
      const res = await fetch(`${API_BASE}/admin/eventuales/comparador/similares`, {
        method: "POST",
        headers: { ...buildActorHeaders(user), "Content-Type": "application/json" },
        body: JSON.stringify({ trabajos, maquinas, vehiculos, dias, personas, mes, umbral }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Error buscando eventuales similares");
      setRespuesta(data);
    } catch (err) {
      setRespuesta(null);
      setError(err.message || "Error buscando eventuales similares");
    } finally {
      setCargando(false);
    }
  }

  function limpiar() {
    setTrabajos([]);
    setMaquinas([]);
    setVehiculos([]);
    setDias("");
    setPersonas("");
    setMes("");
    setUmbral(UMBRAL_INICIAL);
    setRespuesta(null);
    setError("");
  }

  return (
    <div className="space-y-6">
      <form onSubmit={buscar} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <p className="text-sm text-slate-500">
          Completá solo lo que sepas del trabajo a realizar: se busca por los parámetros que ingreses, todos con el mismo peso.
        </p>

        <div className="grid gap-5 lg:grid-cols-2">
          <Campo etiqueta="Trabajos y cantidades" ayuda="En la unidad indicada al lado.">
            <FilasEditor filas={trabajos} opciones={opcionesTrabajo} unidadDe={unidadTrabajo} onChange={setTrabajos} textoAgregar="Agregar trabajo" />
          </Campo>

          <div className="grid grid-cols-3 gap-3">
            <Campo etiqueta="Duración">
              <input type="number" min="0" value={dias} onChange={(e) => setDias(e.target.value)} placeholder="días" className={`${inputClase} w-full`} />
            </Campo>
            <Campo etiqueta="Cuadrilla">
              <input type="number" min="0" value={personas} onChange={(e) => setPersonas(e.target.value)} placeholder="personas" className={`${inputClase} w-full`} />
            </Campo>
            <Campo etiqueta="Mes de inicio">
              <select value={mes} onChange={(e) => setMes(e.target.value)} className={`${inputClase} w-full`}>
                <option value="">Cualquiera</option>
                {catalogo.meses.map((m) => (
                  <option key={m.valor} value={m.valor}>{m.nombre}</option>
                ))}
              </select>
            </Campo>
          </div>

          <Campo etiqueta="Máquinas" ayuda="Tipo y cantidad de unidades.">
            <FilasEditor filas={maquinas} opciones={opcionesMaquina} onChange={setMaquinas} textoAgregar="Agregar máquina" />
          </Campo>

          {opcionesVehiculo.length > 0 ? (
            <Campo etiqueta="Vehículos" ayuda="Tipo y cantidad de unidades.">
              <FilasEditor filas={vehiculos} opciones={opcionesVehiculo} onChange={setVehiculos} textoAgregar="Agregar vehículo" />
            </Campo>
          ) : null}
        </div>

        <div className="flex flex-col gap-4 border-t border-slate-100 pt-4 sm:flex-row sm:items-end sm:justify-between">
          <label className="block w-full sm:max-w-sm">
            <span className="flex items-baseline justify-between text-xs font-bold uppercase tracking-wide text-slate-500">
              Similitud mínima
              <span className="font-display text-lg font-extrabold tabular-nums text-kazaro-navy">{umbral}%</span>
            </span>
            <input type="range" min="0" max="100" step="5" value={umbral} onChange={(e) => setUmbral(Number(e.target.value))} className="mt-1 w-full accent-kazaro-blue" />
          </label>

          <div className="flex gap-2">
            <button type="button" onClick={limpiar} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
              Limpiar
            </button>
            <button type="submit" disabled={cargando} className="rounded-lg bg-kazaro-navy px-5 py-2 text-sm font-semibold text-white transition hover:bg-kazaro-deep disabled:opacity-60">
              {cargando ? "Buscando…" : "Buscar similares"}
            </button>
          </div>
        </div>
      </form>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div> : null}

      {respuesta ? (
        respuesta.resultados.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
            <p className="font-display text-lg font-bold text-slate-600">Ningún eventual llega al {respuesta.busqueda.umbral}% de similitud</p>
            <p className="mx-auto mt-2 max-w-md text-xs text-slate-500">
              Se evaluaron {respuesta.totalEvaluados} de {respuesta.totalFinalizados} eventuales finalizados. Probá bajando la similitud mínima o ingresando menos parámetros.
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-500">
              <strong className="text-kazaro-deep">{respuesta.resultados.length}</strong> eventual(es) con al menos {respuesta.busqueda.umbral}% de similitud, sobre {respuesta.totalEvaluados} evaluados.
            </p>
            <div className="space-y-3">
              {respuesta.resultados.map((r) => (
                <Resultado key={r.id} r={r} />
              ))}
            </div>
            {respuesta.estimacion ? <Estimacion estimacion={respuesta.estimacion} /> : null}
          </>
        )
      ) : null}
    </div>
  );
}
