/*
  Cliente del sistema de fichajes Browix. Se usa para importar horas
  trabajadas de los eventuales, matcheando por "ubicacion" == nombre del
  eventual dentro del rango fechaInicio/fechaFin.
*/

const BROWIX_BASE_URL = process.env.BROWIX_BASE_URL || "https://cloud01.browix.com";
const BROWIX_WORKGROUP_UUID = process.env.BROWIX_WORKGROUP_UUID || "d54d7b99cbdc69591966e3acbbeba8bb";
// Catálogo de grupos/workgroups de Browix donde pueden estar los fichajes de un
// eventual. Browix no dice en qué grupo cae cada ubicación y consultarlos todos
// es inviable (10s de espera por consulta), así que solo se consultan los grupos
// por defecto más el/los grupos del supervisor del eventual (ver
// resolverGruposAConsultar). "supervisor" es el nombre legible de la persona
// dueña del grupo y "username" su usuario en el sistema; ambos son null si el
// grupo no es de una persona o esa persona no tiene usuario.
export const BROWIX_GRUPOS = [
  { id: "1447", nombre: "ARIEL_GONZALEZ", supervisor: "ARIEL GONZALEZ", username: "agonzalez" },
  { id: "2142", nombre: "CECILIA_VILLARREAL", supervisor: "CECILIA VILLARREAL", username: "cvillarreal" },
  { id: "1513", nombre: "CRISTINA_MOYA", supervisor: "CRISTINA MOYA", username: "cmoya" },
  { id: "1451", nombre: "FELIPE_COUREL", supervisor: "FELIPE COUREL", username: "fcourel" },
  { id: "1985", nombre: "FERNANDEZ_DANIELA", supervisor: "DANIELA FERNANDEZ", username: "dfernandez" },
  { id: "2141", nombre: "FINALES_DE_OBRA", supervisor: null, username: null },
  { id: "2243", nombre: "GERMAN_GONZALEZ", supervisor: "GERMAN GONZALEZ", username: null },
  { id: "1448", nombre: "GUSTAVO_BACUR", supervisor: "GUSTAVO BACUR", username: "gbacur" },
  { id: "2195", nombre: "IVAN_SCHMID", supervisor: "IVAN SCHMID", username: null },
  { id: "1444", nombre: "JUAN_BRARDA", supervisor: "JUAN BRARDA", username: "jbrarda" },
  { id: "2282", nombre: "MARIN_GERMAN", supervisor: "GERMAN MARIN", username: "gmarin" },
  { id: "1449", nombre: "NATALIA_LARA", supervisor: "NATALIA LARA", username: "nlara" },
  { id: "1445", nombre: "PABLO_MORETA", supervisor: "PABLO MORETA", username: "pmoreta" },
  { id: "1973", nombre: "RICARDO_RICARDE", supervisor: "RICARDO RICARDE", username: "rricarde" },
  { id: "1450", nombre: "RICARDO_RICARDE_UNION", supervisor: "RICARDO RICARDE (UNION)", username: "rricarde" },
  { id: "2248", nombre: "RUFINO", supervisor: "RUFINO", username: null },
  { id: "2084", nombre: "NORBERTO_URBANI", supervisor: "NORBERTO URBANI", username: "nurbani" },
  { id: "2315", nombre: "YOHANA VELEZ", supervisor: "YOHANA VELEZ", username: "yvelez" },
  // Uno de los 3 grupos por defecto; no figuraba en la lista con nombre.
  { id: "2303", nombre: "GRUPO_2303", supervisor: null, username: null },
];

// Grupos donde se cargan los fichajes de casi todos los eventuales: se consultan
// siempre.
export const BROWIX_GRUPOS_POR_DEFECTO = ["2141", "2303", "1444"];

// Grupos a consultar para un eventual: los por defecto más el/los del supervisor
// asignado (si tiene). Se suman y no reemplazan porque los fichajes de un
// supervisor no siempre están en su grupo: los de Yohana Velez o Cristina Moya,
// por ejemplo, están en FINALES_DE_OBRA.
export function resolverGruposAConsultar(supervisorUsername) {
  const username = String(supervisorUsername || "").trim().toLowerCase();
  const propios = username
    ? BROWIX_GRUPOS.filter((grupo) => grupo.username === username).map((grupo) => grupo.id)
    : [];
  return [...new Set([...BROWIX_GRUPOS_POR_DEFECTO, ...propios])];
}

const BROWIX_AUTH_TOKEN = process.env.BROWIX_AUTH_TOKEN || "";
// Customfield fijo en Browix donde se carga la categoría del empleado (ver getUsers).
// Se eliminó y volvió a crear el campo en Browix el 2026-09-22, por lo que cambió de id (era 137).
const BROWIX_CUSTOMFIELD_CATEGORIA_ID = "346";

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

// Cola que separa al menos BROWIX_MIN_MS_ENTRE_CONSULTAS_GRUPOS entre el inicio
// de dos consultas de planificación, aunque vengan de requests distintos (la
// búsqueda en todos los grupos las dispara una por request) o en simultáneo.
let colaConsultasGrupos = Promise.resolve();
let ultimaConsultaGrupoEn = 0;

function esperarTurnoConsultaGrupo() {
  const turno = colaConsultasGrupos.then(async () => {
    const espera = ultimaConsultaGrupoEn + BROWIX_MIN_MS_ENTRE_CONSULTAS_GRUPOS - Date.now();
    if (espera > 0) await sleep(espera);
    ultimaConsultaGrupoEn = Date.now();
  });
  colaConsultasGrupos = turno.catch(() => {});
  return turno;
}

async function getFichajesPorGrupo(desde, hasta, grupoId) {
  await esperarTurnoConsultaGrupo();

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

  // Se marca de qué grupo viene cada fichaje: Browix no lo informa y después hace
  // falta para saber en qué grupo cayó cada eventual.
  return body.response.data.map((fichaje) => ({ ...fichaje, grupoBrowixId: String(grupoId) }));
}

// Consulta los fichajes de los grupos indicados, partiendo el rango en
// ventanas de 45 días como máximo, y combina los resultados. Todas las
// consultas van secuencialmente (con espaciado de 10s+, ver
// esperarTurnoConsultaGrupo) en vez de en paralelo por el límite de Browix,
// que es por uuid y no por grupo; si una choca igual
// contra el límite (por ejemplo por otra consulta concurrente de otro proceso
// sobre el mismo uuid) reintenta una vez más. Si una falla de forma definitiva
// se aborta toda la importación en vez de reportar un total parcial que
// subestimaría las horas en silencio.
export async function getFichajesPorRango(desde, hasta, grupoIds) {
  if (!Array.isArray(grupoIds) || grupoIds.length === 0) {
    throw buildBrowixError("No hay grupos de Browix para consultar");
  }

  const ventanas = partirRangoEnVentanas(desde, hasta);
  const fichajes = [];

  for (const grupoId of grupoIds) {
    for (const ventana of ventanas) {
      try {
        const fichajesGrupo = await getFichajesPorGrupo(ventana.desde, ventana.hasta, grupoId);
        fichajes.push(...fichajesGrupo);
      } catch (error) {
        if (!error?.rateLimited) throw error;

        // El espaciado lo impone esperarTurnoConsultaGrupo dentro de getFichajesPorGrupo.
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

// Cantidad de fichajes con jornada del eventual por grupo de Browix (según el
// grupo con que se marcó cada fichaje en getFichajesPorGrupo).
export function contarFichajesPorGrupo(fichajes, ubicacion) {
  const porGrupo = new Map();
  for (const fichaje of filtrarFichajesDeJornada(fichajes, ubicacion)) {
    const grupoId = String(fichaje.grupoBrowixId || "");
    if (grupoId) porGrupo.set(grupoId, (porGrupo.get(grupoId) || 0) + 1);
  }
  return Array.from(porGrupo, ([grupoId, cantidadFichajes]) => ({ grupoId, cantidadFichajes }));
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
// extraer su categoría (customfield de categoría). Nunca asume forma de la respuesta:
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
