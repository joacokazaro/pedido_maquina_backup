import prisma from "../db/prisma.js";
import { ESTADOS_PEDIDO_VALIDOS, ESTADOS_PEDIDO_TERMINALES } from "../constants/estadosPedidos.js";
import { ESTADOS_MAQUINA_VALIDOS, normalizeEstadoMaquina } from "./inventarioEstados.service.js";
import { computeResumenStockMaquinas } from "./maquinaStock.service.js";
import { parseFechaFiltro } from "./taller.service.js";
import { getAsignacionActivaPorMaquina } from "./asignacionesPedido.service.js";

/* ========================================================
   HELPERS DE FECHA (zona horaria Argentina, sin librerías)
======================================================== */
function getYearMonthArgentina(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  return `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}`;
}

function getDateOnlyArgentina(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

// Lunes de la semana ART que contiene `date`, como "YYYY-MM-DD".
// Ancla al mediodía UTC del día calendario para no correr de día por el offset ART.
function getSemanaKeyArgentina(date) {
  const local = new Date(`${getDateOnlyArgentina(date)}T12:00:00.000Z`);
  const diaSemana = local.getUTCDay(); // 0=domingo..6=sabado
  const offsetALunes = diaSemana === 0 ? 6 : diaSemana - 1;
  local.setUTCDate(local.getUTCDate() - offsetALunes);
  return local.toISOString().slice(0, 10);
}

const DEFAULT_RANGO_DIAS = 30;

function resolverRangoPeriodo(desde, hasta) {
  const desdeDate = parseFechaFiltro(desde, false);
  const hastaDate = parseFechaFiltro(hasta, true);
  if (desdeDate && hastaDate && desdeDate <= hastaDate) {
    return { desde: desdeDate, hasta: hastaDate };
  }
  const hastaDefault = new Date();
  const desdeDefault = new Date(hastaDefault.getTime() - DEFAULT_RANGO_DIAS * 86400000);
  return { desde: desdeDefault, hasta: hastaDefault };
}

/* ========================================================
   SECCIÓN "TIEMPO REAL"
======================================================== */
async function getResumenPedidosAbiertos() {
  const grupos = await prisma.pedido.groupBy({
    by: ["estado"],
    where: { estado: { notIn: ESTADOS_PEDIDO_TERMINALES } },
    _count: { _all: true },
  });
  const cantidadPorEstado = new Map(grupos.map((g) => [g.estado, g._count._all]));

  // Se listan siempre los mismos estados abiertos, en el mismo orden, aunque
  // algún estado tenga 0 pedidos ahora mismo — así el gráfico no "salta" de
  // categorías entre refrescos.
  const porEstado = ESTADOS_PEDIDO_VALIDOS.filter((e) => !ESTADOS_PEDIDO_TERMINALES.includes(e)).map((estado) => ({
    estado,
    cantidad: cantidadPorEstado.get(estado) || 0,
  }));
  const total = porEstado.reduce((acc, item) => acc + item.cantidad, 0);
  return { total, porEstado };
}

function buildStockMaquinasResumen(porEstado) {
  const items = ESTADOS_MAQUINA_VALIDOS.map((estado) => ({ estado, cantidad: porEstado[estado] || 0 }));
  const total = items.reduce((acc, item) => acc + item.cantidad, 0);
  return { total, porEstado: items };
}

function buildComposicionPorTipo(porTipo) {
  return Object.entries(porTipo)
    .map(([tipo, datos]) => ({ tipo, ...datos }))
    .sort((a, b) => b.total - a.total);
}

export async function getResumenTiempoReal() {
  const [pedidosAbiertos, maquinas] = await Promise.all([getResumenPedidosAbiertos(), prisma.maquina.findMany()]);
  const { porEstado, porTipo } = computeResumenStockMaquinas(maquinas);

  return {
    generadoEn: new Date().toISOString(),
    pedidosAbiertos,
    stockMaquinas: buildStockMaquinasResumen(porEstado),
    composicionPorTipo: buildComposicionPorTipo(porTipo),
  };
}

/* ========================================================
   SECCIÓN "AVISOS"
======================================================== */
async function getPedidosEstancados({ amarillo, rojo }) {
  const abiertos = await prisma.pedido.findMany({
    where: { estado: { notIn: ESTADOS_PEDIDO_TERMINALES } },
    select: {
      id: true,
      estado: true,
      createdAt: true,
      servicio: { select: { nombre: true } },
      supervisor: { select: { nombre: true, username: true } },
    },
  });
  if (!abiertos.length) return { total: 0, items: [] };

  const ultimaFechaPorPedido = await prisma.historialPedido.groupBy({
    by: ["pedidoId"],
    where: { pedidoId: { in: abiertos.map((p) => p.id) } },
    _max: { fecha: true },
  });
  const ultimaFechaMap = new Map(ultimaFechaPorPedido.map((h) => [h.pedidoId, h._max.fecha]));

  const ahora = Date.now();
  const items = abiertos
    .map((p) => {
      const referencia = ultimaFechaMap.get(p.id) || p.createdAt;
      const diasEnEstado = Math.floor((ahora - new Date(referencia).getTime()) / 86400000);
      return {
        pedidoId: p.id,
        estado: p.estado,
        servicio: p.servicio?.nombre || null,
        supervisor: p.supervisor?.nombre || p.supervisor?.username || null,
        diasEnEstado,
        semaforo: diasEnEstado > rojo ? "rojo" : "amarillo",
      };
    })
    .filter((p) => p.diasEnEstado > amarillo)
    .sort((a, b) => b.diasEnEstado - a.diasEnEstado);

  return { total: items.length, items };
}

async function getMaquinasNoDevueltas() {
  const todas = await prisma.maquina.findMany({ select: { id: true, tipo: true, modelo: true, estado: true } });
  const maquinas = todas.filter((m) => normalizeEstadoMaquina(m.estado) === "no_devuelta");
  if (!maquinas.length) return { total: 0, items: [] };

  const asignacionPorMaquina = await getAsignacionActivaPorMaquina(maquinas);
  const ahora = Date.now();

  const items = maquinas
    .map((m) => {
      const asignacion = asignacionPorMaquina.get(m.id) || null;
      // Antigüedad aproximada por fecha de creación del pedido que la tiene
      // afuera (reusa getAsignacionActivaPorMaquina, ya probado) — no la
      // fecha exacta del hito ENTREGADO, que suele ser muy cercana igual.
      const diasDesdeEntrega = asignacion ? Math.floor((ahora - new Date(asignacion.createdAt).getTime()) / 86400000) : null;
      return {
        maquinaId: m.id,
        tipo: m.tipo,
        modelo: m.modelo,
        pedidoId: asignacion?.pedidoId || null,
        servicio: asignacion?.servicio?.nombre || null,
        supervisor: asignacion?.supervisor?.nombre || asignacion?.supervisor?.username || null,
        diasDesdeEntrega,
      };
    })
    .sort((a, b) => (b.diasDesdeEntrega ?? -1) - (a.diasDesdeEntrega ?? -1));

  return { total: items.length, items };
}

const CAMPOS_VENCIMIENTO_VEHICULO = [
  { campo: "vtoSeguro", aplicaCampo: "vtoSeguroAplica", label: "Seguro" },
  { campo: "vtoMatafuego", aplicaCampo: "vtoMatafuegoAplica", label: "Matafuego" },
  { campo: "vtoItv", aplicaCampo: "vtoItvAplica", label: "ITV" },
  { campo: "obleaGnc", aplicaCampo: "obleaGncAplica", label: "Oblea GNC" },
  { campo: "pruebaHidraulicaGnc", aplicaCampo: "pruebaHidraulicaGncAplica", label: "Prueba hidráulica GNC" },
];
const UMBRAL_VENCIMIENTO_ROJO_DIAS = 7;

async function getVencimientosVehiculos({ ventanaVencimiento }) {
  const vehiculos = await prisma.vehiculo.findMany({
    where: { estado: { not: "baja" } },
    select: {
      id: true,
      patente: true,
      vehiculo: true,
      empresa: true,
      vtoSeguro: true,
      vtoSeguroAplica: true,
      vtoMatafuego: true,
      vtoMatafuegoAplica: true,
      vtoItv: true,
      vtoItvAplica: true,
      obleaGnc: true,
      obleaGncAplica: true,
      pruebaHidraulicaGnc: true,
      pruebaHidraulicaGncAplica: true,
    },
  });

  const ahora = Date.now();
  const items = [];
  for (const v of vehiculos) {
    for (const { campo, aplicaCampo, label } of CAMPOS_VENCIMIENTO_VEHICULO) {
      if (!v[aplicaCampo] || !v[campo]) continue;
      const diasRestantes = Math.floor((new Date(v[campo]).getTime() - ahora) / 86400000);
      if (diasRestantes > ventanaVencimiento) continue;
      items.push({
        vehiculoId: v.id,
        patente: v.patente,
        vehiculo: v.vehiculo,
        empresa: v.empresa,
        tipoVencimiento: label,
        fechaVencimiento: v[campo],
        diasRestantes,
        semaforo: diasRestantes <= UMBRAL_VENCIMIENTO_ROJO_DIAS ? "rojo" : "amarillo",
      });
    }
  }
  items.sort((a, b) => a.diasRestantes - b.diasRestantes);
  return { total: items.length, items };
}

export async function getResumenAvisos({ umbralAmarillo, umbralRojo, diasVentanaVencimiento } = {}) {
  const amarillo = Number(umbralAmarillo) > 0 ? Number(umbralAmarillo) : 5;
  const rojo = Number(umbralRojo) > amarillo ? Number(umbralRojo) : 10;
  const ventanaVencimiento = Number(diasVentanaVencimiento) > 0 ? Number(diasVentanaVencimiento) : 30;

  const [pedidosEstancados, maquinasNoDevueltas, vencimientosVehiculos] = await Promise.all([
    getPedidosEstancados({ amarillo, rojo }),
    getMaquinasNoDevueltas(),
    getVencimientosVehiculos({ ventanaVencimiento }),
  ]);

  return {
    umbrales: {
      pedidosEstancados: { amarillo, rojo },
      vencimientos: { rojo: UMBRAL_VENCIMIENTO_ROJO_DIAS, ventana: ventanaVencimiento },
    },
    pedidosEstancados,
    maquinasNoDevueltas,
    vencimientosVehiculos,
  };
}

/* ========================================================
   SECCIÓN "PERÍODO"
======================================================== */
async function getTendenciaCreacionPedidos({ desde, hasta }) {
  const pedidos = await prisma.pedido.findMany({
    where: { createdAt: { gte: desde, lte: hasta } },
    select: { createdAt: true },
  });

  const conteoPorSemana = new Map();
  for (const p of pedidos) {
    const key = getSemanaKeyArgentina(p.createdAt);
    conteoPorSemana.set(key, (conteoPorSemana.get(key) || 0) + 1);
  }

  // Semanas sin pedidos igual aparecen con cantidad 0, para que la línea no
  // tenga huecos que se confundan con "sin datos" del gráfico.
  const semanas = [];
  let cursor = new Date(`${getSemanaKeyArgentina(desde)}T12:00:00.000Z`);
  const fin = new Date(`${getSemanaKeyArgentina(hasta)}T12:00:00.000Z`);
  while (cursor <= fin) {
    const key = cursor.toISOString().slice(0, 10);
    semanas.push({ semana: key, cantidad: conteoPorSemana.get(key) || 0 });
    cursor = new Date(cursor.getTime() + 7 * 86400000);
  }
  return semanas;
}

const ACCIONES_HITO = {
  PREPARADO: ["MAQUINAS_ASIGNADAS"],
  ENTREGADO: ["ENTREGADO"],
  CERRADO: ["DEVOLUCION_CONFIRMADA", "DEVOLUCION_CONFIRMADA_DIRECTA"],
};
const ACCIONES_OVERRIDE_MANUAL = ["ESTADO_ACTUALIZADO", "ADMIN_CAMBIO_ESTADO"];

function parseDetalleJson(detalle) {
  if (!detalle) return null;
  try {
    return JSON.parse(detalle);
  } catch {
    return null;
  }
}

// Primera fila de `historial` (ya ordenado asc) que representa haber
// alcanzado `estadoObjetivo`, sea por la acción "normal" del flujo o por un
// override manual de admin. Si no se encuentra ninguna, la etapa
// correspondiente simplemente no aporta dato — no se fuerza nada.
function encontrarHito(historial, estadoObjetivo) {
  for (const fila of historial) {
    if (ACCIONES_HITO[estadoObjetivo].includes(fila.accion)) return fila.fecha;
    if (ACCIONES_OVERRIDE_MANUAL.includes(fila.accion)) {
      const detalle = parseDetalleJson(fila.detalle);
      if (detalle?.nuevoEstado === estadoObjetivo) return fila.fecha;
    }
  }
  return null;
}

function percentilMs(sortedMs, p) {
  if (!sortedMs.length) return null;
  const idx = Math.min(sortedMs.length - 1, Math.max(0, Math.ceil(p * sortedMs.length) - 1));
  return sortedMs[idx];
}

function buildEtapaResumen(etapa, duracionesMs) {
  const sorted = [...duracionesMs].sort((a, b) => a - b);
  const medianaMs = percentilMs(sorted, 0.5);
  const p90Ms = percentilMs(sorted, 0.9);
  const aHoras = (ms) => (ms === null ? null : Math.round((ms / 3600000) * 10) / 10);
  return { etapa, muestras: sorted.length, medianaHoras: aHoras(medianaMs), p90Horas: aHoras(p90Ms) };
}

async function getTiempoCicloPorEtapa({ desde, hasta }) {
  const pedidos = await prisma.pedido.findMany({
    where: { createdAt: { gte: desde, lte: hasta } },
    select: {
      id: true,
      createdAt: true,
      historial: { orderBy: { fecha: "asc" }, select: { accion: true, detalle: true, fecha: true } },
    },
  });

  const duraciones = { CREADO_PREPARADO: [], PREPARADO_ENTREGADO: [], ENTREGADO_CERRADO: [] };

  for (const pedido of pedidos) {
    const fechaPreparado = encontrarHito(pedido.historial, "PREPARADO");
    const fechaEntregado = encontrarHito(pedido.historial, "ENTREGADO");
    const fechaCerrado = encontrarHito(pedido.historial, "CERRADO");

    if (fechaPreparado) {
      const diff = new Date(fechaPreparado).getTime() - new Date(pedido.createdAt).getTime();
      if (diff >= 0) duraciones.CREADO_PREPARADO.push(diff);
    }
    if (fechaPreparado && fechaEntregado) {
      const diff = new Date(fechaEntregado).getTime() - new Date(fechaPreparado).getTime();
      if (diff >= 0) duraciones.PREPARADO_ENTREGADO.push(diff);
    }
    if (fechaEntregado && fechaCerrado) {
      const diff = new Date(fechaCerrado).getTime() - new Date(fechaEntregado).getTime();
      if (diff >= 0) duraciones.ENTREGADO_CERRADO.push(diff);
    }
  }

  return [
    buildEtapaResumen("CREADO_PREPARADO", duraciones.CREADO_PREPARADO),
    buildEtapaResumen("PREPARADO_ENTREGADO", duraciones.PREPARADO_ENTREGADO),
    buildEtapaResumen("ENTREGADO_CERRADO", duraciones.ENTREGADO_CERRADO),
  ];
}

const ACCIONES_CIERRE = ["DEVOLUCION_CONFIRMADA", "DEVOLUCION_CONFIRMADA_DIRECTA"];
const ACCIONES_CANCELACION = ["CANCELADO", "CANCELADO_ADMIN"];

async function getFaltantesYCancelacion({ desde, hasta }) {
  const eventos = await prisma.historialPedido.findMany({
    where: { accion: { in: [...ACCIONES_CIERRE, ...ACCIONES_CANCELACION] }, fecha: { gte: desde, lte: hasta } },
    select: { pedidoId: true, accion: true, fecha: true },
    orderBy: { fecha: "asc" },
  });

  // Último evento relevante por pedido, por si hubo más de un intento de
  // cierre/cancelación dentro del mismo rango.
  const clasificacionPorPedido = new Map();
  for (const e of eventos) {
    const tipo = ACCIONES_CANCELACION.includes(e.accion) ? "CANCELADO" : "CERRADO";
    clasificacionPorPedido.set(e.pedidoId, { tipo, fecha: e.fecha });
  }

  const cerrados = [];
  const cancelados = [];
  const porMes = new Map();
  for (const [pedidoId, { tipo, fecha }] of clasificacionPorPedido) {
    const mes = getYearMonthArgentina(fecha);
    if (!porMes.has(mes)) porMes.set(mes, { cerrados: [], cancelados: [] });
    if (tipo === "CERRADO") {
      cerrados.push(pedidoId);
      porMes.get(mes).cerrados.push(pedidoId);
    } else {
      cancelados.push(pedidoId);
      porMes.get(mes).cancelados.push(pedidoId);
    }
  }

  const totalCohorte = cerrados.length + cancelados.length;
  const pctCancelacion = totalCohorte ? Math.round((cancelados.length / totalCohorte) * 1000) / 10 : null;

  let idsConFaltantes = new Set();
  if (cerrados.length) {
    const conFaltantes = await prisma.historialPedido.findMany({
      where: { accion: "FALTANTES_DECLARADOS", pedidoId: { in: cerrados } },
      select: { pedidoId: true },
      distinct: ["pedidoId"],
    });
    idsConFaltantes = new Set(conFaltantes.map((f) => f.pedidoId));
  }
  const pctFaltantes = cerrados.length ? Math.round((idsConFaltantes.size / cerrados.length) * 1000) / 10 : null;

  const mensual = [...porMes.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([mes, datos]) => {
      const total = datos.cerrados.length + datos.cancelados.length;
      const faltantesDelMes = datos.cerrados.filter((id) => idsConFaltantes.has(id)).length;
      return {
        mes,
        totalCohorte: total,
        pctCancelacion: total ? Math.round((datos.cancelados.length / total) * 1000) / 10 : null,
        pctFaltantes: datos.cerrados.length ? Math.round((faltantesDelMes / datos.cerrados.length) * 1000) / 10 : null,
      };
    });

  return { totalCohorte, pctCancelacion, pctFaltantes, mensual };
}

async function getRankingPedidosPor(campo, { desde, hasta }) {
  const grupos = await prisma.pedido.groupBy({
    by: [campo],
    where: { createdAt: { gte: desde, lte: hasta } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 10,
  });
  if (!grupos.length) return [];

  if (campo === "servicioId") {
    const servicios = await prisma.servicio.findMany({
      where: { id: { in: grupos.map((g) => g.servicioId) } },
      select: { id: true, nombre: true },
    });
    const nombrePorId = new Map(servicios.map((s) => [s.id, s.nombre]));
    return grupos.map((g) => ({ id: g.servicioId, nombre: nombrePorId.get(g.servicioId) || "—", cantidad: g._count.id }));
  }

  const supervisores = await prisma.usuario.findMany({
    where: { id: { in: grupos.map((g) => g.supervisorId) } },
    select: { id: true, nombre: true, username: true },
  });
  const nombrePorId = new Map(supervisores.map((s) => [s.id, s.nombre || s.username]));
  return grupos.map((g) => ({ id: g.supervisorId, nombre: nombrePorId.get(g.supervisorId) || "—", cantidad: g._count.id }));
}

async function getRotacionMaquinas({ desde, hasta }) {
  const movimientos = await prisma.maquinaServicioHistorial.findMany({
    where: { fechaAsignacion: { gte: desde, lte: hasta } },
    select: { maquinaId: true, fechaAsignacion: true },
  });

  const porMes = new Map();
  const porMaquina = new Map();
  for (const m of movimientos) {
    const mes = getYearMonthArgentina(m.fechaAsignacion);
    porMes.set(mes, (porMes.get(mes) || 0) + 1);
    porMaquina.set(m.maquinaId, (porMaquina.get(m.maquinaId) || 0) + 1);
  }

  const tendenciaMensual = [...porMes.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([mes, cantidad]) => ({ mes, cantidad }));

  const topIds = [...porMaquina.entries()].sort(([, a], [, b]) => b - a).slice(0, 10);
  const maquinasInfo = topIds.length
    ? await prisma.maquina.findMany({ where: { id: { in: topIds.map(([id]) => id) } }, select: { id: true, tipo: true, modelo: true } })
    : [];
  const infoPorId = new Map(maquinasInfo.map((m) => [m.id, m]));
  const topMaquinas = topIds.map(([id, cantidad]) => ({
    maquinaId: id,
    tipo: infoPorId.get(id)?.tipo || null,
    modelo: infoPorId.get(id)?.modelo || null,
    movimientos: cantidad,
  }));

  return { tendenciaMensual, topMaquinas };
}

// TallerMovimiento no vincula un egreso con "su" ingreso — se recorre en
// orden cronológico por máquina emparejando cada egreso con el ingreso
// abierto más reciente. Un egreso sin ingreso previo se descarta; un ingreso
// repetido sin egreso intermedio reemplaza al anterior.
async function getTiempoPromedioTaller({ desde, hasta }) {
  const movimientos = await prisma.tallerMovimiento.findMany({
    where: { tipo: "maquina", maquinaId: { not: null } },
    select: { maquinaId: true, accion: true, createdAt: true },
    orderBy: [{ maquinaId: "asc" }, { createdAt: "asc" }],
  });

  const pares = [];
  let ingresoAbierto = null;
  let maquinaActual = null;
  for (const mov of movimientos) {
    if (mov.maquinaId !== maquinaActual) {
      maquinaActual = mov.maquinaId;
      ingresoAbierto = null;
    }
    if (mov.accion === "ingreso") {
      ingresoAbierto = mov.createdAt;
    } else if (mov.accion === "egreso") {
      if (ingresoAbierto) pares.push({ maquinaId: mov.maquinaId, ingreso: ingresoAbierto, egreso: mov.createdAt });
      ingresoAbierto = null;
    }
  }

  const paresEnRango = pares.filter((p) => p.egreso >= desde && p.egreso <= hasta);
  if (!paresEnRango.length) return [];

  const maquinaIds = [...new Set(paresEnRango.map((p) => p.maquinaId))];
  const maquinas = await prisma.maquina.findMany({ where: { id: { in: maquinaIds } }, select: { id: true, tipo: true } });
  const tipoPorId = new Map(maquinas.map((m) => [m.id, m.tipo || "SIN_TIPO"]));

  const duracionesPorTipo = new Map();
  for (const p of paresEnRango) {
    const tipo = tipoPorId.get(p.maquinaId) || "SIN_TIPO";
    const duracionDias = (new Date(p.egreso).getTime() - new Date(p.ingreso).getTime()) / 86400000;
    if (!duracionesPorTipo.has(tipo)) duracionesPorTipo.set(tipo, []);
    duracionesPorTipo.get(tipo).push(duracionDias);
  }

  return [...duracionesPorTipo.entries()]
    .map(([tipo, duraciones]) => ({
      tipo,
      pares: duraciones.length,
      promedioDias: Math.round((duraciones.reduce((a, b) => a + b, 0) / duraciones.length) * 10) / 10,
    }))
    .sort((a, b) => b.promedioDias - a.promedioDias);
}

async function getMovimientosTallerMensual({ desde, hasta }) {
  const movimientos = await prisma.tallerMovimiento.findMany({
    where: { createdAt: { gte: desde, lte: hasta } },
    select: { accion: true, createdAt: true },
  });

  const porMes = new Map();
  for (const m of movimientos) {
    const mes = getYearMonthArgentina(m.createdAt);
    if (!porMes.has(mes)) porMes.set(mes, { ingresos: 0, egresos: 0 });
    if (m.accion === "ingreso") porMes.get(mes).ingresos += 1;
    else if (m.accion === "egreso") porMes.get(mes).egresos += 1;
  }

  return [...porMes.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([mes, datos]) => ({ mes, ...datos }));
}

async function getRankingIngresosTaller({ desde, hasta }) {
  const grupos = await prisma.tallerMovimiento.groupBy({
    by: ["maquinaId"],
    where: { tipo: "maquina", accion: "ingreso", createdAt: { gte: desde, lte: hasta }, maquinaId: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 10,
  });
  if (!grupos.length) return [];

  const maquinas = await prisma.maquina.findMany({
    where: { id: { in: grupos.map((g) => g.maquinaId) } },
    select: { id: true, tipo: true, modelo: true },
  });
  const infoPorId = new Map(maquinas.map((m) => [m.id, m]));

  return grupos.map((g) => ({
    maquinaId: g.maquinaId,
    tipo: infoPorId.get(g.maquinaId)?.tipo || null,
    modelo: infoPorId.get(g.maquinaId)?.modelo || null,
    ingresos: g._count.id,
  }));
}

export async function getResumenPeriodo({ desde, hasta } = {}) {
  const rango = resolverRangoPeriodo(desde, hasta);

  const [
    tendenciaCreacion,
    tiempoCicloPorEtapa,
    faltantesYCancelacion,
    rankingServicios,
    rankingSupervisores,
    rotacionMaquinas,
    tiempoPromedioTallerPorTipo,
    movimientosTallerMensual,
    rankingIngresosTaller,
  ] = await Promise.all([
    getTendenciaCreacionPedidos(rango),
    getTiempoCicloPorEtapa(rango),
    getFaltantesYCancelacion(rango),
    getRankingPedidosPor("servicioId", rango),
    getRankingPedidosPor("supervisorId", rango),
    getRotacionMaquinas(rango),
    getTiempoPromedioTaller(rango),
    getMovimientosTallerMensual(rango),
    getRankingIngresosTaller(rango),
  ]);

  return {
    desde: rango.desde.toISOString(),
    hasta: rango.hasta.toISOString(),
    tendenciaCreacion,
    tiempoCicloPorEtapa,
    faltantesYCancelacion,
    rankingServicios,
    rankingSupervisores,
    rotacionMaquinas,
    tiempoPromedioTallerPorTipo,
    movimientosTallerMensual,
    rankingIngresosTaller,
  };
}
