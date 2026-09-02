// Formateo en es-AR (punto para miles, coma para decimales). Los KPIs mezclan
// magnitudes muy distintas — 52.000 m² y 0,08 litros/hora — así que la cantidad
// de decimales se decide por el tamaño del número, no por el indicador.
const localeAR = "es-AR";

export function formatNumero(valor, decimales) {
  if (valor === null || valor === undefined || !Number.isFinite(Number(valor))) return "—";
  const numero = Number(valor);
  const dec =
    decimales !== undefined
      ? decimales
      : Math.abs(numero) >= 100
        ? 0
        : Math.abs(numero) >= 10
          ? 1
          : 2;
  return numero.toLocaleString(localeAR, { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export function formatPorcentaje(valor, decimales = 1) {
  if (valor === null || valor === undefined || !Number.isFinite(Number(valor))) return "—";
  return `${formatNumero(valor, decimales)}%`;
}

/** Texto para un intervalo media ± desvío. */
export function formatRango(desde, hasta, unidad) {
  if (desde === null || hasta === null) return "—";
  return `${formatNumero(desde)} a ${formatNumero(hasta)}${unidad ? ` ${unidad}` : ""}`;
}

/** Acorta nombres largos de eventual para que entren en un eje o una etiqueta. */
export function acortar(texto, largo = 26) {
  const limpio = String(texto || "").trim();
  return limpio.length > largo ? `${limpio.slice(0, largo - 1)}…` : limpio;
}
