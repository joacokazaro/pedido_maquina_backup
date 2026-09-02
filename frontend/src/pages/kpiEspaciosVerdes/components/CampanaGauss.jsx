import { useMemo } from "react";
import {
  Area,
  ComposedChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { VIZ } from "../../estadisticas/colors";
import { formatNumero, acortar } from "../formato";

const PUNTOS_CURVA = 121;

/** Densidad de una normal de media `mu` y desvío `sigma`. */
function densidad(x, mu, sigma) {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
}

// Recharts clona el elemento pasado en `content` agregándole `active` y
// `payload`, así que las bandas y la unidad llegan como props normales.
function TooltipCampana({ active, payload, banda1, unidadRatio }) {
  if (!active || !payload?.length) return null;
  const punto = payload[0]?.payload;
  if (!punto) return null;

  const dentro = banda1 && punto.x >= banda1.desde && punto.x <= banda1.hasta;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs shadow-lg">
      <p className="font-semibold text-kazaro-navy">
        {formatNumero(punto.x)} {unidadRatio}
      </p>
      {punto.info ? (
        <p className="mt-1 max-w-[260px] font-medium text-slate-700">{punto.info.nombre}</p>
      ) : null}
      <p className="mt-1 text-slate-500">
        {dentro ? "Dentro de lo esperable (±1σ)" : "Fuera de lo habitual"}
      </p>
    </div>
  );
}

/**
 * Campana de la distribución de un rendimiento, con la banda media ± 1 desvío
 * sombreada y cada eventual apoyado sobre la curva en su valor real.
 *
 * La curva es el **modelo** (una normal ajustada a la media y el desvío de la
 * muestra), no los datos: con una decena de casos no hay forma de afirmar que
 * el rendimiento se distribuya así. Los puntos sí son los datos, y por eso van
 * dibujados encima — se ve de una si la muestra acompaña a la campana o no.
 *
 * El eje Y es densidad de probabilidad, que no significa nada para quien lee
 * el tablero: va oculto a propósito. Lo que se lee es el eje X.
 */
export default function CampanaGauss({ stats, bandas, muestras, unidadRatio, altura = 270 }) {
  const { media, desvio } = stats;

  const { datos, dominio, banda1 } = useMemo(() => {
    if (!Number.isFinite(media) || !Number.isFinite(desvio) || desvio <= 0) {
      return { datos: [], dominio: [0, 1], banda1: null };
    }

    const valores = muestras.map((m) => m.valor);
    // La campana teórica se extiende ±3,2σ, pero se recorta en 0 cuando la
    // magnitud no puede ser negativa (no existen m²/hora negativos) y se
    // estira si algún eventual real cae fuera de ese rango.
    const minTeorico = media - 3.2 * desvio;
    const inicio = Math.min(Math.max(0, minTeorico), ...valores);
    const fin = Math.max(media + 3.2 * desvio, ...valores);
    const paso = (fin - inicio) / (PUNTOS_CURVA - 1);

    const curva = Array.from({ length: PUNTOS_CURVA }, (_, i) => {
      const x = inicio + i * paso;
      return { x, y: densidad(x, media, desvio) };
    });

    // Cada eventual se inserta como un punto propio en su x exacta, para que
    // el marcador quede sobre la curva y no en el punto muestreado más cercano.
    const puntos = muestras.map((m) => ({
      x: m.valor,
      y: densidad(m.valor, media, desvio),
      muestra: densidad(m.valor, media, desvio),
      info: m,
    }));

    const todos = [...curva, ...puntos].sort((a, b) => a.x - b.x);

    return {
      datos: todos,
      dominio: [inicio, fin],
      banda1: bandas.find((b) => b.sigmas === 1) || null,
    };
  }, [media, desvio, muestras, bandas]);

  if (!datos.length) {
    return (
      <div className="flex h-44 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center text-sm text-slate-500">
        Se necesitan al menos dos eventuales con este trabajo medido para poder calcular una
        distribución.
      </div>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={altura}>
        <ComposedChart data={datos} margin={{ top: 32, right: 20, bottom: 4, left: 8 }}>
          <defs>
            <linearGradient id="gradCampana" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={VIZ.s1} stopOpacity={0.28} />
              <stop offset="100%" stopColor={VIZ.s1} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <XAxis
            type="number"
            dataKey="x"
            domain={dominio}
            tickFormatter={(v) => formatNumero(v)}
            tick={{ fontSize: 12, fill: "#64748b" }}
            stroke="#cbd5e1"
            label={{ value: unidadRatio, position: "insideBottomRight", offset: -2, fontSize: 12, fill: "#94a3b8" }}
          />
          {/* Densidad: se calcula para dibujar la curva pero no se muestra. */}
          <YAxis hide domain={[0, "dataMax"]} />

          {banda1 ? (
            <ReferenceArea
              x1={banda1.desde}
              x2={banda1.hasta}
              fill={VIZ.s1}
              fillOpacity={0.1}
              stroke={VIZ.s1}
              strokeOpacity={0.25}
              strokeDasharray="3 3"
            />
          ) : null}

          <Area
            type="monotone"
            dataKey="y"
            stroke={VIZ.s1}
            strokeWidth={2}
            fill="url(#gradCampana)"
            dot={false}
            activeDot={false}
            isAnimationActive
            animationDuration={700}
          />

          <ReferenceLine
            x={media}
            stroke={VIZ.s1}
            strokeWidth={2}
            strokeDasharray="5 4"
            label={{ value: `media ${formatNumero(media)}`, position: "top", fontSize: 12, fill: VIZ.s1, fontWeight: 600 }}
          />
          {banda1 ? (
            <>
              <ReferenceLine x={banda1.desde} stroke="#94a3b8" strokeDasharray="2 3" label={{ value: "−1σ", position: "top", fontSize: 11, fill: "#94a3b8" }} />
              <ReferenceLine x={banda1.hasta} stroke="#94a3b8" strokeDasharray="2 3" label={{ value: "+1σ", position: "top", fontSize: 11, fill: "#94a3b8" }} />
            </>
          ) : null}

          <Scatter
            dataKey="muestra"
            fill={VIZ.s2}
            stroke="#ffffff"
            strokeWidth={2}
            shape="circle"
            isAnimationActive={false}
          />

          <Tooltip
            content={<TooltipCampana banda1={banda1} unidadRatio={unidadRatio} />}
            cursor={{ stroke: "#cbd5e1", strokeDasharray: "3 3" }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Dos elementos visuales distintos: la identidad no puede quedar solo en
          el color, así que van nombrados acá. */}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-slate-500">
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-5 rounded" style={{ background: VIZ.s1 }} />
          Distribución esperada
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-full ring-2 ring-white" style={{ background: VIZ.s2 }} />
          Cada eventual medido
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-5 rounded-sm" style={{ background: VIZ.s1, opacity: 0.18 }} />
          Banda ±1σ
        </span>
      </div>

      {/* Los mismos datos en tabla: la lectura no puede depender del gráfico. */}
      <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70">
        <summary className="cursor-pointer px-4 py-2.5 text-xs font-semibold text-slate-600">
          Ver los {muestras.length} eventuales medidos
        </summary>
        <div className="overflow-x-auto px-4 pb-3">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1.5 pr-3 font-medium">Eventual</th>
                <th className="py-1.5 pr-3 text-right font-medium">Producción</th>
                <th className="py-1.5 pr-3 text-right font-medium">Horas-hombre</th>
                <th className="py-1.5 pr-3 text-right font-medium">Rendimiento</th>
              </tr>
            </thead>
            <tbody>
              {muestras.map((m) => {
                const dentro = banda1 && m.valor >= banda1.desde && m.valor <= banda1.hasta;
                return (
                  <tr key={m.id} className="border-t border-slate-200">
                    <td className="py-1.5 pr-3">
                      <span title={m.nombre}>{acortar(m.nombre, 34)}</span>
                      {m.mixto ? (
                        <span
                          className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700"
                          title="Este eventual también registró otros trabajos, así que sus horas no son todas de este trabajo."
                        >
                          mixto
                        </span>
                      ) : null}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{formatNumero(m.produccion)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{formatNumero(m.horas)}</td>
                    <td className={`py-1.5 pr-3 text-right font-semibold tabular-nums ${dentro ? "text-slate-700" : "text-amber-700"}`}>
                      {formatNumero(m.valor)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
