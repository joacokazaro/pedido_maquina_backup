import prisma from "../db/prisma.js";
import {
  ESTADO_TALLER,
  canonicalEstadoMaquina,
  canonicalEstadoVehiculo,
} from "./inventarioEstados.service.js";

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
    throw new Error("Debe indicar al menos un registro");
  }

  if (!TALLER_ACCIONES_VALIDAS.includes(accion)) {
    throw new Error("Acción de taller inválida");
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
    throw new Error(`Registros inexistentes: ${faltantes.join(", ")}`);
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

export async function getHistorialTaller(tipo, limit = 100) {
  return prisma.tallerMovimiento.findMany({
    where: { tipo },
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
    take: limit,
  });
}