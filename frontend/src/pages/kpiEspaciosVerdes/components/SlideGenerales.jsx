import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { VIZ } from "../../estadisticas/colors";
import { formatNumero, formatPorcentaje, acortar } from "../formato";
import useEsAngosto from "../useEsAngosto";
import ComoSeCalcula from "./ComoSeCalcula";
import Metrica from "./Metrica";

// Orden fijo de la paleta categórica: la categoría 1 es siempre el mismo color,
// aunque cambie la cantidad de categorías con horas cargadas.
const COLORES_CATEGORIA = [VIZ.s1, VIZ.s2, VIZ.s3, VIZ.s4, VIZ.s5, VIZ.s6, VIZ.s7, VIZ.s8];

export default function SlideGenerales({ alcance, generales }) {
  const { horasHombre, personas, categorias, volumen } = generales;
  const angosto = useEsAngosto();
  const trabajosRegistrados = volumen.reduce((acc, v) => acc + v.trabajos, 0);

  const datosCategorias = categorias.map((c, i) => ({
    ...c,
    etiqueta: acortar(c.categoria, angosto ? 14 : 26),
    color: COLORES_CATEGORIA[i % COLORES_CATEGORIA.length],
  }));

  // Concentración: cuánto pesan las dos categorías que más horas aportan.
  const top2 = categorias.slice(0, 2).reduce((acc, c) => acc + (c.porcentaje || 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metrica
          etiqueta="Eventuales de EV"
          valor={alcance.total}
          decimales={0}
          tamano="grande"
          ayuda={`${alcance.finalizados} cerrados · ${alcance.enCurso} en curso`}
        />
        <Metrica
          etiqueta="Horas-hombre"
          valor={horasHombre}
          unidad="hs"
          tono="blue"
          tamano="grande"
          ayuda="Sobre los eventuales ya cerrados"
        />
        <Metrica
          etiqueta="Personas distintas"
          valor={personas}
          decimales={0}
          tono="navy"
          ayuda={`En ${categorias.length} categoría(s)`}
        />
        <Metrica
          etiqueta="Trabajos registrados"
          valor={trabajosRegistrados}
          decimales={0}
          tono="navy"
          ayuda={`En ${volumen.length} unidad(es) de medida`}
        />
      </div>

      {/* Volumen de operación, siempre separado por unidad: sumar m² con m³ o
          con árboles podados no significa nada. */}
      <section className="rounded-2xl border border-slate-200 p-4 sm:p-6">
        <h3 className="font-display text-lg font-extrabold text-kazaro-navy">Volumen de operación</h3>
        <p className="mb-3 mt-1 text-xs text-slate-500">
          Cuánto se produjo en total. Cada unidad va por separado porque miden cosas distintas.
        </p>
        {volumen.length === 0 ? (
          <p className="text-sm text-slate-500">Todavía no hay trabajos cargados.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {volumen.map((v) => (
              <div key={v.unidad} className="rounded-xl bg-gradient-to-br from-kazaro-mist to-white p-5 ring-1 ring-kazaro-ice">
                <p className="font-display text-2xl font-extrabold tabular-nums text-kazaro-deep">
                  {formatNumero(v.total, 0)}
                </p>
                <p className="text-sm font-semibold text-slate-600">{v.unidadLabel}</p>
                <p className="mt-1.5 text-sm text-slate-500">{v.trabajos} trabajo(s)</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 p-4 sm:p-6">
        <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-lg font-extrabold text-kazaro-navy">Horas-hombre por categoría</h3>
          {top2 > 0 ? (
            <p className="text-sm text-slate-500">
              Las dos primeras concentran{" "}
              <strong className="font-semibold text-kazaro-deep">{formatPorcentaje(top2)}</strong> de las horas
            </p>
          ) : null}
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Con qué calificación se hizo el trabajo. Es la base sobre la que se podría costear la mano de
          obra el día que exista una tarifa por categoría.
        </p>

        {datosCategorias.length === 0 ? (
          <p className="text-sm text-slate-500">Todavía no hay horas importadas.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={Math.max(160, datosCategorias.length * 40)}>
              <BarChart data={datosCategorias} layout="vertical" margin={{ left: 4, right: angosto ? 60 : 90, top: 4, bottom: 4 }}>
                <XAxis type="number" hide domain={[0, "dataMax"]} />
                <YAxis
                  type="category"
                  dataKey="etiqueta"
                  width={angosto ? 92 : 185}
                  tick={{ fontSize: angosto ? 11 : 12, fill: "#475569" }}
                  stroke="#e2e8f0"
                />
                <Tooltip
                  cursor={{ fill: "#f1f5f9" }}
                  formatter={(valor, _n, item) => [
                    `${formatNumero(valor, 1)} hs (${formatPorcentaje(item?.payload?.porcentaje)})`,
                    "Horas",
                  ]}
                  contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13 }}
                />
                <Bar dataKey="horas" radius={[0, 4, 4, 0]} barSize={20} isAnimationActive animationDuration={700}>
                  {datosCategorias.map((c) => (
                    <Cell key={c.categoria} fill={c.color} />
                  ))}
                  {/* Etiqueta directa en cada barra: los tonos claros de la
                      paleta no llegan a 3:1 contra el blanco, así que el valor
                      no puede quedar codificado solo en el color. */}
                  <LabelList
                    dataKey="horas"
                    position="right"
                    formatter={(v) => `${formatNumero(v, 1)} hs`}
                    style={{ fontSize: 12, fill: "#475569", fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-500">
                  <tr>
                    <th className="py-1.5 pr-3 font-medium">Categoría</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Horas</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Participación</th>
                  </tr>
                </thead>
                <tbody>
                  {datosCategorias.map((c) => (
                    <tr key={c.categoria} className="border-t border-slate-100">
                      <td className="py-1.5 pr-3">
                        <span className="mr-2.5 inline-block h-3 w-3 rounded-sm align-middle" style={{ background: c.color }} />
                        {c.categoria}
                      </td>
                      <td className="py-1.5 pr-3 text-right font-semibold tabular-nums">{formatNumero(c.horas, 1)}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{formatPorcentaje(c.porcentaje)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <ComoSeCalcula
        formula="Suma de los datos de cierre de todos los eventuales de Espacios Verdes finalizados"
        notas={[
          "Solo entran los eventuales finalizados: los campos de cierre (horas, trabajos, insumos, máquinas) recién se completan al cerrar, así que un eventual en curso mezclaría datos a medio cargar.",
          "Las horas-hombre son las horas teóricas de jornada fichadas en el sistema de marcación, filtrando los días de franco o licencia, que vienen con 0 minutos.",
          "Personas distintas cuenta legajos únicos en todos los eventuales, así que alguien que trabajó en tres eventuales cuenta una sola vez.",
        ]}
        fuente="Campos horasBrowix y trabajosRealizados del eventual."
      />
    </div>
  );
}
