import StatCard from "./components/StatCard";
import EstadoBarChart from "./components/EstadoBarChart";
import StackedBarMini from "./components/StackedBarMini";
import { COLOR_ESTADO_PEDIDO, COLOR_ESTADO_MAQUINA, LABEL_ESTADO_PEDIDO, LABEL_ESTADO_MAQUINA } from "./colors";

export default function SeccionTiempoReal({ data, loading, error, onActualizar }) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-bold text-kazaro-navy">Tiempo real</h2>
          <p className="text-xs text-gray-500">Foto del momento — se actualiza al cargar la página o al refrescar.</p>
        </div>
        <button
          type="button"
          onClick={onActualizar}
          disabled={loading}
          className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-800 transition hover:bg-slate-200 disabled:opacity-60"
        >
          {loading ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      {error ? <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {!data ? (
        loading ? <p className="text-sm text-gray-500">Cargando estadísticas...</p> : null
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
            <StatCard label="Pedidos abiertos" value={data.pedidosAbiertos.total} tone="accent" />
            <StatCard label="Máquinas disponibles" value={data.stockMaquinas.porEstado.find((e) => e.estado === "disponible")?.cantidad ?? 0} tone="positive" />
            <StatCard label="Máquinas en taller" value={data.stockMaquinas.porEstado.find((e) => e.estado === "taller")?.cantidad ?? 0} tone="warning" />
            <StatCard label="Total flota" value={data.stockMaquinas.total} tone="neutral" />
          </div>

          <div className="mb-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl bg-white p-3 shadow">
              <h3 className="mb-1 text-sm font-semibold text-gray-800">Pedidos abiertos por estado</h3>
              <EstadoBarChart data={data.pedidosAbiertos.porEstado} colorMap={COLOR_ESTADO_PEDIDO} labelMap={LABEL_ESTADO_PEDIDO} />
            </div>
            <div className="rounded-2xl bg-white p-3 shadow">
              <h3 className="mb-1 text-sm font-semibold text-gray-800">Stock de máquinas por estado</h3>
              <EstadoBarChart data={data.stockMaquinas.porEstado} colorMap={COLOR_ESTADO_MAQUINA} labelMap={LABEL_ESTADO_MAQUINA} />
            </div>
          </div>

          <div className="rounded-2xl bg-white p-3 shadow">
            <h3 className="mb-2 text-sm font-semibold text-gray-800">Composición de stock por tipo de máquina</h3>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-gray-500">
                    <th className="py-1.5 pr-3 font-medium">Tipo</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Total</th>
                    <th className="py-1.5 pr-3 font-medium">Composición</th>
                  </tr>
                </thead>
                <tbody>
                  {data.composicionPorTipo.map((row) => (
                    <tr key={row.tipo} className="border-t border-gray-100">
                      <td className="py-1.5 pr-3">{row.tipo}</td>
                      <td className="py-1.5 pr-3 text-right font-semibold">{row.total}</td>
                      <td className="w-1/3 py-1.5 pr-3">
                        <StackedBarMini porEstado={row} total={row.total} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
