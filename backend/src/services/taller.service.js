import prisma from "../db/prisma.js";
import {
  ESTADO_TALLER,
  canonicalEstadoMaquina,
  canonicalEstadoVehiculo,
} from "./inventarioEstados.service.js";
import { buildError } from "./httpError.service.js";

export const TALLER_TIPO_MAQUINA = "maquina";
export const TALLER_TIPO_VEHICULO = "vehiculo";
export const TALLER_ACCIONES_VALIDAS = ["ingreso", "egreso"];

function normalizeIds(ids) {
  return Array.isArray(ids)
    ? [...new Set(ids.map((item) => String(item || "").trim()).filter(Boolean))]
    : [];
}

function normalizeObservacion(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function getEstadoDestino(tipo, accion) {
  if (accion === "ingreso") return ESTADO_TALLER;
  return tipo === TALLER_TIPO_VEHICULO ? "activo" : "disponible";
}

function isYaEnDestino(tipo, actual, accion) {
  const canonical = tipo === TALLER_TIPO_VEHICULO ? canonicalEstadoVehiculo(actual) : canonicalEstadoMaquina(actual);
  return canonical === getEstadoDestino(tipo, accion);
}

export async function aplicarMovimientoTaller({ tipo, ids, accion, observacion, actorId }) {
  const normalizedIds = normalizeIds(ids);

  if (!normalizedIds.length) {
    throw buildError("Debe indicar al menos un registro", 400);
  }

  if (!TALLER_ACCIONES_VALIDAS.includes(accion)) {
    throw buildError("Acción de taller inválida", 400);
  }

  const model = tipo === TALLER_TIPO_VEHICULO ? prisma.vehiculo : prisma.maquina;
  const idField = tipo === TALLER_TIPO_VEHICULO ? "vehiculoId" : "maquinaId";
  const targetEstado = getEstadoDestino(tipo, accion);
  const observacionNormalizada = normalizeObservacion(observacion);

  const existentes = await model.findMany({
    where: { id: { in: normalizedIds } },
    select: { id: true, estado: true },
  });

  if (existentes.length !== normalizedIds.length) {
    const encontrados = new Set(existentes.map((item) => item.id));
    const faltantes = normalizedIds.filter((id) => !encontrados.has(id));
    throw buildError(`Registros inexistentes: ${faltantes.join(", ")}`, 400);
  }

  const actualizados = [];
  const omitidos = [];

  await prisma.$transaction(async (tx) => {
    for (const item of existentes) {
      if (isYaEnDestino(tipo, item.estado, accion)) {
        omitidos.push({ id: item.id, estadoActual: item.estado });
        continue;
      }

      await (tipo === TALLER_TIPO_VEHICULO ? tx.vehiculo : tx.maquina).update({
        where: { id: item.id },
        data: { estado: targetEstado },
      });

      await tx.tallerMovimiento.create({
        data: {
          tipo,
          accion,
          observacion: observacionNormalizada,
          usuarioId: actorId,
          [idField]: item.id,
        },
      });

      actualizados.push({ id: item.id, estadoAnterior: item.estado, estadoNuevo: targetEstado });
    }
  });

  return {
    tipo,
    accion,
    estadoDestino: targetEstado,
    actualizados,
    omitidos,
  };
}

function parseFechaFiltro(value, finDeDia = false) {
  if (!value) return null;
  const base = /^\d{4}-\d{2}-\d{2}$/.test(String(value).trim())
    ? new Date(`${value}T${finDeDia ? "23:59:59.999" : "00:00:00.000"}`)
    : new Date(value);
  return Number.isNaN(base.getTime()) ? null : base;
}

export async function getHistorialTaller(tipo, filtros = {}) {
  const {
    limit = 300,
    accion,
    usuarioId,
    maquinaId,
    vehiculoId,
    servicioId,
    tipoMaquina,
    empresa,
    desde,
    hasta,
  } = filtros;

  const where = { tipo };

  if (TALLER_ACCIONES_VALIDAS.includes(accion)) where.accion = accion;
  if (usuarioId) where.usuarioId = Number(usuarioId);

  if (tipo === TALLER_TIPO_MAQUINA) {
    if (maquinaId) where.maquinaId = String(maquinaId);
    if (servicioId || tipoMaquina) {
      where.maquina = {
        ...(servicioId ? { servicioId: Number(servicioId) } : {}),
        ...(tipoMaquina ? { tipo: String(tipoMaquina) } : {}),
      };
    }
  }

  if (tipo === TALLER_TIPO_VEHICULO) {
    if (vehiculoId) where.vehiculoId = String(vehiculoId);
    if (empresa) where.vehiculo = { empresa: String(empresa) };
  }

  const desdeDate = parseFechaFiltro(desde, false);
  const hastaDate = parseFechaFiltro(hasta, true);
  if (desdeDate || hastaDate) {
    where.createdAt = {};
    if (desdeDate) where.createdAt.gte = desdeDate;
    if (hastaDate) where.createdAt.lte = hastaDate;
  }

  return prisma.tallerMovimiento.findMany({
    where,
    include: {
      usuario: {
        select: { id: true, username: true, nombre: true, rol: true },
      },
      maquina: tipo === TALLER_TIPO_MAQUINA
        ? { select: { id: true, tipo: true, modelo: true, estado: true, servicio: { select: { id: true, nombre: true } } } }
        : false,
      vehiculo: tipo === TALLER_TIPO_VEHICULO
        ? { select: { id: true, vehiculo: true, patente: true, modelo: true, empresa: true, estado: true } }
        : false,
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Number(limit) || 300, 1000),
  });
}