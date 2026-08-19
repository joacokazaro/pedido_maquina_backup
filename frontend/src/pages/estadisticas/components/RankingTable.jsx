// Tabla top-10 genérica. `columns` es [{key, label, align}], `rows` es el
// array de datos ya ordenado por el backend.
export default function RankingTable({ columns, rows, emptyMessage = "Sin datos en este período." }) {
  if (!rows.length) {
    return <p className="px-1 py-3 text-xs text-gray-500">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-gray-500">
            {columns.map((col) => (
              <th key={col.key} className={`py-1.5 pr-3 font-medium ${col.align === "right" ? "text-right" : ""}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.id ?? row.maquinaId ?? idx} className="border-t border-gray-100">
              {columns.map((col) => (
                <td key={col.key} className={`py-1.5 pr-3 ${col.align === "right" ? "text-right font-semibold" : ""}`}>
                  {row[col.key] ?? "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
