import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { VIZ } from "../colors";

const LABEL_ETAPA = {
  CREADO_PREPARADO: "Creado → Preparado",
  PREPARADO_ENTREGADO: "Preparado → Entregado",
  ENTREGADO_CERRADO: "Entregado → Cerrado",
};

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const muestras = payload[0]?.payload?.muestras ?? 0;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow">
      <p className="mb-1 font-semibold">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.value ?? "sin datos"} hs
        </p>
      ))}
      <p className="mt-1 text-gray-500">{muestras} pedido(s) con dato</p>
    </div>
  );
}

// Tiempo de ciclo por etapa: mediana y p90, en horas. El tooltip muestra la
// cantidad de muestras porque una mediana sobre pocos pedidos no dice mucho.
export default function CycleTimeChart({ data, height = 240 }) {
  const chartData = data.map((d) => ({ ...d, etapaLabel: LABEL_ETAPA[d.etapa] || d.etapa }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ left: 0, right: 16, top: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="etapaLabel" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} unit="h" />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="medianaHoras" name="Mediana" fill={VIZ.s1} radius={[4, 4, 0, 0]} />
        <Bar dataKey="p90Horas" name="P90" fill={VIZ.s4} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
