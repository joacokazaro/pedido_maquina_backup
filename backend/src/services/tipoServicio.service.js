export const TIPOS_SERVICIO_VALIDOS = ["LIMPIEZA", "ESPACIOS_VERDES"];

export const TIPO_ESPACIOS_VERDES = "ESPACIOS_VERDES";

export function normalizeTipoServicio(value) {
  const tipo = String(value || "").trim().toUpperCase();
  return TIPOS_SERVICIO_VALIDOS.includes(tipo) ? tipo : null;
}
