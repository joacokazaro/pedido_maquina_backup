import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { VIZ } from "../../estadisticas/colors";
import { formatNumero } from "../formato";
import ComoSeCalcula from "./ComoSeCalcula";
import Metrica from "./Metrica";

function GraficoMensual({ titulo, dato, unidad, meses, color }) {
  return (
    <section className="rounded-2xl border border-slate-200 p-4 sm:p-6">
      <h3 className="mb-3 font-display text-lg font-extrabold text-kazaro-navy">{titulo}</h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={meses} margin={{ top: 18, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="etiqueta" tick={{ fontSize: 12, fill: "#64748b" }} stroke="#cbd5e1" />
          <YAxis tick={{ fontSize: 12, fill: "#64748b" }} stroke="#cbd5e1" allowDecimals={false} width={44} />
          <Tooltip
            cursor={{ fill: "#f1f5f9" }}
            formatter={(valor) => [`${formatNumero(valor, 0)} ${unidad}`, titulo]}
            contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13 }}
          />
          <Bar dataKey={dato} fill={color} radius={[4, 4, 0, 0]} isAnimationActive animationDuration={700}>
            <LabelList
              dataKey={dato}
              position="top"
              formatter={(v) => (v > 0 ? formatNumero(v, 0) : "")}
              style={{ fontSize: 11, fill: "#475569", fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}

export default function SlideEstacionalidad({ estacionalidad }) {
  const { meses, pico, stats } = estacionalidad;

  const formula = "Eventuales, personas y horas de cada mes, según la fecha de inicio del eventual";
  const notas = [
    "Un eventual que cruza dos meses se atribuye completo al mes en que empezó, así que las horas de un trabajo largo se concentran en su mes de arranque.",
    "Las personas del mes son legajos distintos: quien participó en dos eventuales del mismo mes cuenta una vez.",
    "Los meses sin eventuales aparecen en cero. Solo entran eventuales finalizados con fecha de inicio; las horas suman solo los que tienen horas importadas.",
  ];
  const fuente = "Fecha de inicio del eventual y campo horasBrowix.";

  if (meses.length === 0) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-9 text-center">
          <p className="font-display text-lg font-bold text-slate-600">Todavía no hay datos por mes</p>
          <p className="mx-auto mt-2 max-w-md text-xs text-slate-500">
            Hace falta al menos un eventual finalizado con fecha de inicio.
          </p>
        </div>
        <ComoSeCalcula formula={formula} notas={notas} fuente={fuente} />
      </div>
    );
  }

  const totalEventuales = meses.reduce((acc, m) => acc + m.eventuales, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metrica
          etiqueta="Mes de mayor carga"
          valor={pico ? pico.horas : null}
          unidad="hs"
          tamano="grande"
          decimales={0}
          ayuda={pico ? `${pico.etiqueta}, por horas trabajadas` : undefined}
        />
        <Metrica
          etiqueta="Eventuales por mes"
          valor={stats.media}
          tono="blue"
          ayuda={`Máximo ${formatNumero(stats.max, 0)} en un mes`}
        />
        <Metrica etiqueta="Meses abarcados" valor={meses.length} decimales={0} tono="slate" />
        <Metrica etiqueta="Eventuales medidos" valor={totalEventuales} decimales={0} tono="slate" />
      </div>

      <GraficoMensual titulo="Eventuales por mes" dato="eventuales" unidad="eventual(es)" meses={meses} color={VIZ.s1} />
      <GraficoMensual titulo="Personas por mes" dato="personas" unidad="persona(s)" meses={meses} color={VIZ.s3} />
      <GraficoMensual titulo="Horas trabajadas por mes" dato="horas" unidad="hs" meses={meses} color={VIZ.s4} />

      <ComoSeCalcula formula={formula} notas={notas} fuente={fuente} />
    </div>
  );
}
