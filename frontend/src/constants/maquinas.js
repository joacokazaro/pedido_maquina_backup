export const MACHINE_TYPES = [
  "LUSTRADORA",
  "SOPLADORA",
  "HIDROLAVADORA",
  "LAVADORA",
  "ASPIRADORA",
  "MOTOGUADAÑA",
  "CARGADOR",
  "CARGADOR AGIBOT",
  "BOMBA DESINFECCION",
  "ROBOT DE LIMPIEZA",
];

export const REQUEST_RESOURCE_TYPES = [
  ...MACHINE_TYPES,
  "VEHICULO",
];

export function buildMachineTypeOptions(maquinas = [], tipoActual = "") {
  return Array.from(
    new Set([
      ...MACHINE_TYPES,
      ...maquinas.map((maquina) => String(maquina.tipo || "").trim()).filter(Boolean),
      String(tipoActual || "").trim(),
    ].filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
}
