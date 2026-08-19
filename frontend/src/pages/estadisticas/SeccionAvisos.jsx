import { useState } from "react";
import StatCard from "./components/StatCard";
import SemaforoBadge from "./components/SemaforoBadge";

function TablaAvisos({ columns, rows, emptyMessage }) {
  if (!rows.length) return <p className="px-1 py-3 text-xs text-gray-500">{emptyMessage}</p>;

  return (
    <div className="max-h-72 overflow-y-auto">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 bg-white">
          <tr className="text-gray-500">
            {columns.map((col) => (
              <th key={col.key} className="py-1.5 pr-3 font-medium">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx} className="border-t border-gray-100">
              {columns.map((col) => (
                <td key={col.key} className="py-1.5 pr-3">
                  {col.render ? col.render(row) : (row[col.key] ?? "-")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SeccionAvisos({ data, loading, error, umbrales, onUmbralesChange }) {
  const [form, setForm] = useState(umbrales);

  return (
    <section>
      <div className="mb-3">
        <h2 className="font-display text-lg font-bold text-kazaro-navy">Avisos</h2>
        <p className="text-xs text-gray-500">Alertas por umbral, independientes del filtro de período.</p>
      </div>

      {error ? <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="mb-3 flex flex-wrap items-end gap-3 rounded-2xl bg-white p-3 shadow text-xs">
        <label className="flex flex-col gap-1">
          <span className="text-gray-500">Días → amarillo</span>
          <input
            type="number"
            min="1"
            value={form.umbralAmarillo}
            onChange={(e) => setForm((f) => ({ ...f, umbralAmarillo: e.target.value }))}
            className="w-20 rounded-lg border border-slate-300 px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-gray-500">Días → rojo</span>
          <input
            type="number"
            min="1"
            value={form.umbralRojo}
            onChange={(e) => setForm((f) => ({ ...f, umbralRojo: e.target.value }))}
            className="w-20 rounded-lg border border-slate-300 px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-gray-500">Ventana vencimientos (días)</span>
          <input
            type="number"
            min="1"
            value={form.diasVentanaVencimiento}
            onChange={(e) => setForm((f) => ({ ...f, diasVentanaVencimiento: e.target.value }))}
            className="w-24 rounded-lg border border-slate-300 px-2 py-1.5"
          />
        </label>
        <button
          type="button"
          onClick={() => onUmbralesChange(form)}
          disabled={loading}
          className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5 font-medium text-slate-800 transition hover:bg-slate-200 disabled:opacity-60"
        >
          Aplicar
        </button>
      </div>

      {!data ? (
        loading ? <p className="text-sm text-gray-500">Cargando avisos...</p> : null
      ) : (
        <>
          <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
            <StatCard label="Pedidos estancados" value={data.pedidosEstancados.total} tone="warning" />
            <StatCard label="Máquinas no devueltas" value={data.maquinasNoDevueltas.total} tone="critical" />
            <StatCard label="Vencimientos próximos" value={data.vencimientosVehiculos.total} tone="warning" />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl bg-white p-3 shadow">
              <h3 className="mb-1 text-sm font-semibold text-gray-800">Pedidos estancados</h3>
              <TablaAvisos
                emptyMessage="No hay pedidos estancados con los umbrales actuales."
                columns={[
                  { key: "pedidoId", label: "Pedido" },
                  { key: "estado", label: "Estado" },
                  { key: "servicio", label: "Servicio" },
                  { key: "diasEnEstado", label: "Días", render: (r) => `${r.diasEnEstado}d` },
                  { key: "semaforo", label: "", render: (r) => <SemaforoBadge semaforo={r.semaforo} /> },
                ]}
                rows={data.pedidosEstancados.items}
              />
            </div>

            <div className="rounded-2xl bg-white p-3 shadow">
              <h3 className="mb-1 text-sm font-semibold text-gray-800">Máquinas no devueltas</h3>
              <TablaAvisos
                emptyMessage="No hay máquinas en estado no_devuelta."
                columns={[
                  { key: "maquinaId", label: "Máquina" },
                  { key: "tipo", label: "Tipo" },
                  { key: "servicio", label: "Servicio" },
                  {
                    key: "diasDesdeEntrega",
                    label: "Antigüedad",
                    render: (r) => (r.diasDesdeEntrega === null ? "—" : `${r.diasDesdeEntrega}d`),
                  },
                ]}
                rows={data.maquinasNoDevueltas.items}
              />
            </div>
          </div>

          <div className="mt-3 rounded-2xl bg-white p-3 shadow">
            <h3 className="mb-1 text-sm font-semibold text-gray-800">Vencimientos próximos de vehículos</h3>
            <TablaAvisos
              emptyMessage="No hay vencimientos dentro de la ventana configurada."
              columns={[
                { key: "patente", label: "Patente" },
                { key: "vehiculo", label: "Vehículo" },
                { key: "empresa", label: "Empresa" },
                { key: "tipoVencimiento", label: "Vencimiento" },
                { key: "diasRestantes", label: "Días", render: (r) => `${r.diasRestantes}d` },
                { key: "semaforo", label: "", render: (r) => <SemaforoBadge semaforo={r.semaforo} /> },
              ]}
              rows={data.vencimientosVehiculos.items}
            />
          </div>
        </>
      )}
    </section>
  );
}
