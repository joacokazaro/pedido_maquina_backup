/*
  Cliente del sistema de fichajes Browix. Se usa para importar horas
  trabajadas de los eventuales, matcheando por "ubicacion" == nombre del
  eventual dentro del rango fechaInicio/fechaFin.
*/

const BROWIX_BASE_URL = process.env.BROWIX_BASE_URL || "https://cloud01.browix.com";
const BROWIX_WORKGROUP_UUID = process.env.BROWIX_WORKGROUP_UUID || "d54d7b99cbdc69591966e3acbbeba8bb";
// Grupos/workgroups donde se cargan los fichajes de eventuales en Browix. Puede
// haber más de uno (lista separada por comas); se consultan todos y se combinan
// los fichajes para armar el total.
const BROWIX_GRUPO_IDS = String(process.env.BROWIX_GRUPO_IDS || process.env.BROWIX_GRUPO_ID || "2141,2303,1444")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);
const BROWIX_AUTH_TOKEN = process.env.BROWIX_AUTH_TOKEN || "";
// Customfield fijo en Browix donde se carga la categoría del empleado (ver getUsers).
const BROWIX_CUSTOMFIELD_CATEGORIA_ID = "137";

function buildBrowixError(message) {
  const error = new Error(message);
  error.status = 502;
  return error;
}

function formatFecha(date) {
  return date.toISOString().slice(0, 10);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function esErrorPorLimiteDeConsultas(mensaje) {
  return /tiempo m.nimo entre consultas/i.test(String(mensaje || ""));
}

// Cada endpoint de Browix informa su propio límite en el body del 400 (ej.
// "ha excedido el tiempo mínimo entre consultas de N segundos"). Se midió
// empíricamente: getWorkgroupschedulePlan (fichajes por grupo) exige 10s,
// getUsers (categoría por legajo) exige 1s. Los márgenes de acá dejan un
// colchón sobre esos mínimos.
const BROWIX_MIN_MS_ENTRE_CONSULTAS_GRUPOS = Number(process.env.BROWIX_MIN_MS_ENTRE_CONSULTAS_GRUPOS) || 10500;
const BROWIX_MIN_MS_ENTRE_CONSULTAS_LEGAJOS = Number(process.env.BROWIX_MIN_MS_ENTRE_CONSULTAS_LEGAJOS) || 1100;

// Browix informa el motivo del 400 en "response.errors", que según el endpoint
// viene como array de {field, error}, como objeto suelto o como string. El
// fallback a "message" es el genérico ("validation error"), que por sí solo no
// dice nada: sin desarmar el array, un rango de fechas inválido y un uuid mal
// configurado se ven exactamente igual.
function extraerDetalleDeError(entry) {
  const errores = entry?.response?.errors;

  if (Array.isArray(errores)) {
    const detalles = errores
      .map((e) => (typeof e === "string" ? e : e?.error))
      .filter((detalle) => typeof detalle === "string" && detalle.trim());
    if (detalles.length > 0) return detalles.join("; ");
  }

  if (typeof errores?.error === "string") return errores.error;
  if (typeof errores === "string") return errores;

  return entry?.response?.message || null;
}

// Browix rechaza con 400 ("el rango de fechas es demasiado amplio, el máximo
// son 45 días") cualquier consulta de planificación que abarque más de 45
// días, así que los eventuales largos hay que pedirlos por tramos.
const BROWIX_MAX_DIAS_POR_CONSULTA = 45;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

function aMedianocheUTC(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// Parte [desde, hasta] en ventanas consecutivas (sin solaparse, así no hay
// fichajes duplicados) de a lo sumo BROWIX_MAX_DIAS_POR_CONSULTA días.
function partirRangoEnVentanas(desde, hasta) {
  const fechaFinal = aMedianocheUTC(hasta);
  const ventanas = [];
  let inicio = aMedianocheUTC(desde);

  // Siempre se emite al menos una ventana: si las fechas vinieran invertidas,
  // que falle Browix con su propio mensaje y no que devuelva cero fichajes.
  for (;;) {
    const tentativo = new Date(inicio.getTime() + (BROWIX_MAX_DIAS_POR_CONSULTA - 1) * MS_POR_DIA);
    const fin = tentativo > fechaFinal ? fechaFinal : tentativo;
    ventanas.push({ desde: inicio, hasta: fin });

    if (fin >= fechaFinal) return ventanas;
    inicio = new Date(fin.getTime() + MS_POR_DIA);
  }
}

async function getFichajesPorGrupo(desde, hasta, grupoId) {
  const url = `${BROWIX_BASE_URL}/v1/externalpermissions/getWorkgroupschedulePlan/uuid:${BROWIX_WORKGROUP_UUID}/${formatFecha(desde)}/${formatFecha(hasta)}/${grupoId}`;

  const headers = { Accept: "application/json" };
  if (BROWIX_AUTH_TOKEN) headers["X-AUTH-TOKEN"] = BROWIX_AUTH_TOKEN;

  let response;
  try {
    response = await fetch(url, { headers });
  } catch {
    throw buildBrowixError(`No se pudo conectar con Browix para el grupo ${grupoId}`);
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const detalle = extraerDetalleDeError(body);
    const error = buildBrowixError(
      `Browix respondió con error (HTTP ${response.status}) al consultar el grupo ${grupoId} entre ${formatFecha(desde)} y ${formatFecha(hasta)}${detalle ? `: ${detalle}` : ""}`
    );
    error.rateLimited = esErrorPorLimiteDeConsultas(detalle);
    throw error;
  }

  if (!body || body.response?.result !== "ok" || !Array.isArray(body.response?.data)) {
    throw buildBrowixError(`Respuesta inesperada de Browix al consultar el grupo ${grupoId}`);
  }

  return body.response.data;
}

// Consulta los fichajes de todos los grupos configurados (BROWIX_GRUPO_IDS),
// partiendo el rango en ventanas de 45 días como máximo, y combina los
// resultados. Todas las consultas van secuencialmente (con espaciado de 10s+)
// en vez de en paralelo por el límite de Browix, que es por uuid y no por
// grupo; si una choca igual contra el límite (por ejemplo por otra consulta
// concurrente de otro proceso sobre el mismo uuid) reintenta una vez más. Si
// una falla de forma definitiva se aborta toda la importación en vez de
// reportar un total parcial que subestimaría las horas en silencio.
export async function getFichajesPorRango(desde, hasta) {
  if (BROWIX_GRUPO_IDS.length === 0) {
    throw buildBrowixError("No hay grupos de Browix configurados (BROWIX_GRUPO_IDS)");
  }

  const ventanas = partirRangoEnVentanas(desde, hasta);
  const fichajes = [];
  let esPrimeraConsulta = true;

  for (const grupoId of BROWIX_GRUPO_IDS) {
    for (const ventana of ventanas) {
      if (!esPrimeraConsulta) await sleep(BROWIX_MIN_MS_ENTRE_CONSULTAS_GRUPOS);
      esPrimeraConsulta = false;

      try {
        const fichajesGrupo = await getFichajesPorGrupo(ventana.desde, ventana.hasta, grupoId);
        fichajes.push(...fichajesGrupo);
      } catch (error) {
        if (!error?.rateLimited) throw error;

        await sleep(BROWIX_MIN_MS_ENTRE_CONSULTAS_GRUPOS);
        const fichajesGrupo = await getFichajesPorGrupo(ventana.desde, ventana.hasta, grupoId);
        fichajes.push(...fichajesGrupo);
      }
    }
  }

  return fichajes;
}

// Solo cuentan los fichajes con jornada efectivamente asignada. Los días de
// franco rotativo (ROT), licencia (ENF) o sin turno cargado aparecen igual en
// la planificación del eventual pero con 0 minutos teóricos: la persona figura
// en el cronograma y no fue. Se descartan acá, una sola vez, para que no
// inflen el conteo de fichajes ni el de personas por categoría.
function tieneJornadaAsignada(fichaje) {
  const minutos = Number(fichaje?.minutos_teoricos_de_jornada);
  return Number.isFinite(minutos) && minutos > 0;
}

// Fichajes cuya ubicacion matchea exactamente el nombre del eventual
// (case/espacios sensibles: se tipea igual) y que además tienen jornada
// asignada.
function filtrarFichajesDeJornada(fichajes, ubicacion) {
  const nombreEsperado = String(ubicacion || "").trim();
  return fichajes.filter(
    (f) => String(f?.ubicacion || "").trim() === nombreEsperado && tieneJornadaAsignada(f)
  );
}

// Suma minutos_teoricos_de_jornada (planificado, el que se usa para el
// desglose por categoría y el PDF) y minutos_desde_entrada_a_salida (real,
// según marcaciones efectivas — 0 si la persona estuvo ausente) de los
// fichajes con jornada asignada en el eventual. El real se devuelve solo como
// dato de control en el resumen de importación, no reemplaza al teórico.
export function sumarHorasTeoricasPorUbicacion(fichajes, ubicacion) {
  const coincidencias = filtrarFichajesDeJornada(fichajes, ubicacion);

  const totalMinutos = coincidencias.reduce((acc, f) => acc + Number(f.minutos_teoricos_de_jornada), 0);

  const totalMinutosReal = coincidencias.reduce((acc, f) => {
    const minutos = Number(f?.minutos_desde_entrada_a_salida);
    return acc + (Number.isFinite(minutos) ? minutos : 0);
  }, 0);

  return { totalMinutos, totalMinutosReal, cantidadFichajes: coincidencias.length };
}

// Agrupa por legajo los fichajes con jornada asignada en el eventual, para
// poder después consultar la categoría de cada persona y desglosar las horas.
// Quien solo tuvo ROT/ENF/sin turno no genera grupo: no se le consulta la
// categoría ni suma como persona del eventual.
// Fichajes sin legajo cargado no se pueden atribuir a nadie: se cuentan aparte
// (sinLegajo) en vez de descartarse en silencio.
export function agruparMinutosPorLegajo(fichajes, ubicacion) {
  const coincidencias = filtrarFichajesDeJornada(fichajes, ubicacion);

  const porLegajo = new Map();
  let sinLegajo = 0;

  for (const fichaje of coincidencias) {
    const legajo = String(fichaje?.legajo || "").trim();
    const minutosValidos = Number(fichaje.minutos_teoricos_de_jornada);

    if (!legajo) {
      sinLegajo += 1;
      continue;
    }

    const actual = porLegajo.get(legajo) || {
      legajo,
      nombre: fichaje?.nombre || null,
      apellido: fichaje?.apellido || null,
      totalMinutos: 0,
      cantidadFichajes: 0,
    };
    actual.totalMinutos += minutosValidos;
    actual.cantidadFichajes += 1;
    porLegajo.set(legajo, actual);
  }

  return { grupos: Array.from(porLegajo.values()), sinLegajo };
}

// Consulta en Browix los datos de un empleado por legajo (external_code) para
// extraer su categoría (customfield 137). Nunca asume forma de la respuesta:
// cualquier desvío (legajo inexistente, sin categoría cargada, HTTP no ok,
// JSON inválido) se reporta explícitamente en vez de fallar en silencio.
export async function getCategoriaPorLegajo(legajo) {
  const url = `${BROWIX_BASE_URL}/v1/externalpermissions/getUsers/uuid:${BROWIX_WORKGROUP_UUID}/${encodeURIComponent(legajo)}`;

  const headers = { Accept: "application/json" };
  if (BROWIX_AUTH_TOKEN) headers["X-AUTH-TOKEN"] = BROWIX_AUTH_TOKEN;

  let response;
  try {
    response = await fetch(url, { headers });
  } catch {
    throw buildBrowixError(`No se pudo conectar con Browix para consultar el legajo ${legajo}`);
  }

  // Se parsea el body antes de decidir por el status HTTP: Browix informa el
  // motivo real del 400 (ej. límite de consultas) en "response.errors", y ese
  // detalle es justamente lo que necesitamos para diferenciar un rate-limit
  // (reintentable) de un error real (legajo inválido, etc.).
  const body = await response.json().catch(() => null);
  // getUsers devuelve un array con un único elemento envolviendo "response",
  // a diferencia de getWorkgroupschedulePlan que devuelve el objeto directo.
  const entry = Array.isArray(body) ? body[0] : body;

  if (!response.ok) {
    const detalle = extraerDetalleDeError(entry);
    const error = buildBrowixError(
      `Browix respondió con error (HTTP ${response.status}) al consultar el legajo ${legajo}${detalle ? `: ${detalle}` : ""}`
    );
    error.rateLimited = esErrorPorLimiteDeConsultas(detalle);
    throw error;
  }

  const records = entry?.response?.data?.records;

  if (entry?.response?.result !== "ok" || !Array.isArray(records)) {
    throw buildBrowixError(`Respuesta inesperada de Browix al consultar el legajo ${legajo}`);
  }

  if (records.length === 0) {
    return { legajo, encontrado: false, nombre: null, apellido: null, categoria: null };
  }

  const record = records[0];
  const usuario = record?.User || {};
  const customfields = Array.isArray(record?.Customfieldvalue) ? record.Customfieldvalue : [];
  const campoCategoria = customfields.find(
    (cf) => String(cf?.customfield_id) === BROWIX_CUSTOMFIELD_CATEGORIA_ID
  );
  const categoria = String(campoCategoria?.field_value_alpha || "").trim() || null;

  return {
    legajo,
    encontrado: true,
    nombre: usuario?.name || null,
    apellido: usuario?.last_name || null,
    categoria,
  };
}

// Consulta la categoría de una lista de legajos respetando el límite de 1
// consulta/segundo de Browix: las procesa secuencialmente con un espaciado
// mínimo entre cada una, y si igual choca contra el límite (por ejemplo por
// otra consulta concurrente de otro proceso sobre el mismo uuid), reintenta
// una vez más tras esperar. Devuelve resultados en el mismo formato que
// Promise.allSettled para que el llamador no tenga que distinguir el modo de
// ejecución.
export async function getCategoriasPorLegajos(legajos) {
  const resultados = [];

  for (let i = 0; i < legajos.length; i += 1) {
    if (i > 0) await sleep(BROWIX_MIN_MS_ENTRE_CONSULTAS_LEGAJOS);

    try {
      const usuario = await getCategoriaPorLegajo(legajos[i]);
      resultados.push({ status: "fulfilled", value: usuario });
    } catch (error) {
      if (!error?.rateLimited) {
        resultados.push({ status: "rejected", reason: error });
        continue;
      }

      // Reintento único ante rate-limit: espera un ciclo completo más y
      // vuelve a intentar antes de darse por vencido con este legajo.
      await sleep(BROWIX_MIN_MS_ENTRE_CONSULTAS_LEGAJOS);
      try {
        const usuario = await getCategoriaPorLegajo(legajos[i]);
        resultados.push({ status: "fulfilled", value: usuario });
      } catch (retryError) {
        resultados.push({ status: "rejected", reason: retryError });
      }
    }
  }

  return resultados;
}
