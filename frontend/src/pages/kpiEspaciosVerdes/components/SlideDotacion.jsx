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
  ZAxis,
} from "recharts";
import { VIZ } from "../../estadisticas/colors";
import { formatNumero, acortar } from "../formato";
import useEsAngosto from "../useEsAngosto";
import ComoSeCalcula from "./ComoSeCalcula";
import Metrica from "./Metrica";

export default function SlideDotacion({ dotacion }) {
  const { muestras, stats, statsDias, jornadasTotales } = dotacion;
  const angosto = useEsAngosto();

  if (stats.n === 0) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-9 text-center">
          <p className="font-display text-lg font-bold text-slate-600">Todavía no hay datos de dotación</p>
          <p className="mx-auto mt-2 max-w-md text-xs text-slate-500">
            Hace falta un eventual finalizado con fechas de inicio y fin cargadas y las horas importadas.
          </p>
        </div>
        <ComoSeCalcula
          formula="Jornadas trabajadas ÷ días que duró el eventual"
          notas={["Sin fechas de inicio y fin no se puede calcular la duración, y sin horas importadas no hay jornadas."]}
        />
      </div>
    );
  }

  const datos = muestras.map((m) => ({ ...m, etiqueta: acortar(m.nombre, angosto ? 14 : 24) }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metrica
          etiqueta="Dotación promedio"
          valor={stats.media}
          unidad="pers./día"
          tamano="grande"
          ayuda={`De ${formatNumero(stats.min)} a ${formatNumero(stats.max)}`}
        />
        <Metrica
          etiqueta="Duración promedio"
          valor={statsDias.media}
          unidad="días"
          tono="blue"
          tamano="grande"
          ayuda={`De ${formatNumero(statsDias.min, 0)} a ${formatNumero(statsDias.max, 0)} días`}
        />
        <Metrica etiqueta="Jornadas totales" valor={jornadasTotales} decimales={0} tono="navy" ayuda="Una jornada = una persona un día" />
        <Metrica
          etiqueta="Eventuales medidos"
          valor={stats.n}
          decimales={0}
          tono="slate"
          ayuda={`Desvío ±${formatNumero(stats.desvio)} pers./día`}
        />
      </div>

      <section className="rounded-2xl border border-slate-200 p-4 sm:p-6">
        <h3 className="font-display text-lg font-extrabold text-kazaro-navy">Cuadrilla por eventual</h3>
        <p className="mb-3 mt-1 text-xs text-slate-500">
          Personas promedio por día de trabajo. La línea marca el promedio general de {formatNumero(stats.media)} pers./día.
        </p>
        <ResponsiveContainer width="100%" height={Math.max(155, datos.length * 40)}>
          <BarChart data={datos} layout="vertical" margin={{ left: 4, right: angosto ? 52 : 70, top: 4, bottom: 4 }}>
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
              formatter={(valor, _n, item) => [
                `${formatNumero(valor)} pers./día`,
                `${item?.payload?.jornadas} jornadas en ${item?.payload?.dias} día(s)`,
              ]}
              labelFormatter={(_l, payload) => payload?.[0]?.payload?.nombre || ""}
              contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13 }}
            />
            <ReferenceLine x={stats.media} stroke={VIZ.warning} strokeWidth={2} strokeDasharray="4 4" />
            <Bar dataKey="dotacion" radius={[0, 4, 4, 0]} barSize={19} isAnimationActive animationDuration={700}>
              {datos.map((d) => (
                <Cell key={d.id} fill={d.dotacion >= stats.media ? VIZ.s1 : VIZ.s3} />
              ))}
              <LabelList
                dataKey="dotacion"
                position="right"
                formatter={(v) => formatNumero(v)}
                style={{ fontSize: 12, fill: "#475569", fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="rounded-2xl border border-slate-200 p-4 sm:p-6">
        <h3 className="font-display text-lg font-extrabold text-kazaro-navy">Cuadrilla contra duración</h3>
        <p className="mb-3 mt-1 text-xs text-slate-500">
          Cada punto es un eventual: cuántos días duró y con cuánta gente por día se hizo. El tamaño del
          punto son las horas-hombre totales. Sirve para dimensionar la cuadrilla del próximo trabajo.
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <ScatterChart margin={{ top: 14, right: 20, bottom: 26, left: 6 }}>
            {/* El padding evita que una burbuja apoyada en el máximo del eje
                quede cortada contra el borde del área de dibujo. */}
            <XAxis
              type="number"
              dataKey="dias"
              name="Días"
              tick={{ fontSize: 12, fill: "#64748b" }}
              stroke="#cbd5e1"
              allowDecimals={false}
              padding={{ left: 24, right: 24 }}
              label={{ value: "días de duración", position: "insideBottom", offset: -16, fontSize: 12, fill: "#94a3b8" }}
            />
            <YAxis
              type="number"
              dataKey="dotacion"
              name="Personas por día"
              tick={{ fontSize: 12, fill: "#64748b" }}
              stroke="#cbd5e1"
              padding={{ top: 20, bottom: 12 }}
              label={{ value: "pers./día", angle: -90, position: "insideLeft", fontSize: 12, fill: "#94a3b8" }}
            />
            <ZAxis type="number" dataKey="horas" range={[80, 480]} name="Horas-hombre" />
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
                      {formatNumero(p.dotacion)} pers./día durante {p.dias} día(s)
                    </p>
                    <p className="text-slate-500">
                      {p.jornadas} jornadas · {formatNumero(p.horas)} hs · {formatNumero(p.horasPorJornada)} hs por jornada
                    </p>
                  </div>
                );
              }}
            />
            <Scatter data={datos} fill={VIZ.s1} fillOpacity={0.65} stroke="#ffffff" strokeWidth={2} />
          </ScatterChart>
        </ResponsiveContainer>
      </section>

      <section className="rounded-2xl border border-slate-200 p-4 sm:p-6">
        <h3 className="mb-4 font-display text-lg font-extrabold text-kazaro-navy">Detalle</h3>
        {/* min-w para que en pantallas angostas la tabla scrollee dentro de su
            caja en vez de comprimir las columnas hasta cortar los títulos. */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1.5 pr-3 font-medium">Eventual</th>
                <th className="py-1.5 pr-3 text-right font-medium">Días</th>
                <th className="py-1.5 pr-3 text-right font-medium">Jornadas</th>
                <th className="py-1.5 pr-3 text-right font-medium">Personas</th>
                <th className="py-1.5 pr-3 text-right font-medium">Pers./día</th>
                <th className="py-1.5 pr-3 text-right font-medium">Hs por jornada</th>
              </tr>
            </thead>
            <tbody>
              {datos.map((d) => (
                <tr key={d.id} className="border-t border-slate-100">
                  <td className="py-1.5 pr-3" title={d.nombre}>{acortar(d.nombre, 34)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{d.dias}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{d.jornadas}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{d.personas ?? "—"}</td>
                  <td className="py-1.5 pr-3 text-right font-semibold tabular-nums">{formatNumero(d.dotacion)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{formatNumero(d.horasPorJornada)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ComoSeCalcula
        formula="Dotación = jornadas trabajadas ÷ días que duró el eventual"
        notas={[
          "Una jornada es una persona trabajando un día: son los fichajes con jornada asignada que el sistema de marcación devuelve para ese eventual.",
          "Los días se cuentan de forma inclusiva entre la fecha de inicio y la de fin del eventual, así que un trabajo de un solo día cuenta 1.",
          "Es un promedio sobre el período completo: si la cuadrilla fue de 6 personas un día y de 2 los otros tres, el indicador muestra 3 y no el pico.",
          "«Personas» cuenta legajos distintos dentro del eventual; puede ser mayor que la dotación diaria si hubo rotación.",
        ]}
        fuente="Campo horasBrowix (cantidad de fichajes y personas) más las fechas de inicio y fin del eventual."
      />
    </div>
  );
}
