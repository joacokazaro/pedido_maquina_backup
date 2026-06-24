export const ESTADO_TALLER = "taller";

export const ESTADOS_MAQUINA_VALIDOS = [
  "disponible",
  "asignada",
  "no_devuelta",
  "fuera_servicio",
  ESTADO_TALLER,
  "baja",
];

export const ESTADOS_VEHICULO_VALIDOS = [
  ...ESTADOS_MAQUINA_VALIDOS,
  "activo",
];

function normalizeBase(value) {
  return String(value || "").trim().toLowerCase();
}

function mapLegacyTaller(value) {
  if (
    value === "reparacion" ||
    value === "reparación" ||
    value === "en reparacion" ||
    value === "en reparación" ||
    value === "en taller"
  ) {
    return ESTADO_TALLER;
  }

  return value;
}

export function normalizeEstadoMaquina(raw, fallback = "disponible") {
  const value = mapLegacyTaller(normalizeBase(raw));

  if (ESTADOS_MAQUINA_VALIDOS.includes(value)) return value;
  if (value === "no devuelta" || value === "nodevuelta") return "no_devuelta";
  if (value === "fuera de servicio") return "fuera_servicio";

  return fallback;
}

export function normalizeEstadoVehiculo(raw, fallback = "disponible") {
  const value = mapLegacyTaller(normalizeBase(raw));

  if (ESTADOS_VEHICULO_VALIDOS.includes(value)) return value;
  if (value === "no devuelta" || value === "nodevuelta") return "no_devuelta";
  if (value === "fuera de servicio") return "fuera_servicio";

  return fallback;
}

export function canonicalEstadoMaquina(raw) {
  return normalizeEstadoMaquina(raw, raw ?? null);
}

export function canonicalEstadoVehiculo(raw) {
  return normalizeEstadoVehiculo(raw, raw ?? null);
}