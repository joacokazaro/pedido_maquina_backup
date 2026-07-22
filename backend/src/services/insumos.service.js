/*
  Cliente de la API de pedidos de insumos (insumos.kazaro.com.ar). Se usa para
  importar a un eventual los insumos pedidos para el servicio homónimo,
  matcheando por "servicio.nombre" == nombre del eventual dentro del rango
  fechaInicio/fechaFin (mismo criterio que Browix con "ubicacion").

  La API de insumos separa los datos por empresa (un token por empresa), pero
  acá "Servicio"/"Eventual" no tienen un campo empresa: los nombres de Pulizia
  y Pazar conviven en el mismo namespace (ver EMPRESAS_VALIDAS en
  adminMaquinas.controller.js). Por eso se prueban todos los tokens
  configurados y se combinan los que matcheen, en vez de asumir una sola
  empresa.
*/

const INSUMOS_API_BASE_URL = process.env.INSUMOS_API_BASE_URL || "https://insumos.kazaro.com.ar/api/v1";
const INSUMOS_API_TOKENS = String(process.env.INSUMOS_API_TOKENS || process.env.INSUMOS_API_TOKEN || "")
  .split(",")
  .map((token) => token.trim())
  .filter(Boolean);

function buildInsumosError(message, status = 502) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function formatFecha(date) {
  return date.toISOString().slice(0, 10);
}

async function insumosFetch(token, path, params = {}) {
  const url = new URL(`${INSUMOS_API_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  }

  let response;
  try {
    response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw buildInsumosError("No se pudo conectar con la API de insumos");
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const mensaje = body?.mensaje || `HTTP ${response.status}`;
    const error = buildInsumosError(`La API de insumos respondió con error: ${mensaje}`, response.status === 429 ? 429 : 502);
    error.codigo = body?.error || null;
    throw error;
  }

  return body;
}

// Busca un servicio de nombre exacto en cada empresa configurada (un token =
// una empresa) y devuelve todas las coincidencias, cada una junto con el
// token de esa empresa (necesario para consultar después /pedidos, que
// también está separado por empresa). Puede haber 0, 1 o más coincidencias:
// no es un error si no aparece en ninguna, simplemente no hay pedidos de
// insumos cargados para ese servicio todavía en esa plataforma.
export async function resolverServiciosPorNombre(nombre) {
  if (INSUMOS_API_TOKENS.length === 0) {
    throw buildInsumosError("No hay tokens configurados para la API de insumos (INSUMOS_API_TOKENS)", 500);
  }

  const nombreEsperado = String(nombre || "").trim();
  const coincidencias = [];

  for (const token of INSUMOS_API_TOKENS) {
    const body = await insumosFetch(token, "/servicios");
    const servicios = Array.isArray(body?.servicios) ? body.servicios : [];
    const encontrado = servicios.find((s) => String(s?.nombre || "").trim() === nombreEsperado);
    if (encontrado) {
      coincidencias.push({ token, empresaId: body?.empresaId ?? null, servicioId: encontrado.id });
    }
  }

  return coincidencias;
}

// Trae todos los pedidos de un servicio (de una empresa puntual, identificada
// por su token) en un rango de fechas, recorriendo todas las páginas
// (limit=500, el máximo permitido por la API).
export async function getPedidosInsumos({ token, servicioId, desde, hasta }) {
  const pedidos = [];
  let page = 1;

  while (true) {
    const body = await insumosFetch(token, "/pedidos", {
      servicioId,
      desde: formatFecha(desde),
      hasta: formatFecha(hasta),
      page,
      limit: 500,
    });

    const paginaPedidos = Array.isArray(body?.pedidos) ? body.pedidos : [];
    pedidos.push(...paginaPedidos);

    const totalPaginas = body?.paginado?.paginas || 1;
    if (page >= totalPaginas) break;
    page += 1;
  }

  return pedidos;
}
