/*
  Informes de servicios fijos: el equivalente del resumen (PDF) de un eventual, pero para
  un servicio y un rango de fechas elegido a mano. A diferencia del eventual, el servicio
  no guarda qué se usó ni cuándo, así que el informe se arma con tres fuentes:
    - PEDIDO: máquinas y vehículos de los pedidos entregados al servicio dentro del rango
      (se precargan al crear el informe y se pueden volver a traer).
    - SERVICIO: máquinas asignadas hoy al servicio, elegidas a mano.
    - MANUAL: cualquier otra máquina o vehículo del inventario.
  Los trabajos, servicios extras, insumos extras y observaciones se cargan a mano, con las
  mismas listas y validaciones que los eventuales (se reusan de eventuales.service.js).
*/
import prisma from "../db/prisma.js";
import {
  agruparItemsPorInsumo,
  buildError,
  categorizarHorasBrowix,
  getVehiculosByIds,
  normalizeInsumoExtraItem,
  normalizeServicioExtraItem,
  normalizeTrabajoItem,
  parseJson,
  redondearHoras,
  toDateOrNull,
  validateInsumosExtras,
  validateServiciosExtras,
  validateTrabajosRealizados,
} from "./eventuales.service.js";
import {
  BROWIX_GRUPOS,
  contarFichajesPorGrupo,
  getFichajesPorRango,
  sumarHorasTeoricasPorUbicacion,
} from "./browix.service.js";
import { getPedidosInsumos, resolverServiciosPorNombre } from "./insumos.service.js";
import { TIPO_ESPACIOS_VERDES } from "./tipoServicio.service.js";
import { ESTADOS_PEDIDO } from "../constants/estadosPedidos.js";

export const ORIGENES_COMPONENTE = ["PEDIDO", "SERVICIO", "MANUAL"];

// Grupos de Browix donde buscar los fichajes de los servicios fijos de Espacios Verdes.
// A diferencia de los eventuales, no dependen del supervisor: son siempre estos tres.
export const BROWIX_GRUPOS_INFORME_SERVICIO = ["2303", "1444", "2282"];

// Estados que implican que el pedido llegó al servicio. Se usan solo como respaldo para
// pedidos viejos sin la entrada ENTREGADO en el historial.
const ESTADOS_POSTERIORES_A_ENTREGA = [
  ESTADOS_PEDIDO.ENTREGADO,
  ESTADOS_PEDIDO.PENDIENTE_CONFIRMACION,
  ESTADOS_PEDIDO.PENDIENTE_CONFIRMACION_FALTANTES,
  ESTADOS_PEDIDO.ENTREGA_CONFIRMADA,
  ESTADOS_PEDIDO.CERRADO,
];

const DIA_MS = 24 * 60 * 60 * 1000;

function normalizeText(value) {
  return String(value || "").trim();
}

// Las fechas del informe se guardan al mediodía UTC (ver toDateOrNull): de ahí se toma el
// día calendario sin que el huso lo corra.
function diaISO(date) {
  return new Date(date).toISOString().slice(0, 10);
}

// Rango [inicio, finExclusivo) en horario argentino (UTC-3, sin horario de verano).
function rangoUtc(fechaDesde, fechaHasta) {
  const inicio = new Date(`${diaISO(fechaDesde)}T00:00:00-03:00`);
  const finExclusivo = new Date(new Date(`${diaISO(fechaHasta)}T00:00:00-03:00`).getTime() + DIA_MS);
  return { inicio, finExclusivo };
}

function validarRango(fechaDesde, fechaHasta) {
  if (!fechaDesde || !fechaHasta) {
    throw buildError("Tenés que indicar la fecha desde y la fecha hasta del informe", 400);
  }
  if (fechaDesde.getTime() > fechaHasta.getTime()) {
    throw buildError("La fecha desde no puede ser posterior a la fecha hasta", 400);
  }
}

function uniqueStrings(values) {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map((value) => normalizeText(value)).filter(Boolean)));
}

/* =========================
   SERVICIOS ELEGIBLES
========================= */

// El informe es solo para servicios fijos de Espacios Verdes. Además, un pedido
// complementario de un eventual crea un Servicio homónimo: esos no son servicios fijos y no
// se ofrecen.
export async function listServiciosDisponibles() {
  const [servicios, eventuales] = await Promise.all([
    prisma.servicio.findMany({
      where: { activo: true, tipo: TIPO_ESPACIOS_VERDES },
      select: { id: true, nombre: true, tipo: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.eventual.findMany({ select: { nombre: true } }),
  ]);

  const nombresEventuales = new Set(eventuales.map((eventual) => normalizeText(eventual.nombre)));
  return servicios.filter((servicio) => !nombresEventuales.has(normalizeText(servicio.nombre)));
}

async function getServicioFijo(servicioId) {
  const id = Number(servicioId);
  if (!Number.isInteger(id) || id <= 0) {
    throw buildError("Tenés que elegir un servicio", 400);
  }

  const servicio = await prisma.servicio.findUnique({
    where: { id },
    select: { id: true, nombre: true, tipo: true, activo: true },
  });
  if (!servicio || !servicio.activo) {
    throw buildError("Servicio no encontrado", 404);
  }
  if (servicio.tipo !== TIPO_ESPACIOS_VERDES) {
    throw buildError("El informe de servicio solo está disponible para servicios de Espacios Verdes", 400);
  }

  const eventualHomonimo = await prisma.eventual.findUnique({
    where: { nombre: servicio.nombre },
    select: { id: true },
  });
  if (eventualHomonimo) {
    throw buildError("Ese servicio corresponde a un eventual, no a un servicio fijo", 400);
  }

  return servicio;
}

/* =========================
   PEDIDOS DEL RANGO
========================= */

function fechaEntregaDePedido(pedido) {
  const entregado = pedido.historial.find((entry) => entry.accion === "ENTREGADO");
  if (entregado) return entregado.fecha;

  const actualizado = pedido.historial.find(
    (entry) =>
      entry.accion === "ESTADO_ACTUALIZADO" &&
      parseJson(entry.detalle)?.nuevoEstado === ESTADOS_PEDIDO.ENTREGADO
  );
  if (actualizado) return actualizado.fecha;

  return ESTADOS_POSTERIORES_A_ENTREGA.includes(pedido.estado) ? pedido.createdAt : null;
}

// Pedidos no cancelados del servicio cuya entrega cae dentro del rango.
export async function getPedidosEntregadosEnRango(servicioId, fechaDesde, fechaHasta) {
  const { inicio, finExclusivo } = rangoUtc(fechaDesde, fechaHasta);

  const pedidos = await prisma.pedido.findMany({
    where: {
      servicioId: Number(servicioId),
      estado: { not: ESTADOS_PEDIDO.CANCELADO },
      createdAt: { lt: finExclusivo },
    },
    include: {
      supervisor: { select: { id: true, username: true, nombre: true } },
      asignadas: { include: { maquina: { select: { id: true, tipo: true, modelo: true } } } },
      vehiculosAsignadas: {
        include: { vehiculo: { select: { id: true, vehiculo: true, modelo: true, patente: true } } },
      },
      historial: {
        where: { accion: { in: ["ENTREGADO", "ESTADO_ACTUALIZADO"] } },
        orderBy: { fecha: "asc" },
      },
    },
  });

  return pedidos
    .map((pedido) => ({ pedido, fechaEntrega: fechaEntregaDePedido(pedido) }))
    .filter(({ fechaEntrega }) => fechaEntrega && fechaEntrega >= inicio && fechaEntrega < finExclusivo)
    .sort((a, b) => a.fechaEntrega - b.fechaEntrega)
    .map(({ pedido, fechaEntrega }) => ({
      id: pedido.id,
      estado: pedido.estado,
      destino: pedido.destino,
      supervisorDestinoUsername: pedido.supervisorDestinoUsername,
      observacion: pedido.observacion,
      createdAt: pedido.createdAt,
      fechaEntrega,
      solicitante: pedido.supervisor,
      maquinas: pedido.asignadas.map((asignacion) => ({
        id: asignacion.maquina.id,
        tipo: asignacion.maquina.tipo,
        modelo: asignacion.maquina.modelo,
      })),
      vehiculos: pedido.vehiculosAsignadas.map((asignacion) => asignacion.vehiculo),
    }));
}

// Máquinas y vehículos de esos pedidos como componentes del informe (sin repetir).
function componentesDePedidos(pedidos) {
  const maquinas = new Map();
  const vehiculos = new Map();

  for (const pedido of pedidos) {
    for (const maquina of pedido.maquinas) {
      const actual = maquinas.get(maquina.id) || { id: maquina.id, origen: "PEDIDO", pedidoIds: [] };
      actual.pedidoIds.push(pedido.id);
      maquinas.set(maquina.id, actual);
    }
    for (const vehiculo of pedido.vehiculos) {
      const actual = vehiculos.get(vehiculo.id) || { id: vehiculo.id, origen: "PEDIDO", pedidoIds: [] };
      actual.pedidoIds.push(pedido.id);
      vehiculos.set(vehiculo.id, actual);
    }
  }

  return { maquinas: Array.from(maquinas.values()), vehiculos: Array.from(vehiculos.values()) };
}

/* =========================
   COMPONENTES (máquinas / vehículos)
========================= */

function normalizeComponentes(items) {
  if (!Array.isArray(items)) return [];

  const vistos = new Set();
  const resultado = [];
  for (const item of items) {
    const id = normalizeText(item?.id);
    if (!id || vistos.has(id)) continue;
    vistos.add(id);

    const origen = ORIGENES_COMPONENTE.includes(item?.origen) ? item.origen : "MANUAL";
    const pedidoIds = uniqueStrings(item?.pedidoIds);
    resultado.push({ id, origen, ...(origen === "PEDIDO" && pedidoIds.length > 0 ? { pedidoIds } : {}) });
  }
  return resultado;
}

async function ensureMaquinasExist(ids) {
  if (ids.length === 0) return;
  const rows = await prisma.maquina.findMany({ where: { id: { in: ids } }, select: { id: true } });
  if (rows.length !== ids.length) {
    throw buildError("Hay máquinas seleccionadas que no existen", 400);
  }
}

async function ensureVehiculosExist(ids) {
  if (ids.length === 0) return;
  const rows = await prisma.vehiculo.findMany({ where: { id: { in: ids } }, select: { id: true } });
  if (rows.length !== ids.length) {
    throw buildError("Hay vehículos seleccionados que no existen", 400);
  }
}

// Junta los componentes ya guardados con el detalle actual de cada máquina / vehículo.
async function resolverMaquinas(componentes) {
  if (componentes.length === 0) return [];
  const rows = await prisma.maquina.findMany({
    where: { id: { in: componentes.map((c) => c.id) } },
    select: { id: true, tipo: true, modelo: true, serie: true, estado: true },
  });
  const porId = new Map(rows.map((row) => [row.id, row]));
  return componentes
    .filter((componente) => porId.has(componente.id))
    .map((componente) => ({ ...porId.get(componente.id), origen: componente.origen, pedidoIds: componente.pedidoIds || [] }));
}

async function resolverVehiculos(componentes) {
  if (componentes.length === 0) return [];
  const rows = await getVehiculosByIds(componentes.map((c) => c.id));
  const porId = new Map(rows.map((row) => [row.id, row]));
  return componentes
    .filter((componente) => porId.has(componente.id))
    .map((componente) => ({ ...porId.get(componente.id), origen: componente.origen, pedidoIds: componente.pedidoIds || [] }));
}

/* =========================
   LISTADO / DETALLE
========================= */

function mapInformeResumen(informe) {
  return {
    id: informe.id,
    servicio: informe.servicio,
    fechaDesde: informe.fechaDesde,
    fechaHasta: informe.fechaHasta,
    creadoPor: informe.creadoPor,
    createdAt: informe.createdAt,
    updatedAt: informe.updatedAt,
  };
}

const INCLUDE_RESUMEN = {
  servicio: { select: { id: true, nombre: true, tipo: true } },
  creadoPor: { select: { id: true, username: true, nombre: true } },
};

export async function listInformes({ servicioId } = {}) {
  const id = Number(servicioId);
  const informes = await prisma.informeServicio.findMany({
    where: { activo: true, ...(Number.isInteger(id) && id > 0 ? { servicioId: id } : {}) },
    include: INCLUDE_RESUMEN,
    orderBy: [{ updatedAt: "desc" }],
  });
  return informes.map(mapInformeResumen);
}

export async function getInformeDetail(informeId) {
  const informe = await prisma.informeServicio.findFirst({
    where: { id: Number(informeId), activo: true },
    include: INCLUDE_RESUMEN,
  });
  if (!informe) return null;

  const [pedidos, supervisoresRows, maquinasDelServicio, maquinas, vehiculos] = await Promise.all([
    getPedidosEntregadosEnRango(informe.servicioId, informe.fechaDesde, informe.fechaHasta),
    prisma.usuarioServicio.findMany({
      where: { servicioId: informe.servicioId, usuario: { activo: true } },
      select: { usuario: { select: { id: true, username: true, nombre: true } } },
    }),
    prisma.maquina.findMany({
      where: { servicioId: informe.servicioId, estado: { not: "baja" } },
      select: { id: true, tipo: true, modelo: true, serie: true, estado: true },
      orderBy: [{ tipo: "asc" }, { id: "asc" }],
    }),
    resolverMaquinas(normalizeComponentes(parseJson(informe.maquinasUtilizadas))),
    resolverVehiculos(normalizeComponentes(parseJson(informe.vehiculosUtilizados))),
  ]);

  return {
    ...mapInformeResumen(informe),
    supervisores: supervisoresRows.map((row) => row.usuario),
    pedidos,
    maquinasDelServicio,
    maquinas,
    vehiculos,
    trabajosRealizados: parseJson(informe.trabajosRealizados) || [],
    serviciosExtrasSubcontratados: parseJson(informe.serviciosExtrasSubcontratados) || [],
    horasBrowix: parseJson(informe.horasBrowix),
    insumosImportados: parseJson(informe.insumosImportados),
    insumosExtras: parseJson(informe.insumosExtras) || [],
    observaciones: parseJson(informe.observaciones) || [],
  };
}

async function getInformeActivoOrThrow(informeId) {
  const informe = await prisma.informeServicio.findFirst({
    where: { id: Number(informeId), activo: true },
    include: { servicio: { select: { id: true, nombre: true } } },
  });
  if (!informe) throw buildError("Informe no encontrado", 404);
  return informe;
}

/* =========================
   ALTA / EDICIÓN / BAJA
========================= */

export async function createInforme({ payload, actor }) {
  const servicio = await getServicioFijo(payload?.servicioId);
  const fechaDesde = toDateOrNull(payload?.fechaDesde);
  const fechaHasta = toDateOrNull(payload?.fechaHasta);
  validarRango(fechaDesde, fechaHasta);

  const pedidos = await getPedidosEntregadosEnRango(servicio.id, fechaDesde, fechaHasta);
  const precarga = componentesDePedidos(pedidos);

  const informe = await prisma.informeServicio.create({
    data: {
      servicioId: servicio.id,
      fechaDesde,
      fechaHasta,
      maquinasUtilizadas: JSON.stringify(precarga.maquinas),
      vehiculosUtilizados: JSON.stringify(precarga.vehiculos),
      creadoPorId: actor.id,
    },
  });

  return getInformeDetail(informe.id);
}

export async function updateInforme({ informeId, payload, actor }) {
  const informe = await getInformeActivoOrThrow(informeId);
  const data = {};

  if (payload.fechaDesde !== undefined || payload.fechaHasta !== undefined) {
    const fechaDesde = toDateOrNull(payload.fechaDesde ?? informe.fechaDesde);
    const fechaHasta = toDateOrNull(payload.fechaHasta ?? informe.fechaHasta);
    validarRango(fechaDesde, fechaHasta);
    data.fechaDesde = fechaDesde;
    data.fechaHasta = fechaHasta;
  }

  if (payload.maquinas !== undefined) {
    const maquinas = normalizeComponentes(payload.maquinas);
    await ensureMaquinasExist(maquinas.map((m) => m.id));
    data.maquinasUtilizadas = JSON.stringify(maquinas);
  }

  if (payload.vehiculos !== undefined) {
    const vehiculos = normalizeComponentes(payload.vehiculos);
    await ensureVehiculosExist(vehiculos.map((v) => v.id));
    data.vehiculosUtilizados = JSON.stringify(vehiculos);
  }

  const errores = [];
  if (payload.trabajosRealizados !== undefined) {
    errores.push(...validateTrabajosRealizados(payload.trabajosRealizados));
  }
  if (payload.serviciosExtrasSubcontratados !== undefined) {
    errores.push(...validateServiciosExtras(payload.serviciosExtrasSubcontratados));
  }
  if (payload.insumosExtras !== undefined) {
    errores.push(...validateInsumosExtras(payload.insumosExtras));
  }
  if (errores.length > 0) {
    throw buildError(errores[0], 400, { errores });
  }

  if (payload.trabajosRealizados !== undefined) {
    data.trabajosRealizados = JSON.stringify((payload.trabajosRealizados || []).map(normalizeTrabajoItem));
  }
  if (payload.serviciosExtrasSubcontratados !== undefined) {
    data.serviciosExtrasSubcontratados = JSON.stringify(
      (payload.serviciosExtrasSubcontratados || []).map(normalizeServicioExtraItem)
    );
  }
  if (payload.insumosExtras !== undefined) {
    data.insumosExtras = JSON.stringify((payload.insumosExtras || []).map(normalizeInsumoExtraItem));
  }

  // Las observaciones solo se agregan (con autor y fecha), nunca se pisan.
  const nuevaObservacion = normalizeText(payload.nuevaObservacion);
  if (nuevaObservacion) {
    const observaciones = parseJson(informe.observaciones) || [];
    observaciones.push({
      texto: nuevaObservacion,
      autor: actor.nombre || actor.username,
      fecha: new Date().toISOString(),
    });
    data.observaciones = JSON.stringify(observaciones);
  }

  await prisma.informeServicio.update({ where: { id: informe.id }, data });
  return getInformeDetail(informe.id);
}

// Vuelve a traer las máquinas y vehículos de los pedidos del rango. Reemplaza lo que había
// con origen PEDIDO y respeta lo cargado a mano o desde el servicio.
export async function recargarDesdePedidos({ informeId }) {
  const informe = await getInformeActivoOrThrow(informeId);

  const pedidos = await getPedidosEntregadosEnRango(informe.servicioId, informe.fechaDesde, informe.fechaHasta);
  const precarga = componentesDePedidos(pedidos);

  const combinar = (guardados, nuevos) => {
    const propios = normalizeComponentes(guardados).filter((componente) => componente.origen !== "PEDIDO");
    const idsPropios = new Set(propios.map((componente) => componente.id));
    return [...propios, ...nuevos.filter((componente) => !idsPropios.has(componente.id))];
  };

  await prisma.informeServicio.update({
    where: { id: informe.id },
    data: {
      maquinasUtilizadas: JSON.stringify(combinar(parseJson(informe.maquinasUtilizadas), precarga.maquinas)),
      vehiculosUtilizados: JSON.stringify(combinar(parseJson(informe.vehiculosUtilizados), precarga.vehiculos)),
    },
  });

  return getInformeDetail(informe.id);
}

export async function deleteInforme(informeId) {
  const informe = await prisma.informeServicio.findFirst({ where: { id: Number(informeId), activo: true } });
  if (!informe) return false;

  await prisma.informeServicio.update({ where: { id: informe.id }, data: { activo: false } });
  return true;
}

/* =========================
   INSUMOS
========================= */

// Igual que en eventuales: matchea por nombre exacto del servicio en la API de insumos
// (probando todas las empresas), pero acá se acota a los pedidos cuyo día cae en el rango
// del informe, porque un servicio fijo acumula pedidos de todos los períodos.
export async function importarInsumosInforme({ informeId, actor }) {
  const informe = await getInformeActivoOrThrow(informeId);

  const desde = diaISO(informe.fechaDesde);
  const hasta = diaISO(informe.fechaHasta);

  const coincidencias = await resolverServiciosPorNombre(informe.servicio.nombre);

  const pedidos = [];
  for (const { token, servicioId } of coincidencias) {
    const pedidosEmpresa = await getPedidosInsumos({ token, servicioId });
    pedidos.push(...pedidosEmpresa.filter((pedido) => pedido.dia >= desde && pedido.dia <= hasta));
  }

  const total = pedidos.reduce((acc, pedido) => acc + (Number(pedido.total) || 0), 0);

  const resultado = {
    servicioIds: coincidencias.map((c) => c.servicioId),
    servicioNombre: informe.servicio.nombre,
    desde,
    hasta,
    cantidadPedidos: pedidos.length,
    total: Math.round(total * 100) / 100,
    importadoEn: new Date().toISOString(),
    importadoPor: actor.nombre || actor.username || null,
    insumos: agruparItemsPorInsumo(pedidos),
    pedidos: pedidos.map((pedido) => ({
      pedidoId: pedido.pedidoId,
      numero: pedido.numero,
      fechaHoraArgentina: pedido.fechaHoraArgentina,
      solicitante: pedido.solicitante,
      estado: pedido.estado,
      total: pedido.total,
    })),
  };

  await prisma.informeServicio.update({
    where: { id: informe.id },
    data: { insumosImportados: JSON.stringify(resultado) },
  });

  return getInformeDetail(informe.id);
}

/* =========================
   HORAS DE BROWIX
========================= */

// Misma lógica que los eventuales (fichajes cuya ubicación coincide con el nombre del
// servicio, con jornada asignada, desglosados por categoría), pero acotada al rango del
// informe y sobre los grupos fijos de BROWIX_GRUPOS_INFORME_SERVICIO. Cada reimportación
// pisa el resultado anterior.
export async function importarHorasBrowixInforme({ informeId, actor }) {
  const informe = await getInformeActivoOrThrow(informeId);
  const ubicacion = informe.servicio.nombre;

  const fichajes = await getFichajesPorRango(informe.fechaDesde, informe.fechaHasta, BROWIX_GRUPOS_INFORME_SERVICIO);
  const { totalMinutos, totalMinutosReal, cantidadFichajes } = sumarHorasTeoricasPorUbicacion(fichajes, ubicacion);
  const { personas, categorias, fichajesSinLegajo, erroresCategorizacion } = await categorizarHorasBrowix(
    fichajes,
    ubicacion
  );

  if (erroresCategorizacion.length > 0) {
    console.warn(
      `Informe de servicio ${informe.id}: no se pudo determinar la categoría de ${erroresCategorizacion.length} persona(s)`,
      erroresCategorizacion
    );
  }

  const gruposConFichajes = contarFichajesPorGrupo(fichajes, ubicacion).map((grupo) => {
    const catalogo = BROWIX_GRUPOS.find((item) => item.id === grupo.grupoId);
    return {
      ...grupo,
      grupoNombre: catalogo?.nombre || null,
      grupoSupervisor: catalogo?.supervisor || null,
    };
  });

  const resultado = {
    totalMinutos,
    totalHoras: redondearHoras(totalMinutos),
    totalMinutosReal,
    totalHorasReal: redondearHoras(totalMinutosReal),
    cantidadFichajes,
    ubicacion,
    desde: diaISO(informe.fechaDesde),
    hasta: diaISO(informe.fechaHasta),
    importadoEn: new Date().toISOString(),
    importadoPor: actor.nombre || actor.username || null,
    gruposConsultados: BROWIX_GRUPOS_INFORME_SERVICIO,
    gruposConFichajes,
    personas,
    categorias,
    fichajesSinLegajo,
    erroresCategorizacion,
  };

  await prisma.informeServicio.update({
    where: { id: informe.id },
    data: { horasBrowix: JSON.stringify(resultado) },
  });

  return getInformeDetail(informe.id);
}
