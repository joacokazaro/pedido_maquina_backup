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

const LABEL_UNIDAD = {
  M2: "m²",
  M3: "m³",
  UNIDAD: "unidades",
  METROS_LINEALES: "m lineales",
  HORAS: "horas",
  KG: "kg",
};

const LABEL_TRABAJO = {
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

function parseJson(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function redondear(valor, decimales = 2) {
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

/**
 * Intervalos media ± k·desvío. Las coberturas son las de una distribución
 * normal (68,3% / 95,4%), así que valen como referencia, no como garantía:
 * con una decena de casos no hay cómo afirmar que el rendimiento se
 * distribuye normal. La UI lo dice explícitamente.
 */
export function bandasDesvio(media, desvio) {
  if (!Number.isFinite(media) || !Number.isFinite(desvio) || desvio <= 0) return [];

  return [
    { sigmas: 1, cobertura: 68.3, desde: redondear(media - desvio, 2), hasta: redondear(media + desvio, 2) },
    { sigmas: 2, cobertura: 95.4, desde: redondear(media - 2 * desvio, 2), hasta: redondear(media + 2 * desvio, 2) },
  ];
}

/** Cuántos valores de la muestra caen efectivamente dentro de media ± 1 desvío. */
export function dentroDeUnaBanda(valores, media, desvio) {
  if (!Number.isFinite(media) || !Number.isFinite(desvio) || desvio <= 0) return null;
  return valores.filter((v) => v >= media - desvio && v <= media + desvio).length;
}

/* =======================
   Lectura de los campos de cierre
======================= */

function horasDelEventual(eventual) {
  const browix = parseJson(eventual.horasBrowix);
  const horas = Number(browix?.totalHoras);
  return Number.isFinite(horas) && horas > 0 ? horas : null;
}

function trabajosDelEventual(eventual) {
  const trabajos = parseJson(eventual.trabajosRealizados);
  return Array.isArray(trabajos) ? trabajos : [];
}

/**
 * Producción de un tipo de trabajo en su unidad canónica. Devuelve null si el
 * eventual no lo registró o si lo cargó en otra unidad — el caso real es un
 * eventual con `DESMALEZADO` medido en horas, que no es una superficie mal
 * etiquetada sino otra magnitud, y no se puede convertir.
 */
function produccionCanonica(eventual, tipoTrabajo) {
  const unidadEsperada = UNIDAD_CANONICA_POR_TRABAJO[tipoTrabajo];
  const total = trabajosDelEventual(eventual)
    .filter((t) => t?.tipo === tipoTrabajo && t?.unidadMedida === unidadEsperada)
    .reduce((acc, t) => acc + (Number(t.cantidad) || 0), 0);

  return total > 0 ? total : null;
}

function litrosCombustible(eventual) {
  const insumos = parseJson(eventual.insumosExtras);
  if (!Array.isArray(insumos)) return null;

  const total = insumos
    .filter((i) => INSUMOS_COMBUSTIBLE.includes(i?.tipo) && i?.unidadMedida === "LITROS")
    .reduce((acc, i) => acc + (Number(i.cantidad) || 0), 0);

  return total > 0 ? total : null;
}

function duracionEnDias(eventual) {
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
 * Arma un indicador de tasa: producción ÷ horas-hombre, un valor por eventual.
 *
 * El denominador son las horas **totales** del eventual, no las horas
 * imputadas a ese trabajo — el sistema no registra ese detalle. Cuando un
 * eventual hizo además otros trabajos, su tasa queda subestimada; esos casos
 * se marcan como `mixto` y se cuentan aparte para que la lectura sea honesta.
 */
function construirRendimiento({ eventuales, clave, titulo, unidadRatio, obtenerProduccion, unidadProduccion }) {
  const muestras = [];
  const excluidos = [];

  for (const eventual of eventuales) {
    const produccion = obtenerProduccion(eventual);
    if (produccion === null) continue;

    const horas = horasDelEventual(eventual);
    if (horas === null) {
      excluidos.push({ id: eventual.id, nombre: eventual.nombre, motivo: "Sin horas importadas" });
      continue;
    }

    const tiposDistintos = new Set(trabajosDelEventual(eventual).map((t) => t?.tipo).filter(Boolean));

    muestras.push({
      id: eventual.id,
      nombre: eventual.nombre,
      valor: redondear(produccion / horas, 3),
      produccion: redondear(produccion, 2),
      horas: redondear(horas, 2),
      // Marca los eventuales donde las horas también cubren otros trabajos.
      mixto: tiposDistintos.size > 1,
    });
  }

  muestras.sort((a, b) => b.valor - a.valor);

  const valores = muestras.map((m) => m.valor);
  const stats = resumenEstadistico(valores);
  const bandas = bandasDesvio(stats.media, stats.desvio);

  return {
    clave,
    titulo,
    unidadRatio,
    unidadProduccion,
    muestras,
    stats,
    bandas,
    dentroDeUnDesvio: dentroDeUnaBanda(valores, stats.media, stats.desvio),
    mixtos: muestras.filter((m) => m.mixto).length,
    excluidos,
    // Cuántas veces rinde el mejor respecto del peor. Es la lectura que
    // justifica el indicador: si todos rinden parecido, no hay nada que gestionar.
    brecha: stats.min > 0 ? redondear(stats.max / stats.min, 1) : null,
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
      desmalezado: construirRendimiento({
        eventuales: finalizados,
        clave: "desmalezado",
        titulo: "Rendimiento de desmalezado",
        unidadRatio: "m²/hora-hombre",
        unidadProduccion: "m²",
        obtenerProduccion: (e) => produccionCanonica(e, "DESMALEZADO"),
      }),
      retiroPoda: construirRendimiento({
        eventuales: finalizados,
        clave: "retiroPoda",
        titulo: "Rendimiento de retiro de poda",
        unidadRatio: "m³/hora-hombre",
        unidadProduccion: "m³",
        obtenerProduccion: (e) => produccionCanonica(e, "RETIRO_PODA"),
      }),
      combustible: construirRendimiento({
        eventuales: finalizados,
        clave: "combustible",
        titulo: "Consumo de combustible",
        unidadRatio: "litros/hora-hombre",
        unidadProduccion: "litros",
        obtenerProduccion: litrosCombustible,
      }),
    },
    dotacion: construirDotacion(finalizados),
    parqueEquipos: construirParqueEquipos(finalizados),
  };
}
