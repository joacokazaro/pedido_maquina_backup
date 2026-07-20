/*
  Cliente del sistema de fichajes Browix. Se usa para importar horas
  trabajadas de los eventuales, matcheando por "ubicacion" == nombre del
  eventual dentro del rango fechaInicio/fechaFin.
*/

const BROWIX_BASE_URL = process.env.BROWIX_BASE_URL || "https://cloud01.browix.com";
const BROWIX_WORKGROUP_UUID = process.env.BROWIX_WORKGROUP_UUID || "d54d7b99cbdc69591966e3acbbeba8bb";
// Grupo/workgroup fijo donde se cargan los fichajes de eventuales en Browix.
const BROWIX_GRUPO_ID = process.env.BROWIX_GRUPO_ID || "2141";
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

export async function getFichajesPorRango(desde, hasta) {
  const url = `${BROWIX_BASE_URL}/v1/externalpermissions/getWorkgroupschedulePlan/uuid:${BROWIX_WORKGROUP_UUID}/${formatFecha(desde)}/${formatFecha(hasta)}/${BROWIX_GRUPO_ID}`;

  const headers = { Accept: "application/json" };
  if (BROWIX_AUTH_TOKEN) headers["X-AUTH-TOKEN"] = BROWIX_AUTH_TOKEN;

  let response;
  try {
    response = await fetch(url, { headers });
  } catch {
    throw buildBrowixError("No se pudo conectar con Browix");
  }

  if (!response.ok) {
    throw buildBrowixError(`Browix respondió con error (HTTP ${response.status})`);
  }

  const body = await response.json().catch(() => null);
  if (!body || body.response?.result !== "ok" || !Array.isArray(body.response?.data)) {
    throw buildBrowixError("Respuesta inesperada de Browix");
  }

  return body.response.data;
}

// Suma minutos_teoricos_de_jornada de los fichajes cuya ubicacion matchea
// exactamente el nombre del eventual (case/espacios sensibles: se tipea igual).
export function sumarHorasTeoricasPorUbicacion(fichajes, ubicacion) {
  const nombreEsperado = String(ubicacion || "").trim();
  const coincidencias = fichajes.filter((f) => String(f?.ubicacion || "").trim() === nombreEsperado);

  const totalMinutos = coincidencias.reduce((acc, f) => {
    const minutos = Number(f?.minutos_teoricos_de_jornada);
    return acc + (Number.isFinite(minutos) ? minutos : 0);
  }, 0);

  return { totalMinutos, cantidadFichajes: coincidencias.length };
}

// Agrupa por legajo los fichajes cuya ubicacion matchea el eventual, para poder
// después consultar la categoría de cada persona y desglosar las horas.
// Fichajes sin legajo cargado no se pueden atribuir a nadie: se cuentan aparte
// (sinLegajo) en vez de descartarse en silencio.
export function agruparMinutosPorLegajo(fichajes, ubicacion) {
  const nombreEsperado = String(ubicacion || "").trim();
  const coincidencias = fichajes.filter((f) => String(f?.ubicacion || "").trim() === nombreEsperado);

  const porLegajo = new Map();
  let sinLegajo = 0;

  for (const fichaje of coincidencias) {
    const legajo = String(fichaje?.legajo || "").trim();
    const minutos = Number(fichaje?.minutos_teoricos_de_jornada);
    const minutosValidos = Number.isFinite(minutos) ? minutos : 0;

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

// Browix limita getUsers a 1 consulta por segundo por uuid (lo informa en el
// propio body del 400: "ha excedido el tiempo mínimo entre consultas de 1
// segundos"). Como se pide la categoría de una persona a la vez, hay que
// espaciar las consultas; este es el margen de seguridad sobre ese límite.
const BROWIX_MIN_MS_ENTRE_CONSULTAS = Number(process.env.BROWIX_MIN_MS_ENTRE_CONSULTAS) || 1100;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function esErrorPorLimiteDeConsultas(mensaje) {
  return /tiempo m.nimo entre consultas/i.test(String(mensaje || ""));
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
    const erroresBody = entry?.response?.errors;
    const detalle =
      (typeof erroresBody?.error === "string" && erroresBody.error) ||
      (typeof erroresBody === "string" && erroresBody) ||
      entry?.response?.message ||
      null;
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
    if (i > 0) await sleep(BROWIX_MIN_MS_ENTRE_CONSULTAS);

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
      await sleep(BROWIX_MIN_MS_ENTRE_CONSULTAS);
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
