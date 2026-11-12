/*
  Cliente de la API de pedidos de insumos (insumos.kazaro.com.ar). Se usa para
  importar a un eventual los insumos pedidos para el servicio homónimo,
  matcheando por "servicio.nombre" == nombre del eventual. Sin filtro de
  fecha: se trae todo el historial de pedidos de ese servicio, a diferencia
  de Browix (que sí acota por fechaInicio/fechaFin) — el nombre del eventual
  es único en el sistema, así que no hace falta acotar por rango.

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
// por su token), sin acotar por fecha, recorriendo todas las páginas
// (limit=500, el máximo permitido por la API).
export async function getPedidosInsumos({ token, servicioId }) {
  const pedidos = [];
  let page = 1;

  while (true) {
    const body = await insumosFetch(token, "/pedidos", {
      servicioId,
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

// Busca el servicio por nombre en todas las empresas y junta sus pedidos.
// `filtroPedido` permite acotar (p. ej. por rango de fechas en los informes).
export async function traerPedidosInsumosPorNombre(nombre, filtroPedido = null) {
  const coincidencias = await resolverServiciosPorNombre(nombre);

  const pedidos = [];
  for (const { token, servicioId } of coincidencias) {
    const pedidosEmpresa = await getPedidosInsumos({ token, servicioId });
    pedidos.push(...(filtroPedido ? pedidosEmpresa.filter(filtroPedido) : pedidosEmpresa));
  }

  return { coincidencias, pedidos };
}

/* =========================
   SELECCIÓN DE ÍTEMS
   No siempre se factura todo lo que se pidió para un servicio: antes de
   importar, quien importa ve cada pedido con sus ítems y elige qué incluir.
   Cada ítem se identifica con "<pedidoId>:<posición en el pedido>". Al
   confirmar, el backend vuelve a consultar la API y se queda solo con las
   claves elegidas (no confía en montos mandados por el navegador).
========================= */

const redondear2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export function claveItemInsumo(pedido, indice) {
  return `${pedido?.pedidoId}:${indice}`;
}

function itemsDePedido(pedido) {
  return (Array.isArray(pedido?.items) ? pedido.items : []).map((item, indice) => ({
    clave: claveItemInsumo(pedido, indice),
    codigo: item?.codigo ?? null,
    insumo: item?.insumo ?? "",
    cantidad: Number(item?.cantidad) || 0,
    precioUnitario: Number(item?.precioUnitario) || 0,
    subtotal: Number(item?.subtotal) || 0,
  }));
}

function sumarSubtotales(items) {
  return redondear2(items.reduce((acc, item) => acc + item.subtotal, 0));
}

// Lo que se le muestra a quien importa, sin guardar nada. Si ya hubo una
// importación, vienen destildados los ítems que esa vez se excluyeron; lo
// nuevo (pedidos que aparecieron después) viene tildado.
export function armarVistaPreviaInsumos({ coincidencias, pedidos, servicioNombre, anterior = null, extra = {} }) {
  const excluidasAntes = new Set(Array.isArray(anterior?.clavesExcluidas) ? anterior.clavesExcluidas : []);

  const pedidosVista = pedidos.map((pedido) => {
    const items = itemsDePedido(pedido).map((item) => ({ ...item, seleccionado: !excluidasAntes.has(item.clave) }));
    return {
      pedidoId: pedido.pedidoId,
      numero: pedido.numero,
      fechaHoraArgentina: pedido.fechaHoraArgentina,
      dia: pedido.dia ?? null,
      solicitante: pedido.solicitante,
      estado: pedido.estado,
      nota: pedido.nota ?? null,
      total: sumarSubtotales(items),
      items,
    };
  });

  return {
    ...extra,
    servicioIds: coincidencias.map((c) => c.servicioId),
    servicioNombre,
    cantidadPedidos: pedidosVista.length,
    total: redondear2(pedidosVista.reduce((acc, p) => acc + p.total, 0)),
    importacionAnterior: anterior
      ? { importadoEn: anterior.importadoEn || null, importadoPor: anterior.importadoPor || null, total: anterior.total ?? null }
      : null,
    pedidos: pedidosVista,
  };
}

// `clavesIncluidas` null/undefined = incluir todo (comportamiento original).
// Devuelve los pedidos recortados a los ítems elegidos (los pedidos sin
// ningún ítem elegido quedan afuera) y el resumen de la selección.
export function aplicarSeleccionInsumos(pedidos, clavesIncluidas) {
  if (clavesIncluidas !== undefined && clavesIncluidas !== null && !Array.isArray(clavesIncluidas)) {
    const error = new Error("La selección de insumos es inválida");
    error.status = 400;
    throw error;
  }

  const incluirTodo = !Array.isArray(clavesIncluidas);
  const elegidas = new Set((clavesIncluidas || []).map(String));

  const pedidosIncluidos = [];
  const clavesExcluidas = [];
  let cantidadItemsDisponibles = 0;
  let totalDisponible = 0;

  for (const pedido of pedidos) {
    const items = itemsDePedido(pedido);
    cantidadItemsDisponibles += items.length;
    totalDisponible += sumarSubtotales(items);

    const incluidos = [];
    for (const item of items) {
      if (incluirTodo || elegidas.has(item.clave)) incluidos.push(item);
      else clavesExcluidas.push(item.clave);
    }

    if (incluidos.length > 0) {
      pedidosIncluidos.push({
        ...pedido,
        items: incluidos,
        total: sumarSubtotales(incluidos),
        totalPedido: sumarSubtotales(items),
        itemsExcluidos: items.length - incluidos.length,
      });
    }
  }

  const cantidadItemsIncluidos = cantidadItemsDisponibles - clavesExcluidas.length;
  const total = redondear2(pedidosIncluidos.reduce((acc, p) => acc + p.total, 0));
  totalDisponible = redondear2(totalDisponible);

  return {
    pedidosIncluidos,
    clavesExcluidas,
    seleccion: {
      completa: clavesExcluidas.length === 0,
      cantidadItemsIncluidos,
      cantidadItemsDisponibles,
      cantidadPedidosDisponibles: pedidos.length,
      totalDisponible,
      totalExcluido: redondear2(totalDisponible - total),
    },
  };
}

// Resumen de cada pedido incluido que se guarda junto con la importación.
export function resumirPedidosIncluidos(pedidosIncluidos) {
  return pedidosIncluidos.map((p) => ({
    pedidoId: p.pedidoId,
    numero: p.numero,
    fechaHoraArgentina: p.fechaHoraArgentina,
    solicitante: p.solicitante,
    estado: p.estado,
    total: p.total,
    totalPedido: p.totalPedido,
    itemsExcluidos: p.itemsExcluidos,
  }));
}
