import prisma from "../db/prisma.js";
import {
  userHasRole,
  userHasAnyRole,
  whereHasAnyRole,
  ROLES_SUPERVISION,
} from "./roles.service.js";
import {
  getFichajesPorRango,
  sumarHorasTeoricasPorUbicacion,
  agruparMinutosPorLegajo,
  getCategoriasPorLegajos,
} from "./browix.service.js";
import { resolverServiciosPorNombre, getPedidosInsumos } from "./insumos.service.js";

export const ESTADOS_EVENTUAL_VALIDOS = ["activo", "finalizado", "cancelado"];

const TIPOS_TRABAJO_VALIDOS = [
  "PODA_MENOR_2M",
  "PODA_ALTURA",
  "RETIRO_PODA",
  "DESMALEZADO",
  "DESMONTE",
  "CORTE_CESPED",
  "CORTE_BARRIDO",
  "LIMPIEZA_INTEGRAL",
  "OTRO",
];

const UNIDADES_MEDIDA_VALIDAS = ["UNIDAD", "M2", "M3", "METROS_LINEALES", "HORAS", "KG"];

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeNullableText(value) {
  const normalized = normalizeText(value);
  return normalized ? normalized : null;
}

function uniqueStrings(values) {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map((value) => normalizeText(value)).filter(Boolean)));
}

function parseJson(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function buildError(message, status = 400, payload = null) {
  const error = new Error(message);
  error.status = status;
  if (payload) error.payload = payload;
  return error;
}

export function normalizeEstadoEventual(value) {
  const normalized = normalizeText(value).toLowerCase();
  return ESTADOS_EVENTUAL_VALIDOS.includes(normalized) ? normalized : "activo";
}

function validateTrabajosRealizados(items) {
  if (!Array.isArray(items)) return [];

  const errors = [];
  items.forEach((item, idx) => {
    const label = `Trabajo ${idx + 1}`;
    if (!item || typeof item !== "object") {
      errors.push(`${label}: dato inválido`);
      return;
    }
    if (!TIPOS_TRABAJO_VALIDOS.includes(item.tipo)) {
      errors.push(`${label}: tipo de trabajo inválido`);
    }
    if (item.tipo === "OTRO" && !normalizeText(item.descripcionOtro)) {
      errors.push(`${label}: la descripción es obligatoria para tipo "Otro"`);
    }
    const cantidad = Number(item.cantidad);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      errors.push(`${label}: la cantidad debe ser un número mayor a 0`);
    }
    if (!UNIDADES_MEDIDA_VALIDAS.includes(item.unidadMedida)) {
      errors.push(`${label}: unidad de medida inválida`);
    }
  });

  return errors;
}

function validateServiciosExtras(items) {
  if (!Array.isArray(items)) return [];

  const errors = [];
  items.forEach((item, idx) => {
    const label = `Servicio extra ${idx + 1}`;
    if (!item || typeof item !== "object") {
      errors.push(`${label}: dato inválido`);
      return;
    }
    if (!normalizeText(item.descripcion)) {
      errors.push(`${label}: la descripción es obligatoria`);
    }
    const cantidad = Number(item.cantidad);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      errors.push(`${label}: la cantidad debe ser un número mayor a 0`);
    }
    if (!UNIDADES_MEDIDA_VALIDAS.includes(item.unidadMedida)) {
      errors.push(`${label}: unidad de medida inválida`);
    }
    if (item.precio !== undefined && item.precio !== null && String(item.precio).trim() !== "") {
      const precio = Number(item.precio);
      if (!Number.isFinite(precio) || precio <= 0) {
        errors.push(`${label}: el precio (ARS) debe ser un número mayor a 0`);
      }
    }
  });

  return errors;
}

function normalizeTrabajoItem(item) {
  return {
    tipo: normalizeText(item.tipo),
    label: normalizeText(item.label),
    descripcionOtro: item.tipo === "OTRO" ? normalizeText(item.descripcionOtro) : null,
    cantidad: Number(item.cantidad),
    unidadMedida: normalizeText(item.unidadMedida),
    unidadLabel: normalizeText(item.unidadLabel),
  };
}

function normalizeServicioExtraItem(item) {
  const precioVacio =
    item.precio === undefined || item.precio === null || String(item.precio).trim() === "";
  return {
    descripcion: normalizeText(item.descripcion),
    cantidad: Number(item.cantidad),
    unidadMedida: normalizeText(item.unidadMedida),
    unidadLabel: normalizeText(item.unidadLabel),
    // Precio de la subcontratación en pesos argentinos (ARS); opcional
    precio: precioVacio ? null : Number(item.precio),
  };
}

function normalizeMaquinasUtilizadas(items) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      const maquinaIds = uniqueStrings(item?.maquinaIds);
      return {
        tipo: normalizeText(item?.tipo),
        // Si vienen máquinas puntuales seleccionadas, la cantidad sale de ahí
        cantidad: maquinaIds.length > 0 ? maquinaIds.length : Number(item?.cantidad),
        ...(maquinaIds.length > 0 ? { maquinaIds } : {}),
      };
    })
    .filter((item) => item.tipo);
}

function validateMaquinasUtilizadas(items) {
  const errors = [];
  const seen = new Set();

  items.forEach((item, idx) => {
    const label = `Máquina ${idx + 1}`;
    if (!item?.tipo) {
      errors.push(`${label}: el tipo es obligatorio`);
      return;
    }
    if (seen.has(item.tipo)) {
      errors.push(`${label}: el tipo ${item.tipo} está repetido`);
    }
    seen.add(item.tipo);

    if (!Number.isFinite(item.cantidad) || item.cantidad <= 0) {
      errors.push(`${label}: la cantidad debe ser mayor a 0`);
    }
  });

  return errors;
}

async function getActorByUsername(username) {
  const normalized = normalizeText(username);
  if (!normalized) return null;

  return prisma.usuario.findUnique({
    where: { username: normalized },
    select: {
      id: true,
      username: true,
      nombre: true,
      rol: true,
      roles: { select: { rol: true } },
      activo: true,
    },
  });
}

async function getSupervisorById(supervisorId) {
  if (!Number.isInteger(Number(supervisorId)) || Number(supervisorId) <= 0) return null;

  return prisma.usuario.findFirst({
    where: {
      id: Number(supervisorId),
      ...whereHasAnyRole(ROLES_SUPERVISION),
      activo: true,
    },
    select: { id: true, username: true, nombre: true },
  });
}

function mapVehiculoBasico(vehiculo) {
  if (!vehiculo) return null;
  return {
    id: vehiculo.id,
    vehiculo: vehiculo.vehiculo,
    modelo: vehiculo.modelo,
    patente: vehiculo.patente,
    estado: vehiculo.estado,
    empresa: vehiculo.empresa,
  };
}

async function getVehiculosByIds(ids = []) {
  const uniqueIds = uniqueStrings(ids);
  if (uniqueIds.length === 0) return [];

  const rows = await prisma.vehiculo.findMany({
    where: { id: { in: uniqueIds } },
    select: {
      id: true,
      vehiculo: true,
      modelo: true,
      patente: true,
      estado: true,
      empresa: true,
    },
  });

  const byId = new Map(rows.map((row) => [row.id, row]));
  return uniqueIds.map((id) => byId.get(id)).filter(Boolean).map(mapVehiculoBasico);
}

async function ensureVehiculosExist(vehiculoIds = []) {
  const uniqueIds = uniqueStrings(vehiculoIds);
  if (uniqueIds.length === 0) return;

  const rows = await prisma.vehiculo.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true },
  });

  if (rows.length !== uniqueIds.length) {
    throw buildError("Hay vehículos seleccionados que no existen", 400);
  }
}

function mapHistorialEntry(entry) {
  return {
    id: entry.id,
    accion: entry.accion,
    fecha: entry.fecha,
    usuario: entry.usuario
      ? {
          id: entry.usuario.id,
          username: entry.usuario.username,
          nombre: entry.usuario.nombre,
        }
      : null,
    detalle: parseJson(entry.detalle),
  };
}

function buildEventualSummary(eventual) {
  // Última vez que se guardaron cambios: fecha del último movimiento del historial
  // (todo guardado escribe historial); si no hay, la fecha de creación.
  const fechasHistorial = (eventual.historial || [])
    .map((entry) => new Date(entry.fecha).getTime())
    .filter((time) => Number.isFinite(time));
  const ultimaModificacion = fechasHistorial.length
    ? new Date(Math.max(...fechasHistorial))
    : eventual.createdAt;

  return {
    id: eventual.id,
    nombre: eventual.nombre,
    estado: eventual.estado,
    fechaInicio: eventual.fechaInicio,
    fechaFin: eventual.fechaFin,
    observaciones: eventual.observaciones,
    activo: eventual.activo,
    createdAt: eventual.createdAt,
    ultimaModificacion,
    supervisor: eventual.supervisor
      ? {
          id: eventual.supervisor.id,
          username: eventual.supervisor.username,
          nombre: eventual.supervisor.nombre,
        }
      : null,
  };
}

function toDateOrNull(value) {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const [, year, month, day] = match;
      return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12, 0, 0));
    }
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function getComponentesCatalogo() {
  const [tiposRows, vehiculosRows] = await Promise.all([
    prisma.maquina.findMany({
      select: { tipo: true },
      distinct: ["tipo"],
      orderBy: { tipo: "asc" },
    }),
    prisma.vehiculo.findMany({
      select: {
        id: true,
        vehiculo: true,
        modelo: true,
        patente: true,
        estado: true,
        empresa: true,
      },
      orderBy: [{ vehiculo: "asc" }, { id: "asc" }],
    }),
  ]);

  return {
    tiposMaquina: tiposRows
      .map((row) => normalizeText(row.tipo))
      .filter(Boolean)
      .map((tipo) => ({ tipo })),
    vehiculos: vehiculosRows.map(mapVehiculoBasico),
  };
}

export async function listEventuales(filters = {}) {
  const where = {};
  const search = normalizeText(filters.search);
  const estado = normalizeText(filters.estado).toLowerCase();
  const username = normalizeText(filters.supervisorUsername);

  if (filters.activo === "true") where.activo = true;
  if (filters.activo === "false") where.activo = false;
  if (filters.supervisorId) where.supervisorId = Number(filters.supervisorId);
  if (estado && ESTADOS_EVENTUAL_VALIDOS.includes(estado)) where.estado = estado;
  if (username) where.supervisor = { username };
  if (search) {
    where.OR = [
      { nombre: { contains: search } },
      { observaciones: { contains: search } },
      { supervisor: { username: { contains: search } } },
      { supervisor: { nombre: { contains: search } } },
    ];
  }

  const eventuales = await prisma.eventual.findMany({
    where,
    include: {
      supervisor: { select: { id: true, username: true, nombre: true } },
      historial: {
        include: { usuario: { select: { id: true, username: true, nombre: true } } },
        orderBy: { fecha: "asc" },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return eventuales.map((eventual) => {
    const maquinas = parseJson(eventual.maquinasUtilizadas) || [];
    const vehiculoIds = parseJson(eventual.vehiculosUtilizados) || [];

    return {
      ...buildEventualSummary(eventual),
      resumenComponentes: {
        tiposMaquina: Array.isArray(maquinas) ? maquinas.length : 0,
        vehiculos: Array.isArray(vehiculoIds) ? vehiculoIds.length : 0,
      },
      historial: eventual.historial.map(mapHistorialEntry),
    };
  });
}

const ESTADOS_PEDIDO_TERMINADOS = ["CERRADO", "CANCELADO"];

export async function getEventualDetail(eventualId) {
  const eventual = await prisma.eventual.findUnique({
    where: { id: Number(eventualId) },
    include: {
      supervisor: { select: { id: true, username: true, nombre: true } },
      historial: {
        include: { usuario: { select: { id: true, username: true, nombre: true } } },
        orderBy: { fecha: "asc" },
      },
    },
  });

  if (!eventual) return null;

  const maquinasUtilizadas = parseJson(eventual.maquinasUtilizadas) || [];
  const vehiculoIds = parseJson(eventual.vehiculosUtilizados) || [];
  const vehiculos = await getVehiculosByIds(vehiculoIds);
  const legacyComponentes = parseJson(eventual.componentesUtilizados);

  // Pedidos complementarios disparados desde el eventual
  const pedidos = await prisma.pedido.findMany({
    where: { eventualId: eventual.id },
    include: {
      asignadas: { include: { maquina: { select: { id: true, tipo: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  const pedidosComplementarios = pedidos.map((pedido) => ({
    id: pedido.id,
    estado: pedido.estado,
    destino: pedido.destino,
    createdAt: pedido.createdAt,
    terminado: ESTADOS_PEDIDO_TERMINADOS.includes(pedido.estado),
    maquinas: pedido.asignadas.map((asignacion) => ({
      id: asignacion.maquinaId,
      tipo: asignacion.maquina?.tipo || "Sin tipo",
    })),
  }));

  // Máquinas asignadas en pedidos complementarios (no cancelados), agrupadas por tipo.
  // Se suman al listado final de máquinas utilizadas sin persistirse en el JSON manual.
  const gruposPedidos = new Map();
  for (const pedido of pedidosComplementarios) {
    if (pedido.estado === "CANCELADO") continue;
    for (const maquina of pedido.maquinas) {
      const key = maquina.tipo || "Sin tipo";
      if (!gruposPedidos.has(key)) gruposPedidos.set(key, new Set());
      gruposPedidos.get(key).add(maquina.id);
    }
  }
  const maquinasDePedidos = Array.from(gruposPedidos.entries())
    .map(([tipo, ids]) => ({ tipo, cantidad: ids.size, maquinaIds: Array.from(ids) }))
    .sort((a, b) => a.tipo.localeCompare(b.tipo));

  return {
    ...buildEventualSummary(eventual),
    componentesActuales: {
      maquinasUtilizadas: Array.isArray(maquinasUtilizadas) ? maquinasUtilizadas : [],
      vehiculoIds: Array.isArray(vehiculoIds) ? uniqueStrings(vehiculoIds) : [],
      vehiculos,
    },
    pedidosComplementarios,
    maquinasDePedidos,
    legacyComponentes: legacyComponentes && typeof legacyComponentes === "object" ? legacyComponentes : null,
    trabajosRealizados: parseJson(eventual.trabajosRealizados) || [],
    serviciosExtrasSubcontratados: parseJson(eventual.serviciosExtrasSubcontratados) || [],
    horasBrowix: parseJson(eventual.horasBrowix),
    insumosImportados: parseJson(eventual.insumosImportados),
    horasSupervisor: eventual.horasSupervisor,
    historial: eventual.historial.map(mapHistorialEntry),
  };
}

function buildEventualPayload(payload) {
  const trabajosRaw = Array.isArray(payload.trabajosRealizados)
    ? payload.trabajosRealizados
    : parseJson(payload.trabajosRealizados) || [];
  const serviciosRaw = Array.isArray(payload.serviciosExtrasSubcontratados)
    ? payload.serviciosExtrasSubcontratados
    : parseJson(payload.serviciosExtrasSubcontratados) || [];

  return {
    nombre: normalizeText(payload.nombre),
    supervisorId: payload.supervisorId ? Number(payload.supervisorId) : null,
    estado: normalizeEstadoEventual(payload.estado),
    fechaInicio: toDateOrNull(payload.fechaInicio),
    fechaFin: toDateOrNull(payload.fechaFin),
    observaciones: normalizeNullableText(payload.observaciones),
    observacionesPosteriores: normalizeNullableText(payload.observacionesPosteriores),
    maquinasUtilizadas: normalizeMaquinasUtilizadas(payload.maquinasUtilizadas),
    vehiculoIds: uniqueStrings(payload.vehiculoIds),
    trabajosRealizados: Array.isArray(trabajosRaw) ? trabajosRaw : [],
    serviciosExtrasSubcontratados: Array.isArray(serviciosRaw) ? serviciosRaw : [],
  };
}

export async function saveEventual({ eventualId, payload, actorUsername }) {
  const actor = await getActorByUsername(actorUsername);
  if (!actor) {
    throw buildError("Usuario actor invalido", 400);
  }

  const data = buildEventualPayload(payload);

  if (!data.nombre) {
    throw buildError("El nombre del eventual es obligatorio", 400);
  }

  if (data.supervisorId !== null && (!Number.isInteger(data.supervisorId) || data.supervisorId <= 0)) {
    throw buildError("Supervisor invalido", 400);
  }

  // El eventual puede crearse sin supervisor, pero para completar maquinaria
  // utilizada o trabajos realizados es obligatorio tener uno asignado.
  if (!data.supervisorId && (data.maquinasUtilizadas.length > 0 || data.trabajosRealizados.length > 0)) {
    throw buildError("Debe asignar un supervisor para completar maquinaria utilizada o trabajos realizados", 400);
  }

  if (data.fechaInicio && data.fechaFin && data.fechaFin < data.fechaInicio) {
    throw buildError("La fecha de finalización no puede ser menor a la fecha de inicio", 400);
  }

  const maquinasErrors = validateMaquinasUtilizadas(data.maquinasUtilizadas);
  if (maquinasErrors.length > 0) {
    throw buildError(`Máquinas utilizadas inválidas: ${maquinasErrors.join("; ")}`, 400);
  }

  if (data.vehiculoIds.length !== uniqueStrings(data.vehiculoIds).length) {
    throw buildError("No se permiten vehículos repetidos", 400);
  }

  await ensureVehiculosExist(data.vehiculoIds);

  const trabajosErrors = validateTrabajosRealizados(data.trabajosRealizados);
  const serviciosErrors = validateServiciosExtras(data.serviciosExtrasSubcontratados);
  if (trabajosErrors.length > 0) {
    throw buildError(`Trabajos realizados inválidos: ${trabajosErrors.join("; ")}`, 400);
  }
  if (serviciosErrors.length > 0) {
    throw buildError(`Servicios extras inválidos: ${serviciosErrors.join("; ")}`, 400);
  }

  if (data.estado === "finalizado" && data.trabajosRealizados.length === 0) {
    throw buildError("Debe cargar al menos un trabajo realizado para finalizar el eventual", 400);
  }

  if (data.estado === "finalizado" && !data.fechaFin) {
    throw buildError("Debe indicar la fecha de finalización para finalizar el eventual", 400);
  }

  const duplicate = await prisma.eventual.findFirst({
    where: {
      nombre: data.nombre,
      NOT: eventualId ? { id: Number(eventualId) } : undefined,
    },
    select: { id: true },
  });
  if (duplicate) {
    throw buildError("Ya existe un eventual con ese nombre", 400);
  }

  const existing = eventualId
    ? await prisma.eventual.findUnique({
        where: { id: Number(eventualId) },
        include: {
          supervisor: { select: { id: true, username: true, nombre: true } },
          historial: {
            where: { accion: "SUPERVISOR_FINALIZO_EVENTUAL" },
            select: { id: true },
            take: 1,
          },
        },
      })
    : null;

  if (eventualId && !existing) {
    throw buildError("Eventual no encontrado", 404);
  }

  // Con pedidos complementarios disparados, el supervisor queda fijado
  if (existing) {
    const pedidosVinculados = await prisma.pedido.count({
      where: { eventualId: Number(eventualId) },
    });
    if (pedidosVinculados > 0 && (data.supervisorId ?? null) !== (existing.supervisorId ?? null)) {
      throw buildError(
        "No se puede modificar el supervisor: el eventual ya tiene pedidos complementarios disparados",
        400
      );
    }
  }

  const supervisor = data.supervisorId ? await getSupervisorById(data.supervisorId) : null;
  if (data.supervisorId && !supervisor) {
    throw buildError("El usuario asignado debe ser un supervisor activo", 400);
  }

  const trabajosNormalizados = data.trabajosRealizados.map(normalizeTrabajoItem);
  const serviciosNormalizados = data.serviciosExtrasSubcontratados.map(normalizeServicioExtraItem);
  const trabajosJson = trabajosNormalizados.length > 0 ? JSON.stringify(trabajosNormalizados) : null;
  const serviciosJson = serviciosNormalizados.length > 0 ? JSON.stringify(serviciosNormalizados) : null;

  const isFinalizedEdit = Boolean(existing && (existing.historial?.length || existing.estado === "finalizado"));
  const observacionesPreviasPersistidas = existing
    ? isFinalizedEdit
      ? existing.observaciones
      : data.observaciones
    : data.observaciones;

  const maquinasUtilizadasJson = data.maquinasUtilizadas.length > 0 ? JSON.stringify(data.maquinasUtilizadas) : null;
  const vehiculosUtilizadosJson = data.vehiculoIds.length > 0 ? JSON.stringify(data.vehiculoIds) : null;

  const previousMaquinas = parseJson(existing?.maquinasUtilizadas) || [];
  const previousVehiculoIds = parseJson(existing?.vehiculosUtilizados) || [];

  const eventual = await prisma.$transaction(async (tx) => {
    const saved = existing
      ? await tx.eventual.update({
          where: { id: Number(eventualId) },
          data: {
            nombre: data.nombre,
            supervisorId: data.supervisorId,
            estado: data.estado,
            fechaInicio: data.fechaInicio,
            fechaFin: data.fechaFin,
            observaciones: observacionesPreviasPersistidas,
            maquinasUtilizadas: maquinasUtilizadasJson,
            vehiculosUtilizados: vehiculosUtilizadosJson,
            trabajosRealizados: trabajosJson,
            serviciosExtrasSubcontratados: serviciosJson,
          },
        })
      : await tx.eventual.create({
          data: {
            nombre: data.nombre,
            supervisorId: data.supervisorId,
            estado: data.estado,
            fechaInicio: data.fechaInicio,
            fechaFin: data.fechaFin,
            observaciones: data.observaciones,
            maquinasUtilizadas: maquinasUtilizadasJson,
            vehiculosUtilizados: vehiculosUtilizadosJson,
            trabajosRealizados: trabajosJson,
            serviciosExtrasSubcontratados: serviciosJson,
            activo: true,
          },
        });

    const detalleHistorial = existing
      ? {
          anterior: {
            nombre: existing.nombre,
            estado: existing.estado,
            fechaInicio: existing.fechaInicio,
            fechaFin: existing.fechaFin,
            observaciones: existing.observaciones,
            observacionesPrevias: existing.observaciones,
            supervisor: existing.supervisor,
            componentesActuales: {
              maquinasUtilizadas: previousMaquinas,
              vehiculoIds: previousVehiculoIds,
            },
          },
          actual: {
            nombre: data.nombre,
            estado: data.estado,
            fechaInicio: data.fechaInicio,
            fechaFin: data.fechaFin,
            observaciones: observacionesPreviasPersistidas,
            observacionesPrevias: observacionesPreviasPersistidas,
            observacionesPosteriores: data.observacionesPosteriores || null,
            supervisor,
            componentesActuales: {
              maquinasUtilizadas: data.maquinasUtilizadas,
              vehiculoIds: data.vehiculoIds,
            },
          },
        }
      : {
          inicial: {
            nombre: data.nombre,
            estado: data.estado,
            fechaInicio: data.fechaInicio,
            fechaFin: data.fechaFin,
            observaciones: data.observaciones,
            observacionesPrevias: data.observaciones,
            supervisor,
            componentesActuales: {
              maquinasUtilizadas: data.maquinasUtilizadas,
              vehiculoIds: data.vehiculoIds,
            },
          },
        };

    await tx.historialEventual.create({
      data: {
        eventualId: saved.id,
        accion: existing ? "EVENTUAL_CORREGIDO" : "EVENTUAL_CREADO",
        detalle: JSON.stringify(detalleHistorial),
        usuarioId: actor.id,
      },
    });

    if (existing && data.observacionesPosteriores) {
      const accionObservacion = userHasRole(actor, "coordinador")
        ? "COORDINADOR_OBSERVACION_POSTERIOR"
        : "ADMIN_OBSERVACION_POSTERIOR";

      const detalleObservacion = {
        observacion: data.observacionesPosteriores,
        tipo: "posterior",
      };

      if (userHasRole(actor, "coordinador")) {
        if (trabajosNormalizados.length > 0) {
          detalleObservacion.trabajosRealizados = trabajosNormalizados;
        }
        if (serviciosNormalizados.length > 0) {
          detalleObservacion.serviciosExtrasSubcontratados = serviciosNormalizados;
        }
      }

      await tx.historialEventual.create({
        data: {
          eventualId: saved.id,
          accion: accionObservacion,
          detalle: JSON.stringify(detalleObservacion),
          usuarioId: actor.id,
        },
      });
    }

    return saved;
  });

  return getEventualDetail(eventual.id);
}

export async function deleteEventual(eventualId, actorUsername) {
  const actor = await getActorByUsername(actorUsername);
  if (!actor) {
    throw buildError("Usuario actor invalido", 400);
  }

  const existing = await prisma.eventual.findUnique({
    where: { id: Number(eventualId) },
    select: {
      id: true,
      nombre: true,
      estado: true,
    },
  });

  if (!existing) return null;

  await prisma.$transaction(async (tx) => {
    await tx.eventual.update({
      where: { id: Number(eventualId) },
      data: { activo: false, estado: "cancelado" },
    });

    await tx.historialEventual.create({
      data: {
        eventualId: Number(eventualId),
        accion: "EVENTUAL_BAJA_LOGICA",
        detalle: JSON.stringify({
          anterior: { nombre: existing.nombre, estado: existing.estado },
          actual: { nombre: existing.nombre, estado: "cancelado" },
        }),
        usuarioId: actor.id,
      },
    });
  });

  return true;
}

// El supervisor_limpieza puede cargar las máquinas y vehículos utilizados de un eventual
// asignado a él, sin pasar por el flujo completo del coordinador (saveEventual). Solo se
// tocan esos dos campos; el resto del eventual queda intacto.
export async function updateEventualComponentesBySupervisor({
  eventualId,
  actorUsername,
  maquinasUtilizadas,
  vehiculoIds,
}) {
  const actor = await getActorByUsername(actorUsername);
  if (!actor || !userHasRole(actor, "supervisor_limpieza")) {
    throw buildError("Solo un Supervisor Limpieza puede cargar componentes", 403);
  }

  const eventual = await prisma.eventual.findUnique({
    where: { id: Number(eventualId) },
  });
  if (!eventual || !eventual.activo) {
    throw buildError("Eventual no encontrado", 404);
  }
  if (eventual.supervisorId !== actor.id) {
    throw buildError("No sos el supervisor asignado a este eventual", 403);
  }

  const maquinas = normalizeMaquinasUtilizadas(maquinasUtilizadas);
  const maquinasErrors = validateMaquinasUtilizadas(maquinas);
  if (maquinasErrors.length > 0) {
    throw buildError(`Máquinas utilizadas inválidas: ${maquinasErrors.join("; ")}`, 400);
  }

  const vids = uniqueStrings(vehiculoIds);
  await ensureVehiculosExist(vids);

  const maquinasJson = maquinas.length > 0 ? JSON.stringify(maquinas) : null;
  const vehiculosJson = vids.length > 0 ? JSON.stringify(vids) : null;

  const previousMaquinas = parseJson(eventual.maquinasUtilizadas) || [];
  const previousVehiculoIds = parseJson(eventual.vehiculosUtilizados) || [];

  await prisma.$transaction(async (tx) => {
    await tx.eventual.update({
      where: { id: Number(eventualId) },
      data: {
        maquinasUtilizadas: maquinasJson,
        vehiculosUtilizados: vehiculosJson,
      },
    });

    await tx.historialEventual.create({
      data: {
        eventualId: Number(eventualId),
        accion: "SUPERVISOR_CARGO_COMPONENTES",
        detalle: JSON.stringify({
          anterior: {
            maquinasUtilizadas: previousMaquinas,
            vehiculoIds: previousVehiculoIds,
          },
          actual: {
            maquinasUtilizadas: maquinas,
            vehiculoIds: vids,
          },
        }),
        usuarioId: actor.id,
      },
    });
  });

  return getEventualDetail(eventualId);
}

export async function addSupervisorObservation(eventualId, actorUsername, observacion) {
  const actor = await getActorByUsername(actorUsername);
  if (!actor || !userHasAnyRole(actor, ROLES_SUPERVISION)) {
    throw buildError("Supervisor invalido", 403);
  }

  const text = normalizeText(observacion);
  if (!text) {
    throw buildError("La observacion es obligatoria", 400);
  }

  const eventual = await prisma.eventual.findUnique({
    where: { id: Number(eventualId) },
    include: {
      supervisor: { select: { id: true, username: true, nombre: true } },
    },
  });

  if (!eventual) {
    throw buildError("Eventual no encontrado", 404);
  }

  if (eventual.supervisor?.username !== actor.username) {
    throw buildError("No autorizado para observar este eventual", 403);
  }

  await prisma.$transaction(async (tx) => {
    await tx.historialEventual.create({
      data: {
        eventualId: Number(eventualId),
        accion: "SUPERVISOR_OBSERVACION",
        detalle: JSON.stringify({ observacion: text }),
        usuarioId: actor.id,
      },
    });
  });

  return getEventualDetail(eventualId);
}

function redondearHoras(minutos) {
  return Math.round((minutos / 60) * 100) / 100;
}

// Agrupa los fichajes por legajo y consulta en Browix la categoría de cada
// persona (customfield 137) para poder desglosar las horas totales por
// categoría. Un fallo al categorizar una persona puntual (legajo no
// encontrado, sin categoría cargada, error de red, etc.) no aborta la
// importación completa: esa persona queda igual en el desglose por persona
// (bajo "Sin categoría") y el motivo del fallo se reporta en
// erroresCategorizacion para quedar registrado.
async function categorizarHorasBrowix(fichajes, ubicacion) {
  const { grupos, sinLegajo } = agruparMinutosPorLegajo(fichajes, ubicacion);

  // Secuencial (no Promise.allSettled en paralelo): Browix limita getUsers a
  // 1 consulta/segundo por uuid y devuelve HTTP 400 si se la satura con
  // consultas concurrentes, aunque cada legajo sea válido.
  const resultadosCategoria = await getCategoriasPorLegajos(grupos.map((grupo) => grupo.legajo));

  const erroresCategorizacion = [];

  const personas = grupos.map((grupo, idx) => {
    const outcome = resultadosCategoria[idx];
    const totalHoras = redondearHoras(grupo.totalMinutos);
    const nombreFichaje = [grupo.nombre, grupo.apellido].filter(Boolean).join(" ").trim() || null;

    const base = {
      legajo: grupo.legajo,
      totalMinutos: grupo.totalMinutos,
      totalHoras,
      cantidadFichajes: grupo.cantidadFichajes,
    };

    if (outcome.status === "rejected") {
      const motivo = outcome.reason?.message || "Error consultando Browix";
      console.error(`Error obteniendo categoría de Browix para legajo ${grupo.legajo}`, outcome.reason);
      erroresCategorizacion.push({ legajo: grupo.legajo, nombre: nombreFichaje, motivo });
      return { ...base, nombre: nombreFichaje, categoria: null, error: motivo };
    }

    const usuario = outcome.value;

    if (!usuario.encontrado) {
      const motivo = "No se encontró el legajo en Browix (getUsers)";
      erroresCategorizacion.push({ legajo: grupo.legajo, nombre: nombreFichaje, motivo });
      return { ...base, nombre: nombreFichaje, categoria: null, error: motivo };
    }

    const nombreCompleto =
      [usuario.nombre, usuario.apellido].filter(Boolean).join(" ").trim() || nombreFichaje;

    if (!usuario.categoria) {
      const motivo = "El usuario no tiene categoría cargada en Browix (campo personalizado 137)";
      erroresCategorizacion.push({ legajo: grupo.legajo, nombre: nombreCompleto, motivo });
      return { ...base, nombre: nombreCompleto, categoria: null, error: motivo };
    }

    return { ...base, nombre: nombreCompleto, categoria: usuario.categoria, error: null };
  });

  const categoriasMap = new Map();
  for (const persona of personas) {
    const clave = persona.categoria || "Sin categoría";
    const actual = categoriasMap.get(clave) || { categoria: clave, totalMinutos: 0, cantidadPersonas: 0 };
    actual.totalMinutos += persona.totalMinutos;
    actual.cantidadPersonas += 1;
    categoriasMap.set(clave, actual);
  }

  const categorias = Array.from(categoriasMap.values())
    .map((c) => ({ ...c, totalHoras: redondearHoras(c.totalMinutos) }))
    .sort((a, b) => b.totalMinutos - a.totalMinutos);

  return { personas, categorias, fichajesSinLegajo: sinLegajo, erroresCategorizacion };
}

export async function importarHorasBrowixEventual({ eventualId, actorId, actorNombre }) {
  const eventual = await prisma.eventual.findUnique({ where: { id: Number(eventualId) } });
  if (!eventual) {
    throw buildError("Eventual no encontrado", 404);
  }

  if (eventual.estado !== "finalizado") {
    throw buildError("El eventual debe estar finalizado para importar horas de Browix", 400);
  }

  if (!eventual.fechaInicio || !eventual.fechaFin) {
    throw buildError(
      "El eventual debe tener fecha de inicio y fecha de fin cargadas para importar horas de Browix",
      400
    );
  }

  const fichajes = await getFichajesPorRango(eventual.fechaInicio, eventual.fechaFin);
  const { totalMinutos, totalMinutosReal, cantidadFichajes } = sumarHorasTeoricasPorUbicacion(
    fichajes,
    eventual.nombre
  );
  const { personas, categorias, fichajesSinLegajo, erroresCategorizacion } = await categorizarHorasBrowix(
    fichajes,
    eventual.nombre
  );

  if (fichajesSinLegajo > 0) {
    console.warn(
      `Eventual ${eventual.id}: ${fichajesSinLegajo} fichaje(s) sin legajo cargado en Browix, no se pudieron atribuir a una persona/categoría`
    );
  }
  if (erroresCategorizacion.length > 0) {
    console.warn(
      `Eventual ${eventual.id}: no se pudo determinar la categoría de ${erroresCategorizacion.length} persona(s)`,
      erroresCategorizacion
    );
  }

  const resultado = {
    totalMinutos,
    totalHoras: Math.round((totalMinutos / 60) * 100) / 100,
    totalMinutosReal,
    totalHorasReal: Math.round((totalMinutosReal / 60) * 100) / 100,
    cantidadFichajes,
    ubicacion: eventual.nombre,
    desde: eventual.fechaInicio.toISOString().slice(0, 10),
    hasta: eventual.fechaFin.toISOString().slice(0, 10),
    importadoEn: new Date().toISOString(),
    importadoPor: actorNombre || null,
    personas,
    categorias,
    fichajesSinLegajo,
    erroresCategorizacion,
  };

  await prisma.$transaction([
    prisma.eventual.update({
      where: { id: eventual.id },
      data: { horasBrowix: JSON.stringify(resultado) },
    }),
    prisma.historialEventual.create({
      data: {
        eventualId: eventual.id,
        accion: "HORAS_BROWIX_IMPORTADAS",
        detalle: JSON.stringify(resultado),
        usuarioId: actorId,
      },
    }),
  ]);

  return getEventualDetail(eventual.id);
}

// Agrupa los items de una lista de pedidos de insumos por insumo (código +
// nombre, ya que el código puede venir null y no alcanza solo). Suma
// cantidad y subtotal de cada insumo a través de todos los pedidos.
function agruparItemsPorInsumo(pedidos) {
  const porInsumo = new Map();

  for (const pedido of pedidos) {
    for (const item of Array.isArray(pedido.items) ? pedido.items : []) {
      const clave = `${item.codigo || ""}__${item.insumo || ""}`;
      const actual = porInsumo.get(clave) || {
        codigo: item.codigo ?? null,
        insumo: item.insumo,
        cantidad: 0,
        subtotal: 0,
      };
      actual.cantidad += Number(item.cantidad) || 0;
      actual.subtotal += Number(item.subtotal) || 0;
      porInsumo.set(clave, actual);
    }
  }

  return Array.from(porInsumo.values()).sort((a, b) => b.subtotal - a.subtotal);
}

// Importa desde la API de pedidos de insumos (insumos.kazaro.com.ar) todos
// los pedidos hechos para el servicio homónimo al eventual. Matchea por
// nombre exacto (mismo criterio que Browix), no por id: no hay una relación
// directa Eventual -> Servicio en el schema. Sin filtro de fecha: el nombre
// del eventual es único en el sistema, así que no hace falta acotar por
// rango (a diferencia de Browix). A diferencia de las horas de Browix, se
// puede reimportar tantas veces como se quiera mientras el eventual esté
// finalizado, siempre pisando el resultado anterior.
export async function importarInsumosEventual({ eventualId, actorId, actorNombre }) {
  const eventual = await prisma.eventual.findUnique({ where: { id: Number(eventualId) } });
  if (!eventual) {
    throw buildError("Eventual no encontrado", 404);
  }

  if (eventual.estado !== "finalizado") {
    throw buildError("El eventual debe estar finalizado para importar insumos", 400);
  }

  const coincidencias = await resolverServiciosPorNombre(eventual.nombre);

  const pedidos = [];
  for (const { token, servicioId } of coincidencias) {
    const pedidosEmpresa = await getPedidosInsumos({ token, servicioId });
    pedidos.push(...pedidosEmpresa);
  }

  const insumos = agruparItemsPorInsumo(pedidos);
  const total = pedidos.reduce((acc, p) => acc + (Number(p.total) || 0), 0);

  const resultado = {
    servicioIds: coincidencias.map((c) => c.servicioId),
    servicioNombre: eventual.nombre,
    cantidadPedidos: pedidos.length,
    total: Math.round(total * 100) / 100,
    importadoEn: new Date().toISOString(),
    importadoPor: actorNombre || null,
    insumos,
    pedidos: pedidos.map((p) => ({
      pedidoId: p.pedidoId,
      numero: p.numero,
      fechaHoraArgentina: p.fechaHoraArgentina,
      solicitante: p.solicitante,
      estado: p.estado,
      total: p.total,
    })),
  };

  await prisma.$transaction([
    prisma.eventual.update({
      where: { id: eventual.id },
      data: { insumosImportados: JSON.stringify(resultado) },
    }),
    prisma.historialEventual.create({
      data: {
        eventualId: eventual.id,
        accion: "INSUMOS_IMPORTADOS",
        detalle: JSON.stringify(resultado),
        usuarioId: actorId,
      },
    }),
  ]);

  return getEventualDetail(eventual.id);
}

// Carga manual, opcional, de horas de supervisor para el eventual. Igual que
// las horas de Browix, solo se permite una vez que el eventual está
// finalizado (no antes: mientras está activo puede seguir cambiando).
export async function actualizarHorasSupervisorEventual({ eventualId, horas, actorId, actorNombre }) {
  const eventual = await prisma.eventual.findUnique({ where: { id: Number(eventualId) } });
  if (!eventual) {
    throw buildError("Eventual no encontrado", 404);
  }

  if (eventual.estado !== "finalizado") {
    throw buildError("El eventual debe estar finalizado para cargar las horas de supervisor", 400);
  }

  let horasNormalizadas = null;
  if (horas !== null && horas !== undefined && String(horas).trim() !== "") {
    const horasNumero = Number(horas);
    if (!Number.isFinite(horasNumero) || horasNumero < 0) {
      throw buildError("Las horas de supervisor deben ser un número mayor o igual a 0", 400);
    }
    horasNormalizadas = Math.round(horasNumero * 100) / 100;
  }

  const detalle = {
    horasSupervisor: horasNormalizadas,
    actualizadoEn: new Date().toISOString(),
    actualizadoPor: actorNombre || null,
  };

  await prisma.$transaction([
    prisma.eventual.update({
      where: { id: eventual.id },
      data: { horasSupervisor: horasNormalizadas },
    }),
    prisma.historialEventual.create({
      data: {
        eventualId: eventual.id,
        accion: "HORAS_SUPERVISOR_ACTUALIZADAS",
        detalle: JSON.stringify(detalle),
        usuarioId: actorId,
      },
    }),
  ]);

  return getEventualDetail(eventual.id);
}

export async function finalizeSupervisorEventual(eventualId, actorUsername) {
  const actor = await getActorByUsername(actorUsername);
  if (!actor || !userHasAnyRole(actor, ROLES_SUPERVISION)) {
    throw buildError("Supervisor invalido", 403);
  }

  const eventual = await prisma.eventual.findUnique({
    where: { id: Number(eventualId) },
    include: {
      supervisor: { select: { id: true, username: true, nombre: true } },
    },
  });

  if (!eventual) {
    throw buildError("Eventual no encontrado", 404);
  }

  if (eventual.supervisor?.username !== actor.username) {
    throw buildError("No autorizado para finalizar este eventual", 403);
  }

  if (!eventual.activo) {
    throw buildError("El eventual no está activo", 400);
  }

  if (eventual.estado !== "activo") {
    throw buildError("Solo se pueden finalizar eventuales en estado activo", 400);
  }

  const fechaFin = eventual.fechaFin || new Date();

  await prisma.$transaction(async (tx) => {
    await tx.eventual.update({
      where: { id: Number(eventualId) },
      data: {
        estado: "finalizado",
        fechaFin,
      },
    });

    await tx.historialEventual.create({
      data: {
        eventualId: Number(eventualId),
        accion: "SUPERVISOR_FINALIZO_EVENTUAL",
        detalle: JSON.stringify({
          anterior: {
            nombre: eventual.nombre,
            estado: eventual.estado,
            fechaInicio: eventual.fechaInicio,
            fechaFin: eventual.fechaFin,
            observaciones: eventual.observaciones,
            supervisor: eventual.supervisor,
          },
          actual: {
            nombre: eventual.nombre,
            estado: "finalizado",
            fechaInicio: eventual.fechaInicio,
            fechaFin,
            observaciones: eventual.observaciones,
            supervisor: eventual.supervisor,
          },
        }),
        usuarioId: actor.id,
      },
    });
  });

  return getEventualDetail(eventualId);
}
