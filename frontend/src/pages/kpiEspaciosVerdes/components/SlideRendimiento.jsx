import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { VIZ } from "../../estadisticas/colors";
import { formatNumero, acortar } from "../formato";
import useEsAngosto from "../useEsAngosto";
import ComoSeCalcula from "./ComoSeCalcula";
import Metrica from "./Metrica";

/**
 * Slide de un indicador de producción por eventual (desmalezado, retiro de
 * poda y combustible): total producido ÷ eventuales que registraron ese
 * trabajo, con el detalle de cada eventual.
 */
export default function SlideRendimiento({ bloque, formula, notas, fuente }) {
  const { stats, muestras, unidad, total } = bloque;
  const angosto = useEsAngosto();

  if (stats.n === 0) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-9 text-center">
          <p className="font-display text-lg font-bold text-slate-600">Todavía no hay datos para medir esto</p>
          <p className="mx-auto mt-2 max-w-md text-xs text-slate-500">
            Hace falta al menos un eventual finalizado que tenga este trabajo cargado en su unidad correcta.
          </p>
        </div>
        <ComoSeCalcula formula={formula} notas={notas} fuente={fuente} />
      </div>
    );
  }

  const ranking = muestras.map((m) => ({ ...m, etiqueta: acortar(m.nombre, angosto ? 14 : 24) }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metrica
          etiqueta="Promedio por eventual"
          valor={stats.media}
          unidad={unidad}
          tono="navy"
          tamano="grande"
          ayuda={`Mediana ${formatNumero(stats.mediana)}`}
        />
        <Metrica etiqueta="Total producido" valor={total} unidad={unidad} tono="blue" />
        <Metrica etiqueta="Eventuales con este trabajo" valor={stats.n} decimales={0} tono="slate" />
        <Metrica
          etiqueta="Rango"
          valor={stats.max}
          unidad={unidad}
          tono="navy"
          ayuda={`Mínimo ${formatNumero(stats.min)} ${unidad}`}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 p-4 sm:p-6">
        <h3 className="font-display text-lg font-extrabold text-kazaro-navy">Eventual por eventual</h3>
        <ResponsiveContainer width="100%" height={Math.max(155, ranking.length * 40)}>
          <BarChart data={ranking} layout="vertical" margin={{ left: 4, right: angosto ? 52 : 66, top: 4, bottom: 4 }}>
            <XAxis type="number" hide domain={[0, "dataMax"]} />
            <YAxis
              type="category"
              dataKey="etiqueta"
              width={angosto ? 92 : 175}
              tick={{ fontSize: angosto ? 11 : 12, fill: "#475569" }}
              stroke="#e2e8f0"
            />
            <Tooltip
              cursor={{ fill: "#f1f5f9" }}
              formatter={(valor) => [`${formatNumero(valor)} ${unidad}`, "Producción"]}
              labelFormatter={(_l, payload) => payload?.[0]?.payload?.nombre || ""}
              contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13 }}
            />
            <Bar dataKey="valor" radius={[0, 4, 4, 0]} barSize={19} isAnimationActive animationDuration={700}>
              {ranking.map((r) => (
                <Cell key={r.id} fill={VIZ.s1} />
              ))}
              <LabelList
                dataKey="valor"
                position="right"
                formatter={(v) => formatNumero(v)}
                style={{ fontSize: 12, fill: "#475569", fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ComoSeCalcula formula={formula} notas={notas} fuente={fuente} />
    </div>
  );
}
