import StatCard from "./components/StatCard";
import LineTrendChart from "./components/LineTrendChart";
import GroupedBarChart from "./components/GroupedBarChart";
import CycleTimeChart from "./components/CycleTimeChart";
import RankingTable from "./components/RankingTable";
import PeriodoFilter from "./components/PeriodoFilter";
import { VIZ } from "./colors";

function Panel({ title, children }) {
  return (
    <div className="rounded-2xl bg-white p-3 shadow">
      <h3 className="mb-1 text-sm font-semibold text-gray-800">{title}</h3>
      {children}
    </div>
  );
}

function pct(value) {
  return value === null || value === undefined ? "—" : `${value}%`;
}

export default function SeccionPeriodo({ data, loading, error, rango, onRangoChange }) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-kazaro-navy">Período</h2>
          <p className="text-xs text-gray-500">Solo esta sección se ve afectada por el filtro de fecha.</p>
        </div>
        <PeriodoFilter value={rango} onChange={onRangoChange} />
      </div>

      {error ? <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {!data ? (
        loading ? <p className="text-sm text-gray-500">Cargando estadísticas del período...</p> : null
      ) : (
        <div className="space-y-3">
          {loading ? <p className="text-xs text-gray-400">Actualizando período...</p> : null}

          <Panel title="Tendencia de creación de pedidos (por semana)">
            <LineTrendChart data={data.tendenciaCreacion} xKey="semana" series={[{ key: "cantidad", label: "Pedidos creados", color: VIZ.s1 }]} />
          </Panel>

          <Panel title="Tiempo de ciclo por etapa (pedidos creados en el rango)">
            <CycleTimeChart data={data.tiempoCicloPorEtapa} />
          </Panel>

          <Panel title="Faltantes y cancelación (pedidos cerrados/cancelados en el rango)">
            <div className="mb-2 grid grid-cols-2 gap-2 text-xs">
              <StatCard label="% Cancelación" value={pct(data.faltantesYCancelacion.pctCancelacion)} tone="critical" />
              <StatCard label="% Faltantes" value={pct(data.faltantesYCancelacion.pctFaltantes)} tone="warning" />
            </div>
            <LineTrendChart
              data={data.faltantesYCancelacion.mensual}
              xKey="mes"
              unit="%"
              series={[
                { key: "pctCancelacion", label: "% Cancelación", color: VIZ.s7 },
                { key: "pctFaltantes", label: "% Faltantes", color: VIZ.s5 },
              ]}
            />
          </Panel>

          <div className="grid gap-3 md:grid-cols-2">
            <Panel title="Top 10 servicios por volumen de pedidos">
              <RankingTable
                columns={[
                  { key: "nombre", label: "Servicio" },
                  { key: "cantidad", label: "Pedidos", align: "right" },
                ]}
                rows={data.rankingServicios}
              />
            </Panel>
            <Panel title="Top 10 supervisores por volumen de pedidos">
              <RankingTable
                columns={[
                  { key: "nombre", label: "Supervisor" },
                  { key: "cantidad", label: "Pedidos", align: "right" },
                ]}
                rows={data.rankingSupervisores}
              />
            </Panel>
          </div>

          <Panel title="Rotación de máquinas entre servicios (movimientos individuales + masivos)">
            <LineTrendChart
              data={data.rotacionMaquinas.tendenciaMensual}
              xKey="mes"
              series={[{ key: "cantidad", label: "Movimientos", color: VIZ.s6 }]}
            />
            <div className="mt-2">
              <RankingTable
                columns={[
                  { key: "maquinaId", label: "Máquina" },
                  { key: "tipo", label: "Tipo" },
                  { key: "modelo", label: "Modelo" },
                  { key: "movimientos", label: "Movimientos", align: "right" },
                ]}
                rows={data.rotacionMaquinas.topMaquinas}
              />
            </div>
          </Panel>

          <Panel title="Tiempo promedio en taller por tipo de máquina">
            <GroupedBarChart
              data={data.tiempoPromedioTallerPorTipo}
              xKey="tipo"
              unit="d"
              series={[{ key: "promedioDias", label: "Días promedio", color: VIZ.s2 }]}
            />
          </Panel>

          <Panel title="Movimientos de taller por mes">
            <GroupedBarChart
              data={data.movimientosTallerMensual}
              xKey="mes"
              series={[
                { key: "ingresos", label: "Ingresos", color: VIZ.s3 },
                { key: "egresos", label: "Egresos", color: VIZ.s8 },
              ]}
            />
          </Panel>

          <Panel title="Top 10 máquinas con más ingresos a taller">
            <RankingTable
              columns={[
                { key: "maquinaId", label: "Máquina" },
                { key: "tipo", label: "Tipo" },
                { key: "modelo", label: "Modelo" },
                { key: "ingresos", label: "Ingresos", align: "right" },
              ]}
              rows={data.rankingIngresosTaller}
            />
          </Panel>
        </div>
      )}
    </section>
  );
}
