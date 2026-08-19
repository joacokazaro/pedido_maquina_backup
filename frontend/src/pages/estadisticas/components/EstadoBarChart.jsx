import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Barra horizontal por categoría de estado — preferida sobre un donut para
// 6-7 categorías, que es difícil de leer en forma de torta. `data` es
// [{estado, cantidad}], `colorMap`/`labelMap` son los objetos de colors.js
// para el dominio correspondiente (pedido o máquina).
export default function EstadoBarChart({ data, colorMap, labelMap, height = 220 }) {
  const chartData = data.map((d) => ({ ...d, label: labelMap[d.estado] || d.estado }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="label" width={140} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(value) => [value, "Cantidad"]} />
        <Bar dataKey="cantidad" radius={[0, 4, 4, 0]}>
          {chartData.map((entry) => (
            <Cell key={entry.estado} fill={colorMap[entry.estado] || "#94a3b8"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
