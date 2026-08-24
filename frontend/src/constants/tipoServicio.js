export const TIPOS_SERVICIO = [
  { value: "LIMPIEZA", label: "Limpieza" },
  { value: "ESPACIOS_VERDES", label: "Espacios Verdes" },
];

export function tipoServicioLabel(tipo) {
  return TIPOS_SERVICIO.find((t) => t.value === tipo)?.label || tipo || "Sin clasificar";
}
