import { COLOR_ESTADO_MAQUINA } from "../colors";

const ESTADOS = ["disponible", "asignada", "no_devuelta", "fuera_servicio", "taller", "baja"];

// Mini barra apilada de una sola fila, para meter dentro de una celda de
// tabla (composición de stock por tipo de máquina). Sin ejes ni librería:
// es puro CSS, no vale la pena un chart de Recharts para esto.
export default function StackedBarMini({ porEstado, total }) {
  if (!total) return <div className="h-2 w-full rounded-full bg-gray-100" />;

  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-gray-100">
      {ESTADOS.map((estado) => {
        const cantidad = porEstado[estado] || 0;
        if (!cantidad) return null;
        return (
          <div
            key={estado}
            style={{ width: `${(cantidad / total) * 100}%`, backgroundColor: COLOR_ESTADO_MAQUINA[estado] }}
            title={`${estado}: ${cantidad}`}
          />
        );
      })}
    </div>
  );
}
