import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { VIZ } from "../../estadisticas/colors";
import { formatNumero, acortar } from "../formato";
import useEsAngosto from "../useEsAngosto";
import ComoSeCalcula from "./ComoSeCalcula";
import Metrica from "./Metrica";

function GraficoRelacion({ titulo, bloque, color }) {
  const { unidad, puntos } = bloque;

  return (
    <section className="rounded-2xl border border-slate-200 p-4 sm:p-6">
      <h3 className="font-display text-lg font-extrabold text-kazaro-navy">{titulo}</h3>
      {puntos.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Todavía no hay eventuales con este trabajo y con horas importadas.</p>
      ) : (
        <>
          <p className="mb-3 mt-1 text-xs text-slate-500">
            Cada punto es un eventual: cuánta gente participó y cuánto se produjo. {puntos.length} eventual(es).
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 14, right: 20, bottom: 26, left: 6 }}>
              <XAxis
                type="number"
                dataKey="personas"
                tick={{ fontSize: 12, fill: "#64748b" }}
                stroke="#cbd5e1"
                allowDecimals={false}
                padding={{ left: 24, right: 24 }}
                label={{ value: "personas en el eventual", position: "insideBottom", offset: -16, fontSize: 12, fill: "#94a3b8" }}
              />
              <YAxis
                type="number"
                dataKey="produccion"
                tick={{ fontSize: 12, fill: "#64748b" }}
                stroke="#cbd5e1"
                padding={{ top: 20, bottom: 12 }}
                tickFormatter={(v) => formatNumero(v, 0)}
                label={{ value: unidad, angle: -90, position: "insideLeft", fontSize: 12, fill: "#94a3b8" }}
              />
              <Tooltip
                cursor={{ strokeDasharray: "3 3", stroke: "#cbd5e1" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0]?.payload;
                  if (!p) return null;
                  return (
                    <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs shadow-lg">
                      <p className="max-w-[220px] font-semibold text-kazaro-navy">{p.nombre}</p>
                      <p className="mt-1 text-slate-600">
                        {formatNumero(p.produccion)} {unidad} con {p.personas} persona(s)
                      </p>
                    </div>
                  );
                }}
              />
              <Scatter data={puntos} fill={color} fillOpacity={0.7} stroke="#ffffff" strokeWidth={2} />
            </ScatterChart>
          </ResponsiveContainer>
        </>
      )}
    </section>
  );
}

export default function SlideCuadrillas({ cuadrillas }) {
  const { muestras, stats, relacion } = cuadrillas;
  const angosto = useEsAngosto();

  const formula = "Personas del eventual = legajos distintos con fichajes en el eventual";
  const notas = [
    "Una persona que fichó en varios días del mismo eventual cuenta una sola vez. Si alguien cambió de legajo, se cuenta como otra persona.",
    "Los gráficos de puntos no dividen nada: muestran la producción del eventual contra la cantidad de gente que participó. Sirven para ver cuánta gente se puso en trabajos de cada tamaño.",
    "Solo entran los eventuales finalizados con horas importadas. En los gráficos de puntos, además, con el trabajo cargado en su unidad correcta.",
  ];
  const fuente = "Campo horasBrowix (personas) y trabajosRealizados del eventual.";

  if (stats.n === 0) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-9 text-center">
          <p className="font-display text-lg font-bold text-slate-600">Todavía no hay datos de cuadrillas</p>
          <p className="mx-auto mt-2 max-w-md text-xs text-slate-500">
            Hace falta al menos un eventual finalizado con las horas importadas.
          </p>
        </div>
        <ComoSeCalcula formula={formula} notas={notas} fuente={fuente} />
      </div>
    );
  }

  const datos = muestras.map((m) => ({ ...m, etiqueta: acortar(m.nombre, angosto ? 14 : 24) }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metrica
          etiqueta="Cuadrilla promedio"
          valor={stats.media}
          unidad="personas"
          tamano="grande"
          ayuda={`Mediana ${formatNumero(stats.mediana, 0)}`}
        />
        <Metrica etiqueta="Más chica" valor={stats.min} unidad="personas" tono="blue" decimales={0} />
        <Metrica etiqueta="Más grande" valor={stats.max} unidad="personas" tono="blue" decimales={0} />
        <Metrica etiqueta="Eventuales medidos" valor={stats.n} decimales={0} tono="slate" />
      </div>

      <section className="rounded-2xl border border-slate-200 p-4 sm:p-6">
        <h3 className="font-display text-lg font-extrabold text-kazaro-navy">Personas por eventual</h3>
        <p className="mb-3 mt-1 text-xs text-slate-500">
          La línea marca el promedio de {formatNumero(stats.media)} personas.
        </p>
        <ResponsiveContainer width="100%" height={Math.max(155, datos.length * 40)}>
          <BarChart data={datos} layout="vertical" margin={{ left: 4, right: angosto ? 40 : 56, top: 4, bottom: 4 }}>
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
              formatter={(valor) => [`${valor} persona(s)`, "Cuadrilla"]}
              labelFormatter={(_l, payload) => payload?.[0]?.payload?.nombre || ""}
              contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13 }}
            />
            <ReferenceLine x={stats.media} stroke={VIZ.warning} strokeWidth={2} strokeDasharray="4 4" />
            <Bar dataKey="personas" radius={[0, 4, 4, 0]} barSize={19} isAnimationActive animationDuration={700}>
              {datos.map((d) => (
                <Cell key={d.id} fill={d.personas >= stats.media ? VIZ.s1 : VIZ.s3} />
              ))}
              <LabelList dataKey="personas" position="right" style={{ fontSize: 12, fill: "#475569", fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>

      <GraficoRelacion titulo="Desmalezado según cuadrilla" bloque={relacion.desmalezado} color={VIZ.s1} />
      <GraficoRelacion titulo="Retiro de poda según cuadrilla" bloque={relacion.retiroPoda} color={VIZ.s3} />

      <ComoSeCalcula formula={formula} notas={notas} fuente={fuente} />
    </div>
  );
}
