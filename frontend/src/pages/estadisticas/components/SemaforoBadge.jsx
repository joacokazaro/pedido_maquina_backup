import { COLOR_SEMAFORO } from "../colors";

const LABEL = { rojo: "Urgente", amarillo: "Atención" };

// El color nunca va solo: siempre acompañado de texto/etiqueta (accesibilidad
// para daltonismo).
export default function SemaforoBadge({ semaforo, children }) {
  const color = COLOR_SEMAFORO[semaforo] || "#94a3b8";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-2 py-1 text-[11px] font-semibold">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      <span style={{ color }}>{children || LABEL[semaforo] || semaforo}</span>
    </span>
  );
}
