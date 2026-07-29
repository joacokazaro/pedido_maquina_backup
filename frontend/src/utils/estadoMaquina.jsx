import React from "react";

/**
 * Etiquetas y estilos de los estados de máquinas y vehículos.
 *
 * Contraparte de `utils/estadoPedido.jsx` (que hace lo mismo para los estados
 * de un pedido). Existe porque `Maquina.estado` es un `String` crudo en la base
 * (`disponible`, `no_devuelta`, `fuera_servicio`, ...) y esos valores se venían
 * imprimiendo tal cual en pantalla, con guion bajo y en minúscula.
 *
 * Usar siempre `formatEstadoMaquina()` para el texto y `EstadoMaquinaBadge`
 * para el badge: no imprimir `maquina.estado` directo en el JSX.
 */

export const ESTADOS_MAQUINA = [
  { value: "disponible", label: "Disponible" },
  { value: "asignada", label: "Asignada" },
  { value: "no_devuelta", label: "No devuelta" },
  { value: "fuera_servicio", label: "Fuera de servicio" },
  { value: "taller", label: "En taller" },
  { value: "baja", label: "Baja" },
];

const ETIQUETAS = Object.fromEntries(
  ESTADOS_MAQUINA.map(({ value, label }) => [value, label])
);

/** Estados válidos + la opción "Todos", para poblar los filtros de las listas. */
export const ESTADOS_MAQUINA_FILTRO = [
  { value: "", label: "Todos los estados" },
  ...ESTADOS_MAQUINA,
];

export function formatEstadoMaquina(estado) {
  if (!estado) return "-";

  const clave = String(estado).toLowerCase().trim();
  if (ETIQUETAS[clave]) return ETIQUETAS[clave];

  // Estado desconocido (o legacy): al menos sacamos los guiones bajos en vez
  // de mostrar el valor crudo de la base.
  return clave
    .replaceAll("_", " ")
    .replace(/(^|\s)\S/g, (letra) => letra.toUpperCase());
}

const BASE_BADGE =
  "px-2 py-1 rounded-full text-[10px] font-semibold uppercase";

const COLORES = {
  disponible: "bg-green-100 text-green-700",
  asignada: "bg-blue-100 text-blue-700",
  no_devuelta: "bg-red-100 text-red-700",
  fuera_servicio: "bg-orange-100 text-orange-700",
  taller: "bg-yellow-100 text-yellow-700",
  baja: "bg-gray-200 text-gray-500",
};

/**
 * Clases del badge de estado. `className` se concatena para que cada pantalla
 * conserve sus ajustes de layout (`h-fit`, `inline-flex`, ...).
 */
export function estadoMaquinaBadgeClasses(estado, className = "") {
  const clave = String(estado || "").toLowerCase().trim();
  const color = COLORES[clave] || "bg-gray-100 text-gray-600";
  return `${BASE_BADGE} ${color} ${className}`.trim();
}

export function EstadoMaquinaBadge({ estado, className = "" }) {
  return (
    <span className={estadoMaquinaBadgeClasses(estado, className)}>
      {formatEstadoMaquina(estado)}
    </span>
  );
}
