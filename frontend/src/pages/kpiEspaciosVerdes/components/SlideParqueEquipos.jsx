import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { VIZ } from "../../estadisticas/colors";
import { formatNumero, formatPorcentaje, acortar } from "../formato";
import useEsAngosto from "../useEsAngosto";
import ComoSeCalcula from "./ComoSeCalcula";
import Metrica from "./Metrica";

export default function SlideParqueEquipos({ parqueEquipos }) {
  const { equipos, eventualesConEquipos, unidadesTotales, unidadesIdentificadas } = parqueEquipos;
  const angosto = useEsAngosto();

  if (equipos.length === 0) {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
          <p className="font-display text-lg font-bold text-slate-600">Todavía no hay equipos cargados</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            Ningún eventual finalizado tiene máquinas utilizadas registradas.
          </p>
        </div>
        <ComoSeCalcula formula="Cantidad de eventuales en los que aparece cada tipo de máquina" />
      </div>
    );
  }

  const datos = equipos.map((e) => ({ ...e, etiqueta: acortar(e.tipo, angosto ? 14 : 24) }));
  const masUsado = equipos[0];
  const porcentajeIdentificadas =
    unidadesTotales > 0 ? (unidadesIdentificadas / unidadesTotales) * 100 : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metrica etiqueta="Tipos de máquina" valor={equipos.length} decimales={0} tamano="grande" ayuda="Distintos, en toda la operación" />
        <Metrica
          etiqueta="Unidades desplegadas"
          valor={unidadesTotales}
          decimales={0}
          tono="blue"
          tamano="grande"
          ayuda={`En ${eventualesConEquipos} eventual(es)`}
        />
        <Metrica
          etiqueta="Promedio por eventual"
          valor={eventualesConEquipos > 0 ? unidadesTotales / eventualesConEquipos : null}
          unidad="u."
          tono="navy"
          ayuda="Máquinas por trabajo"
        />
        <Metrica
          etiqueta="Con máquina identificada"
          valor={porcentajeIdentificadas}
          unidad="%"
          tono={porcentajeIdentificadas !== null && porcentajeIdentificadas >= 50 ? "green" : "amber"}
          ayuda={`${unidadesIdentificadas} de ${unidadesTotales} apuntan a una máquina del inventario`}
        />
      </div>

      <div className="rounded-2xl border border-kazaro-ice bg-gradient-to-br from-kazaro-mist to-white p-4 sm:p-5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-kazaro-cyan">La que más trabaja</p>
        <p className="mt-1 font-display text-2xl font-extrabold text-kazaro-navy sm:text-3xl">{masUsado.tipo}</p>
        <p className="mt-1 text-sm text-slate-600">
          Presente en <strong className="font-semibold text-kazaro-deep">{masUsado.eventuales} de {eventualesConEquipos}</strong>{" "}
          eventuales ({formatPorcentaje(masUsado.presencia)}), con{" "}
          <strong className="font-semibold text-kazaro-deep">{formatNumero(masUsado.promedioPorEventual)} unidades</strong> en
          promedio cada vez.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
        <h3 className="font-display text-base font-extrabold text-kazaro-navy">En cuántos trabajos aparece cada máquina</h3>
        <p className="mb-3 mt-1 text-xs text-slate-500">
          La barra es la cantidad de eventuales donde se usó el tipo. La etiqueta agrega cuántas unidades
          se llevaron en promedio.
        </p>
        <ResponsiveContainer width="100%" height={Math.max(160, datos.length * 38)}>
          <BarChart data={datos} layout="vertical" margin={{ left: 4, right: angosto ? 34 : 130, top: 4, bottom: 4 }}>
            <XAxis type="number" hide allowDecimals={false} domain={[0, "dataMax"]} />
            <YAxis
              type="category"
              dataKey="etiqueta"
              width={angosto ? 92 : 170}
              tick={{ fontSize: angosto ? 10 : 11, fill: "#475569" }}
              stroke="#e2e8f0"
            />
            <Tooltip
              cursor={{ fill: "#f1f5f9" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0]?.payload;
                if (!p) return null;
                return (
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
                    <p className="font-semibold text-kazaro-navy">{p.tipo}</p>
                    <p className="mt-1 text-slate-600">
                      En {p.eventuales} de {eventualesConEquipos} eventuales ({formatPorcentaje(p.presencia)})
                    </p>
                    <p className="text-slate-500">
                      {p.unidadesTotales} unidades en total · {formatNumero(p.promedioPorEventual)} por eventual
                    </p>
                  </div>
                );
              }}
            />
            <Bar dataKey="eventuales" radius={[0, 4, 4, 0]} barSize={18} isAnimationActive animationDuration={700}>
              {datos.map((d) => (
                <Cell key={d.tipo} fill={d.presencia >= 50 ? VIZ.s1 : VIZ.s3} />
              ))}
              {/* En pantalla angosta no entra el promedio al lado de la barra;
                  queda solo el conteo y el promedio se lee en la tabla. */}
              <LabelList
                dataKey="eventuales"
                position="right"
                content={({ x, y, width, height, value, index }) => (
                  <text
                    x={Number(x) + Number(width) + 8}
                    y={Number(y) + Number(height) / 2}
                    dominantBaseline="middle"
                    style={{ fontSize: angosto ? 10 : 11, fill: "#475569", fontWeight: 600 }}
                  >
                    {angosto
                      ? value
                      : `${value} trab. · ${formatNumero(datos[index].promedioPorEventual)} u. prom.`}
                  </text>
                )}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
        <h3 className="mb-3 font-display text-base font-extrabold text-kazaro-navy">Detalle del parque</h3>
        {/* min-w para que en pantallas angostas la tabla scrollee dentro de su
            caja en vez de comprimir las columnas hasta cortar los títulos. */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1.5 pr-3 font-medium">Tipo de máquina</th>
                <th className="py-1.5 pr-3 text-right font-medium">Eventuales</th>
                <th className="py-1.5 pr-3 text-right font-medium">Presencia</th>
                <th className="py-1.5 pr-3 text-right font-medium">Unidades</th>
                <th className="py-1.5 pr-3 text-right font-medium">Prom. por eventual</th>
              </tr>
            </thead>
            <tbody>
              {datos.map((d) => (
                <tr key={d.tipo} className="border-t border-slate-100">
                  <td className="py-1.5 pr-3" title={d.tipo}>{acortar(d.tipo, 34)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{d.eventuales}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{formatPorcentaje(d.presencia)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{d.unidadesTotales}</td>
                  <td className="py-1.5 pr-3 text-right font-semibold tabular-nums">{formatNumero(d.promedioPorEventual)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ComoSeCalcula
        formula="Por cada tipo: en cuántos eventuales aparece, y cuántas unidades se usaron en promedio"
        notas={[
          "El promedio se calcula solo sobre los eventuales donde ese tipo se usó, no sobre todos: un tipo presente en 2 trabajos con 3 unidades cada vez promedia 3, no 0,5.",
          `La presencia se mide sobre los ${eventualesConEquipos} eventuales que tienen máquinas cargadas, no sobre el total de finalizados.`,
          "Cuando el supervisor elige máquinas puntuales queda registrado el identificador de cada una; cuando carga solo tipo y cantidad, no. Esa diferencia es la métrica «con máquina identificada», y es lo que hoy impide llegar al costo de amortización por máquina.",
        ]}
        fuente="Campo maquinasUtilizadas del eventual."
      />
    </div>
  );
}
