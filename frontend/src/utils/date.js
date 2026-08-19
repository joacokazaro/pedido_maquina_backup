// Los campos de fecha del backend (fechaInicio, fechaFin, etc.) son DateTime de
// Prisma guardados a medianoche UTC: parsearlos como instante y mostrarlos en
// ART (UTC-3) los correría al día anterior. Por eso, para render de fecha sola,
// se toman los componentes YYYY-MM-DD del string y se arma la fecha local,
// ignorando la hora. No usar esto para render con hora: descarta el horario.
function parseDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  if (typeof value === "string") {
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
    if (match) {
      const [, year, month, day] = match;
      return new Date(Number(year), Number(month) - 1, Number(day));
    }
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// Contraparte de parseDateValue para valores con hora (timestamps de historial,
// importaciones, etc.): preserva el instante real. Solo el string "YYYY-MM-DD"
// pelado se interpreta como medianoche local, por el mismo motivo de arriba.
function parseDateTimeValue(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  if (typeof value === "string") {
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const [, year, month, day] = match;
      return new Date(Number(year), Number(month) - 1, Number(day));
    }
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateOnly(value) {
  const date = parseDateValue(value);
  if (!date) return "-";

  return date.toLocaleDateString("es-AR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// hour12: false explícito: el locale es-AR resuelve a reloj de 12 horas y no
// agrega el sufijo a. m. / p. m., con lo cual las 04:56 y las 16:56 se
// imprimen idénticas.
export function formatDateTime(value) {
  const date = parseDateTimeValue(value);
  if (!date) return "-";

  return date.toLocaleString("es-AR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function toDateInputValue(value) {
  const date = parseDateValue(value);
  if (!date) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Días transcurridos entre `from` y `to` (default ahora), redondeando hacia
// abajo. Usa parseDateValue para que "YYYY-MM-DD" se interprete como
// medianoche local, igual que el resto de este archivo.
export function diffInDays(from, to = new Date()) {
  const date = parseDateValue(from);
  if (!date) return null;
  return Math.floor((to.getTime() - date.getTime()) / 86400000);
}

// Rango { desde, hasta } en formato "YYYY-MM-DD" para el filtro de período
// del panel de estadísticas.
export function presetRange(kind) {
  const hasta = new Date();
  const desde = new Date(hasta);

  if (kind === "mes-actual") {
    desde.setDate(1);
  } else {
    const dias = { "7d": 7, "30d": 30, "90d": 90 }[kind] ?? 30;
    desde.setDate(desde.getDate() - dias);
  }

  return { desde: toDateInputValue(desde), hasta: toDateInputValue(hasta) };
}
