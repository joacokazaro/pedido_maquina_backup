import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { VIZ } from "../../estadisticas/colors";
import { formatNumero, formatRango, acortar } from "../formato";
import useEsAngosto from "../useEsAngosto";
import CampanaGauss from "./CampanaGauss";
import ComoSeCalcula from "./ComoSeCalcula";
import Metrica from "./Metrica";

/**
 * Clasifica la dispersión de la muestra a partir del coeficiente de variación.
 * Los cortes son convención de lectura, no una regla estadística: sirven para
 * traducir un CV a una frase, no para decidir nada por sí solos.
 */
function leerDispersion(cv) {
  if (cv === null || cv === undefined) return null;
  if (cv < 15) return { nivel: "pareja", tono: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" };
  if (cv < 35) return { nivel: "moderada", tono: "text-kazaro-deep", bg: "bg-kazaro-mist border-kazaro-ice" };
  return { nivel: "alta", tono: "text-amber-700", bg: "bg-amber-50 border-amber-200" };
}

/**
 * Slide de un indicador de tasa (producción por hora-hombre). Se usa para
 * desmalezado, retiro de poda y combustible: los tres son la misma cuenta con
 * distinta magnitud arriba.
 *
 * `sentido` cambia solo la lectura, nunca el cálculo: en desmalezado y poda
 * más es mejor, en combustible más es peor.
 */
export default function SlideRendimiento({ bloque, sentido = "mas-es-mejor", formula, notas, fuente }) {
  const { stats, bandas, muestras, unidadRatio, unidadProduccion, mixtos, excluidos, dentroDeUnDesvio, brecha } = bloque;
  const angosto = useEsAngosto();
  const banda1 = bandas.find((b) => b.sigmas === 1) || null;
  const dispersion = leerDispersion(stats.cv);
  const masEsMejor = sentido === "mas-es-mejor";

  if (stats.n === 0) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-9 text-center">
          <p className="font-display text-lg font-bold text-slate-600">Todavía no hay datos para medir esto</p>
          <p className="mx-auto mt-2 max-w-md text-xs text-slate-500">
            Hace falta al menos un eventual finalizado que tenga este trabajo cargado en su unidad
            correcta y las horas importadas.
          </p>
        </div>
        <ComoSeCalcula formula={formula} notas={notas} fuente={fuente} />
      </div>
    );
  }

  // El ranking usa la banda ±1σ como semáforo: lo que cae adentro es
  // comportamiento habitual, lo que cae afuera es lo que hay que ir a mirar.
  const ranking = muestras.map((m) => {
    const dentro = banda1 && m.valor >= banda1.desde && m.valor <= banda1.hasta;
    const porEncima = banda1 && m.valor > banda1.hasta;
    const bueno = masEsMejor ? porEncima : banda1 && m.valor < banda1.desde;
    return {
      ...m,
      etiqueta: acortar(m.nombre, angosto ? 14 : 24),
      color: dentro ? VIZ.s1 : bueno ? VIZ.good : VIZ.warning,
    };
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metrica
          etiqueta="Promedio"
          valor={stats.media}
          unidad={unidadRatio}
          tono="navy"
          tamano="grande"
          ayuda={`Mediana ${formatNumero(stats.mediana)}`}
        />
        <Metrica
          etiqueta="Desvío estándar (σ)"
          valor={stats.desvio}
          unidad={unidadRatio}
          tono="blue"
          ayuda={stats.cv !== null ? `${formatNumero(stats.cv, 1)}% de la media` : "Sin dispersión calculable"}
        />
        <Metrica
          etiqueta="Eventuales medidos"
          valor={stats.n}
          decimales={0}
          tono="slate"
          ayuda={mixtos > 0 ? `${mixtos} con más de un tipo de trabajo` : "Todos con un solo tipo de trabajo"}
        />
        <Metrica
          etiqueta="Brecha mejor / peor"
          valor={brecha}
          unidad="×"
          tono={brecha !== null && brecha >= 3 ? "amber" : "navy"}
          ayuda={`De ${formatNumero(stats.min)} a ${formatNumero(stats.max)}`}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 p-4 sm:p-6">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-lg font-extrabold text-kazaro-navy">
            Distribución del rendimiento
          </h3>
          {banda1 ? (
            <p className="text-sm text-slate-500">
              El <strong className="font-semibold text-kazaro-deep">68%</strong> de los trabajos debería caer entre{" "}
              <strong className="font-semibold text-kazaro-deep">{formatRango(banda1.desde, banda1.hasta, unidadRatio)}</strong>
            </p>
          ) : null}
        </div>

        <CampanaGauss stats={stats} bandas={bandas} muestras={muestras} unidadRatio={unidadRatio} />

        {dispersion ? (
          <div className={`mt-4 rounded-xl border px-4 py-3 text-sm leading-relaxed ${dispersion.bg}`}>
            <p className="text-slate-700">
              La dispersión es <strong className={`font-bold ${dispersion.tono}`}>{dispersion.nivel}</strong>: el desvío
              estándar es {formatNumero(stats.cv, 1)}% del promedio
              {brecha !== null ? (
                <>
                  {" "}y el mejor trabajo rinde <strong className="font-bold">{formatNumero(brecha, 1)} veces</strong> lo
                  que el peor
                </>
              ) : null}
              .{" "}
              {dentroDeUnDesvio !== null ? (
                <>
                  {dentroDeUnDesvio} de {stats.n} eventuales caen dentro de la banda ±1σ.{" "}
                </>
              ) : null}
              {stats.cv !== null && stats.cv >= 35
                ? "Una diferencia así entre trabajos parecidos no se explica sola: ahí es donde conviene preguntar qué pasó."
                : "Los trabajos rinden parecido entre sí, así que el promedio sirve como referencia para cotizar."}
            </p>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 p-4 sm:p-6">
        <h3 className="font-display text-lg font-extrabold text-kazaro-navy">Eventual por eventual</h3>
        <p className="mb-3 mt-1 text-xs text-slate-500">
          En azul los que están dentro de lo esperable. En color los que se apartan más de un desvío —
          {masEsMejor ? " verde si rindieron por encima, ámbar si quedaron por debajo." : " verde si consumieron menos, ámbar si consumieron de más."}
        </p>
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
              formatter={(valor, _nombre, item) => [
                `${formatNumero(valor)} ${unidadRatio}`,
                `${formatNumero(item?.payload?.produccion)} ${unidadProduccion} en ${formatNumero(item?.payload?.horas)} hs`,
              ]}
              labelFormatter={(_l, payload) => payload?.[0]?.payload?.nombre || ""}
              contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13 }}
            />
            <Bar dataKey="valor" radius={[0, 4, 4, 0]} barSize={19} isAnimationActive animationDuration={700}>
              {ranking.map((r) => (
                <Cell key={r.id} fill={r.color} />
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

      <ComoSeCalcula
        formula={formula}
        notas={[
          ...notas,
          `Desvío estándar muestral (divide por n−1): estos ${stats.n} eventuales son una muestra de la operación, no todos los trabajos posibles.`,
          "La banda ±1σ cubre el 68% de los casos y la de ±2σ el 95%, siempre que el rendimiento se distribuya de forma normal — con esta cantidad de casos es una referencia de lectura, no una certeza.",
          ...(mixtos > 0
            ? [
                `${mixtos} de los ${stats.n} eventuales registraron además otro tipo de trabajo. Como las horas son las totales del eventual, su rendimiento queda subestimado (van marcados como "mixto" en la tabla).`,
              ]
            : []),
          ...(excluidos.length > 0
            ? [`Quedaron afuera ${excluidos.length} eventual(es) con este trabajo pero sin horas importadas: ${excluidos.map((e) => e.nombre).join(", ")}.`]
            : []),
        ]}
        fuente={fuente}
      />
    </div>
  );
}
