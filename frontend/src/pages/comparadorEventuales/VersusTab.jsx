import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { API_BASE } from "../../services/apiBase";
import { buildActorHeaders } from "../../utils/authHeaders";
import { VIZ } from "../estadisticas/colors";
import { formatNumero, acortar } from "../kpiEspaciosVerdes/formato";

const COLOR_A = VIZ.s1;
const COLOR_B = VIZ.s2;

function formatFecha(f) {
  return f ? String(f).slice(0, 10).split("-").reverse().join("/") : "—";
}

function SelectorEventual({ etiqueta, color, valor, onChange, eventuales, excluirId }) {
  return (
    <label className="block flex-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        {etiqueta}
      </span>
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
      >
        <option value="">Elegí un eventual…</option>
        {eventuales
          .filter((e) => String(e.id) !== String(excluirId))
          .map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre} ({formatFecha(e.fechaInicio)})
            </option>
          ))}
      </select>
    </label>
  );
}

function Celda({ fila, valor }) {
  if (valor === null || valor === undefined) return <span className="text-slate-300">—</span>;
  if (fila.tipo === "texto") return <span>{valor}</span>;
  return (
    <span className="tabular-nums">
      {formatNumero(valor)}
      {fila.unidad ? <span className="ml-1 text-xs text-slate-400">{fila.unidad}</span> : null}
    </span>
  );
}

function Diferencia({ fila }) {
  if (fila.tipo === "texto" || fila.diferencia === null) return <span className="text-slate-300">—</span>;
  if (fila.diferencia === 0) return <span className="text-slate-400">igual</span>;
  const signo = fila.diferencia > 0 ? "+" : "";
  return (
    <span className="tabular-nums font-semibold text-kazaro-deep">
      {signo}
      {formatNumero(fila.diferencia)}
      {fila.porcentaje !== null ? (
        <span className="ml-1.5 text-xs font-medium text-slate-500">
          ({signo}
          {formatNumero(fila.porcentaje, 0)}%)
        </span>
      ) : null}
    </span>
  );
}

function difiere(fila) {
  if (fila.tipo === "texto") return fila.a !== fila.b;
  return fila.a !== fila.b;
}

function Grafico({ titulo, datos, unidad, nombreA, nombreB }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <h3 className="mb-3 font-display text-base font-extrabold text-kazaro-navy">
        {titulo}
        {unidad ? <span className="ml-1.5 text-sm font-semibold text-slate-400">({unidad})</span> : null}
      </h3>
      <ResponsiveContainer width="100%" height={Math.max(220, datos.length * 34 + 70)}>
        <BarChart data={datos} layout="vertical" margin={{ left: 4, right: 24, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke="#e2e8f0" />
          <XAxis type="number" tick={{ fontSize: 12, fill: "#64748b" }} stroke="#cbd5e1" />
          <YAxis
            type="category"
            dataKey="etiqueta"
            width={130}
            tick={{ fontSize: 12, fill: "#475569" }}
            stroke="#e2e8f0"
            tickFormatter={(v) => acortar(v, 18)}
          />
          <Tooltip
            cursor={{ fill: "#f1f5f9" }}
            formatter={(valor) => `${formatNumero(valor)}${unidad ? ` ${unidad}` : ""}`}
            contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="a" name={acortar(nombreA, 30)} fill={COLOR_A} radius={[0, 4, 4, 0]} barSize={12} />
          <Bar dataKey="b" name={acortar(nombreB, 30)} fill={COLOR_B} radius={[0, 4, 4, 0]} barSize={12} />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}

export default function VersusTab({ eventuales, user }) {
  const [idA, setIdA] = useState("");
  const [idB, setIdB] = useState("");
  const [resultado, setResultado] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [soloDiferencias, setSoloDiferencias] = useState(false);

  useEffect(() => {
    if (!idA || !idB) return undefined;

    let vigente = true;
    async function comparar() {
      try {
        setCargando(true);
        setError("");
        const res = await fetch(`${API_BASE}/admin/eventuales/comparador/versus?a=${idA}&b=${idB}`, {
          headers: buildActorHeaders(user),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Error comparando los eventuales");
        if (vigente) setResultado(data);
      } catch (e) {
        if (vigente) {
          setResultado(null);
          setError(e.message || "Error comparando los eventuales");
        }
      } finally {
        if (vigente) setCargando(false);
      }
    }
    comparar();

    return () => {
      vigente = false;
    };
  }, [idA, idB, user]);

  const listo = idA && idB;
  const visible = listo ? resultado : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row">
        <SelectorEventual etiqueta="Eventual A" color={COLOR_A} valor={idA} onChange={setIdA} eventuales={eventuales} excluirId={idB} />
        <SelectorEventual etiqueta="Eventual B" color={COLOR_B} valor={idB} onChange={setIdB} eventuales={eventuales} excluirId={idA} />
      </div>

      {!listo ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
          Elegí dos eventuales para ver la comparación.
        </div>
      ) : null}

      {listo && cargando ? <div className="h-48 animate-pulse rounded-2xl bg-white/80" /> : null}

      {listo && error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>
      ) : null}

      {visible && !cargando ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              La diferencia es B respecto de A. Las filas donde difieren están resaltadas.
            </p>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-600">
              <input type="checkbox" checked={soloDiferencias} onChange={(e) => setSoloDiferencias(e.target.checked)} />
              Solo diferencias
            </label>
          </div>

          <div className="space-y-4">
            {visible.secciones.map((seccion) => {
              const filas = soloDiferencias ? seccion.filas.filter(difiere) : seccion.filas;
              if (filas.length === 0) return null;
              return (
                <section key={seccion.titulo} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <h3 className="border-b border-slate-100 bg-kazaro-mist/60 px-4 py-2.5 font-display text-sm font-extrabold uppercase tracking-wide text-kazaro-deep">
                    {seccion.titulo}
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <thead className="text-xs text-slate-500">
                        <tr>
                          <th className="px-4 py-2 font-medium">Característica</th>
                          <th className="px-4 py-2 font-medium" style={{ color: COLOR_A }}>{acortar(visible.a.nombre, 26)}</th>
                          <th className="px-4 py-2 font-medium" style={{ color: COLOR_B }}>{acortar(visible.b.nombre, 26)}</th>
                          <th className="px-4 py-2 font-medium">Diferencia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filas.map((fila) => (
                          <tr key={fila.etiqueta} className={`border-t border-slate-100 ${difiere(fila) ? "bg-amber-50/50" : ""}`}>
                            <td className="px-4 py-2 text-slate-600">{fila.etiqueta}</td>
                            <td className="px-4 py-2 font-medium text-slate-800"><Celda fila={fila} valor={fila.a} /></td>
                            <td className="px-4 py-2 font-medium text-slate-800"><Celda fila={fila} valor={fila.b} /></td>
                            <td className="px-4 py-2"><Diferencia fila={fila} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {visible.graficos.categorias.length > 0 ? (
              <Grafico titulo="Horas por categoría" unidad="hs" datos={visible.graficos.categorias} nombreA={visible.a.nombre} nombreB={visible.b.nombre} />
            ) : null}
            {visible.graficos.trabajos.map((g) => (
              <Grafico key={`t-${g.unidad}`} titulo="Producción por trabajo" unidad={g.unidad} datos={g.datos} nombreA={visible.a.nombre} nombreB={visible.b.nombre} />
            ))}
            {visible.graficos.insumos.map((g) => (
              <Grafico key={`i-${g.unidad}`} titulo="Insumos" unidad={g.unidad} datos={g.datos} nombreA={visible.a.nombre} nombreB={visible.b.nombre} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
