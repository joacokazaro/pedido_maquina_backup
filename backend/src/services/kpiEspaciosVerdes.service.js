import prisma from "../db/prisma.js";
import { TIPO_ESPACIOS_VERDES } from "./tipoServicio.service.js";

/**
 * KPIs de los eventuales de Espacios Verdes.
 *
 * Todo lo que se mide acá sale de los campos de cierre del eventual, que solo
 * se completan cuando está `finalizado`: `horasBrowix` (importado del sistema
 * de fichadas), `trabajosRealizados`, `insumosExtras` y `maquinasUtilizadas`.
 * Los eventuales activos entran únicamente en el conteo de alcance.
 *
 * No se calcula ningún costo a propósito: hoy no hay tarifa por categoría ni
 * monto facturado en el modelo, así que cualquier número en pesos daría cerca
 * de cero y sería engañoso. Ver CLAUDE.md, sección "Eventuales".
 */

// Unidad en la que corresponde medir cada tipo de trabajo. Hasta ahora era una
// convención escrita (CLAUDE.md) que el formulario no impone: `TIPOS_TRABAJO_VALIDOS`
// y `UNIDADES_MEDIDA_VALIDAS` son listas independientes y el mismo trabajo se
// cargó con unidades distintas. Acá se vuelve dato: los trabajos cargados en
// otra unidad quedan fuera de los rendimientos (mezclar m² con horas daría un
// promedio sin sentido) y alimentan el indicador de calidad de carga.
export const UNIDAD_CANONICA_POR_TRABAJO = {
  DESMALEZADO: "M2",
  DESMONTE: "M2",
  RETIRO_PODA: "M3",
  PODA_ALTURA: "UNIDAD",
  PODA_MENOR_2M: "UNIDAD",
  LIMPIEZA_INTEGRAL: "UNIDAD",
  CORTE_CESPED: "M2",
  CORTE_BARRIDO: "M2",
};

// Insumos que son combustible líquido. El aceite de cadena se carga en CC y
// los herbicidas/bolsas/tanza no son combustible: ninguno entra en litros/hora.
const INSUMOS_COMBUSTIBLE = ["NAFTA_PREPARADA", "NAFTA_PURA", "GASOIL_PREMIUM", "GASOIL_COMUN"];

export const LABEL_UNIDAD = {
  M2: "m²",
  M3: "m³",
  UNIDAD: "unidades",
  METROS_LINEALES: "m lineales",
  HORAS: "horas",
  KG: "kg",
};

export const LABEL_TRABAJO = {
  PODA_MENOR_2M: "Poda menor a 2m",
  PODA_ALTURA: "Poda en altura",
  RETIRO_PODA: "Retiro de poda",
  DESMALEZADO: "Desmalezado",
  DESMONTE: "Desmonte",
  CORTE_CESPED: "Corte de césped",
  CORTE_BARRIDO: "Corte y barrido",
  LIMPIEZA_INTEGRAL: "Limpieza integral",
  OTRO: "Otro",
};

const MS_POR_DIA = 24 * 60 * 60 * 1000;

export function parseJson(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function redondear(valor, decimales = 2) {
  if (!Number.isFinite(valor)) return null;
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
}

/* =======================
   Estadística
   Funciones puras, sin dependencia de Prisma: son las que se verifican aparte.
======================= */

/**
 * Resumen de una muestra de valores. El desvío es **muestral** (divide por
 * n-1, no por n): estos 12 eventuales son una muestra de la operación, no la
 * población completa, y con n chico la diferencia entre ambos no es menor.
 * Con menos de 2 datos el desvío no existe y se devuelve null en vez de 0,
 * para que la UI no dibuje una campana de ancho cero.
 */
export function resumenEstadistico(valores) {
  const datos = valores.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  const n = datos.length;

  if (n === 0) {
    return { n: 0, media: null, desvio: null, cv: null, min: null, max: null, mediana: null };
  }

  const media = datos.reduce((acc, v) => acc + v, 0) / n;

  const desvio =
    n < 2
      ? null
      : Math.sqrt(datos.reduce((acc, v) => acc + (v - media) ** 2, 0) / (n - 1));

  const medio = Math.floor(n / 2);
  const mediana = n % 2 === 0 ? (datos[medio - 1] + datos[medio]) / 2 : datos[medio];

  return {
    n,
    media: redondear(media, 2),
    desvio: redondear(desvio, 2),
    // Coeficiente de variación: desvío como % de la media. Es lo que permite
    // comparar la dispersión entre indicadores de unidades distintas
    // (m²/hora contra litros/hora).
    cv: media > 0 && desvio !== null ? redondear((desvio / media) * 100, 1) : null,
    min: redondear(datos[0], 2),
    max: redondear(datos[n - 1], 2),
    mediana: redondear(mediana, 2),
  };
}

/* =======================
   Lectura de los campos de cierre
======================= */

export function horasDelEventual(eventual) {
  const browix = parseJson(eventual.horasBrowix);
  const horas = Number(browix?.totalHoras);
  return Number.isFinite(horas) && horas > 0 ? horas : null;
}

export function trabajosDelEventual(eventual) {
  const trabajos = parseJson(eventual.trabajosRealizados);
  return Array.isArray(trabajos) ? trabajos : [];
}

/**
 * Producción de un tipo de trabajo en su unidad canónica. Devuelve null si el
 * eventual no lo registró o si lo cargó en otra unidad — el caso real es un
 * eventual con `DESMALEZADO` medido en horas, que no es una superficie mal
 * etiquetada sino otra magnitud, y no se puede convertir.
 */
export function produccionCanonica(eventual, tipoTrabajo) {
  const unidadEsperada = UNIDAD_CANONICA_POR_TRABAJO[tipoTrabajo];
  const total = trabajosDelEventual(eventual)
    .filter((t) => t?.tipo === tipoTrabajo && t?.unidadMedida === unidadEsperada)
    .reduce((acc, t) => acc + (Number(t.cantidad) || 0), 0);

  return total > 0 ? total : null;
}

export function litrosCombustible(eventual) {
  const insumos = parseJson(eventual.insumosExtras);
  if (!Array.isArray(insumos)) return null;

  const total = insumos
    .filter((i) => INSUMOS_COMBUSTIBLE.includes(i?.tipo) && i?.unidadMedida === "LITROS")
    .reduce((acc, i) => acc + (Number(i.cantidad) || 0), 0);

  return total > 0 ? total : null;
}

export function duracionEnDias(eventual) {
  if (!eventual.fechaInicio || !eventual.fechaFin) return null;
  const desde = new Date(eventual.fechaInicio).getTime();
  const hasta = new Date(eventual.fechaFin).getTime();
  if (!Number.isFinite(desde) || !Number.isFinite(hasta) || hasta < desde) return null;
  // Inclusivo: un eventual que empieza y termina el mismo día duró 1 día.
  return Math.round((hasta - desde) / MS_POR_DIA) + 1;
}

/* =======================
   Bloques de rendimiento (producción por hora-hombre)
======================= */

/**
 * Arma un indicador de producción por eventual: total producido ÷ cantidad de
 * eventuales que registraron ese trabajo. Los eventuales que no lo hicieron no
 * entran en el denominador, así el promedio dice cuánto se produce en un
 * eventual que efectivamente hace ese trabajo.
 *
 * No se divide por horas: el sistema no registra cuántas horas se dedicaron a
 * cada trabajo, y las horas totales del eventual también cubren los demás.
 */
function construirProduccion({ eventuales, clave, titulo, unidad, obtenerProduccion }) {
  const muestras = [];

  for (const eventual of eventuales) {
    const produccion = obtenerProduccion(eventual);
    if (produccion === null) continue;

    muestras.push({ id: eventual.id, nombre: eventual.nombre, valor: redondear(produccion, 2) });
  }

  muestras.sort((a, b) => b.valor - a.valor);

  return {
    clave,
    titulo,
    unidad,
    muestras,
    total: redondear(muestras.reduce((acc, m) => acc + m.valor, 0), 2),
    stats: resumenEstadistico(muestras.map((m) => m.valor)),
  };
}

/* =======================
   Dotación
======================= */

function construirDotacion(eventuales) {
  const muestras = [];

  for (const eventual of eventuales) {
    const browix = parseJson(eventual.horasBrowix);
    const jornadas = Number(browix?.cantidadFichajes);
    const dias = duracionEnDias(eventual);
    if (!Number.isFinite(jornadas) || jornadas <= 0 || !dias) continue;

    const personas = Array.isArray(browix?.personas) ? browix.personas.length : null;
    const horas = horasDelEventual(eventual);

    muestras.push({
      id: eventual.id,
      nombre: eventual.nombre,
      jornadas,
      dias,
      personas,
      horas: redondear(horas, 2),
      // Personas promedio por día: jornadas trabajadas repartidas en los días
      // que duró el trabajo.
      dotacion: redondear(jornadas / dias, 2),
      horasPorJornada: horas ? redondear(horas / jornadas, 2) : null,
    });
  }

  muestras.sort((a, b) => b.dotacion - a.dotacion);

  const stats = resumenEstadistico(muestras.map((m) => m.dotacion));
  const statsDias = resumenEstadistico(muestras.map((m) => m.dias));

  return {
    muestras,
    stats,
    statsDias,
    jornadasTotales: muestras.reduce((acc, m) => acc + m.jornadas, 0),
  };
}

/* =======================
   Cuadrillas
======================= */

// Personas distintas (legajos) que fichó el eventual. Null si no hay horas importadas.
function personasDelEventual(eventual) {
  const browix = parseJson(eventual.horasBrowix);
  if (!Array.isArray(browix?.personas)) return null;
  const legajos = new Set(browix.personas.map((p) => p?.legajo).filter(Boolean).map(String));
  return legajos.size > 0 ? legajos.size : null;
}

/**
 * Tamaño de cuadrilla (personas distintas por eventual) y su relación con lo
 * producido. La relación es un gráfico de puntos, no una tasa: no se divide
 * nada, se muestra cuánta gente se puso en trabajos de cada tamaño.
 */
function construirCuadrillas(eventuales) {
  const muestras = [];

  for (const eventual of eventuales) {
    const personas = personasDelEventual(eventual);
    if (personas === null) continue;

    muestras.push({
      id: eventual.id,
      nombre: eventual.nombre,
      personas,
      desmalezado: produccionCanonica(eventual, "DESMALEZADO"),
      retiroPoda: produccionCanonica(eventual, "RETIRO_PODA"),
    });
  }

  muestras.sort((a, b) => b.personas - a.personas);

  const puntos = (campo) =>
    muestras
      .filter((m) => m[campo] !== null)
      .map((m) => ({ id: m.id, nombre: m.nombre, personas: m.personas, produccion: redondear(m[campo], 2) }));

  return {
    muestras,
    stats: resumenEstadistico(muestras.map((m) => m.personas)),
    relacion: {
      desmalezado: { unidad: "m²", puntos: puntos("desmalezado") },
      retiroPoda: { unidad: "m³", puntos: puntos("retiroPoda") },
    },
  };
}

/* =======================
   Estacionalidad
======================= */

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function claveMes(fecha) {
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Actividad por mes según la fecha de inicio del eventual: cuántos hubo, cuántas
 * personas distintas intervinieron y cuántas horas se trabajaron. Un eventual que
 * cruza dos meses se atribuye por completo al mes en que empezó. Se rellenan los
 * meses sin actividad entre el primero y el último para que el gráfico no salte.
 */
function construirEstacionalidad(eventuales) {
  const porMes = new Map();

  for (const eventual of eventuales) {
    const clave = eventual.fechaInicio ? claveMes(eventual.fechaInicio) : null;
    if (!clave) continue;

    const actual = porMes.get(clave) || { clave, eventuales: 0, legajos: new Set(), horas: 0 };
    actual.eventuales += 1;

    const browix = parseJson(eventual.horasBrowix);
    for (const persona of Array.isArray(browix?.personas) ? browix.personas : []) {
      if (persona?.legajo) actual.legajos.add(String(persona.legajo));
    }
    actual.horas += horasDelEventual(eventual) || 0;
    porMes.set(clave, actual);
  }

  if (porMes.size === 0) return { meses: [], stats: resumenEstadistico([]) };

  const claves = Array.from(porMes.keys()).sort();
  const [anioDesde, mesDesde] = claves[0].split("-").map(Number);
  const [anioHasta, mesHasta] = claves[claves.length - 1].split("-").map(Number);
  const meses = [];

  for (let anio = anioDesde, mes = mesDesde; anio < anioHasta || (anio === anioHasta && mes <= mesHasta); ) {
    const clave = `${anio}-${String(mes).padStart(2, "0")}`;
    const dato = porMes.get(clave);
    meses.push({
      clave,
      etiqueta: `${MESES_CORTOS[mes - 1]} ${String(anio).slice(2)}`,
      eventuales: dato?.eventuales || 0,
      personas: dato?.legajos.size || 0,
      horas: redondear(dato?.horas || 0, 1),
    });
    mes += 1;
    if (mes > 12) { mes = 1; anio += 1; }
  }

  const conActividad = meses.filter((m) => m.eventuales > 0);
  const pico = conActividad.reduce((mejor, m) => (!mejor || m.horas > mejor.horas ? m : mejor), null);

  return {
    meses,
    pico: pico ? { etiqueta: pico.etiqueta, horas: pico.horas } : null,
    stats: resumenEstadistico(meses.map((m) => m.eventuales)),
  };
}

/* =======================
   Parque de equipos
======================= */

function construirParqueEquipos(eventuales) {
  const conMaquinas = eventuales.filter((e) => {
    const maquinas = parseJson(e.maquinasUtilizadas);
    return Array.isArray(maquinas) && maquinas.length > 0;
  });

  const porTipo = new Map();

  for (const eventual of conMaquinas) {
    const maquinas = parseJson(eventual.maquinasUtilizadas) || [];
    for (const maquina of maquinas) {
      const tipo = String(maquina?.tipo || "").trim();
      if (!tipo) continue;

      const cantidad = Number(maquina.cantidad) || 0;
      const actual = porTipo.get(tipo) || { tipo, eventuales: 0, unidadesTotales: 0, identificadas: 0 };
      actual.eventuales += 1;
      actual.unidadesTotales += cantidad;
      // `maquinaIds` solo viene cuando el supervisor eligió máquinas puntuales
      // en vez de cargar tipo + cantidad; sin él no hay forma de llegar a la
      // máquina concreta ni, más adelante, a su amortización.
      if (Array.isArray(maquina.maquinaIds)) actual.identificadas += maquina.maquinaIds.length;
      porTipo.set(tipo, actual);
    }
  }

  const base = conMaquinas.length;
  const equipos = Array.from(porTipo.values())
    .map((e) => ({
      ...e,
      promedioPorEventual: redondear(e.unidadesTotales / e.eventuales, 2),
      presencia: base > 0 ? redondear((e.eventuales / base) * 100, 1) : null,
    }))
    .sort((a, b) => b.eventuales - a.eventuales || b.unidadesTotales - a.unidadesTotales);

  return {
    equipos,
    eventualesConEquipos: base,
    unidadesTotales: equipos.reduce((acc, e) => acc + e.unidadesTotales, 0),
    // Cuántas de las unidades cargadas apuntan a una máquina concreta del
    // inventario. Es lo que hoy limita cualquier cálculo de costo de máquina.
    unidadesIdentificadas: equipos.reduce((acc, e) => acc + e.identificadas, 0),
  };
}

/* =======================
   Generales
======================= */

function construirGenerales(eventuales) {
  const categoriasMap = new Map();
  const legajos = new Set();
  let horasHombre = 0;

  for (const eventual of eventuales) {
    const browix = parseJson(eventual.horasBrowix);
    if (!browix) continue;

    const horas = Number(browix.totalHoras);
    if (Number.isFinite(horas)) horasHombre += horas;

    for (const persona of Array.isArray(browix.personas) ? browix.personas : []) {
      if (persona?.legajo) legajos.add(String(persona.legajo));
    }

    for (const categoria of Array.isArray(browix.categorias) ? browix.categorias : []) {
      const clave = categoria?.categoria || "Sin categoría";
      const actual = categoriasMap.get(clave) || { categoria: clave, horas: 0, eventuales: 0 };
      actual.horas += Number(categoria.totalHoras) || 0;
      actual.eventuales += 1;
      categoriasMap.set(clave, actual);
    }
  }

  const totalCategorias = Array.from(categoriasMap.values()).reduce((acc, c) => acc + c.horas, 0);
  const categorias = Array.from(categoriasMap.values())
    .map((c) => ({
      ...c,
      horas: redondear(c.horas, 1),
      porcentaje: totalCategorias > 0 ? redondear((c.horas / totalCategorias) * 100, 1) : null,
    }))
    .sort((a, b) => b.horas - a.horas);

  // Volumen producido, siempre separado por unidad: sumar m² con m³ o con
  // unidades de árbol no significa nada.
  const volumenMap = new Map();
  let trabajosTotales = 0;
  let trabajosCanonicos = 0;
  const desviosDeCarga = [];

  for (const eventual of eventuales) {
    for (const trabajo of trabajosDelEventual(eventual)) {
      const tipo = String(trabajo?.tipo || "").trim();
      const unidad = String(trabajo?.unidadMedida || "").trim();
      const cantidad = Number(trabajo?.cantidad) || 0;
      if (!tipo || !unidad || cantidad <= 0) continue;

      trabajosTotales += 1;
      const esperada = UNIDAD_CANONICA_POR_TRABAJO[tipo];

      if (!esperada || esperada === unidad) {
        trabajosCanonicos += 1;
      } else {
        desviosDeCarga.push({
          id: eventual.id,
          nombre: eventual.nombre,
          trabajo: LABEL_TRABAJO[tipo] || tipo,
          unidadCargada: LABEL_UNIDAD[unidad] || unidad,
          unidadEsperada: LABEL_UNIDAD[esperada] || esperada,
          cantidad,
        });
      }

      const actual = volumenMap.get(unidad) || { unidad, unidadLabel: LABEL_UNIDAD[unidad] || unidad, total: 0, trabajos: 0 };
      actual.total += cantidad;
      actual.trabajos += 1;
      volumenMap.set(unidad, actual);
    }
  }

  const volumen = Array.from(volumenMap.values())
    .map((v) => ({ ...v, total: redondear(v.total, 2) }))
    .sort((a, b) => b.trabajos - a.trabajos);

  const sinHoras = eventuales.filter((e) => !parseJson(e.horasBrowix)).length;
  const sinInsumosImportados = eventuales.filter((e) => {
    const importados = parseJson(e.insumosImportados);
    const items = Array.isArray(importados?.insumos) ? importados.insumos : importados;
    return !Array.isArray(items) || items.length === 0;
  }).length;
  const sinMaquinas = eventuales.filter((e) => {
    const maquinas = parseJson(e.maquinasUtilizadas);
    return !Array.isArray(maquinas) || maquinas.length === 0;
  }).length;

  return {
    horasHombre: redondear(horasHombre, 1),
    personas: legajos.size,
    categorias,
    volumen,
    calidadCarga: {
      trabajosTotales,
      trabajosCanonicos,
      porcentaje: trabajosTotales > 0 ? redondear((trabajosCanonicos / trabajosTotales) * 100, 1) : null,
      desvios: desviosDeCarga,
    },
    cierresIncompletos: { sinHoras, sinInsumosImportados, sinMaquinas, base: eventuales.length },
  };
}

/* =======================
   Entrada pública
======================= */

export async function getKpisEspaciosVerdes() {
  const eventuales = await prisma.eventual.findMany({
    where: { tipo: TIPO_ESPACIOS_VERDES, activo: true },
    select: {
      id: true,
      nombre: true,
      estado: true,
      fechaInicio: true,
      fechaFin: true,
      horasBrowix: true,
      trabajosRealizados: true,
      insumosExtras: true,
      insumosImportados: true,
      maquinasUtilizadas: true,
    },
  });

  // Los campos de cierre solo se completan al finalizar: medir sobre un
  // eventual en curso mezclaría trabajos a medio cargar con trabajos cerrados.
  const finalizados = eventuales.filter((e) => e.estado === "finalizado");

  return {
    generadoEn: new Date().toISOString(),
    alcance: {
      total: eventuales.length,
      finalizados: finalizados.length,
      enCurso: eventuales.filter((e) => e.estado === "activo").length,
      conHoras: finalizados.filter((e) => parseJson(e.horasBrowix)).length,
    },
    generales: construirGenerales(finalizados),
    rendimientos: {
      desmalezado: construirProduccion({
        eventuales: finalizados,
        clave: "desmalezado",
        titulo: "Desmalezado por eventual",
        unidad: "m²",
        obtenerProduccion: (e) => produccionCanonica(e, "DESMALEZADO"),
      }),
      retiroPoda: construirProduccion({
        eventuales: finalizados,
        clave: "retiroPoda",
        titulo: "Retiro de poda por eventual",
        unidad: "m³",
        obtenerProduccion: (e) => produccionCanonica(e, "RETIRO_PODA"),
      }),
      combustible: construirProduccion({
        eventuales: finalizados,
        clave: "combustible",
        titulo: "Combustible por eventual",
        unidad: "litros",
        obtenerProduccion: litrosCombustible,
      }),
    },
    dotacion: construirDotacion(finalizados),
    cuadrillas: construirCuadrillas(finalizados),
    estacionalidad: construirEstacionalidad(finalizados),
    parqueEquipos: construirParqueEquipos(finalizados),
  };
}
