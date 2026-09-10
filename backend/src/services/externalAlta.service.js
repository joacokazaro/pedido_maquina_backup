import prisma from "../db/prisma.js";
import { whereHasAnyRole, ROLES_PEDIDO_TITULAR } from "./roles.service.js";
import { normalizeTipoServicio } from "./tipoServicio.service.js";
import { saveEventual } from "./eventuales.service.js";

const INTEGRACION_360_USERNAME = "integracion-kazaro360";

function buildError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeNombre(nombre) {
  return String(nombre || "").trim();
}

function normalizeIdBrowix(idBrowix) {
  const normalizado = String(idBrowix || "").trim().toUpperCase();
  return normalizado === "" ? null : normalizado;
}

function normalizeCodigo(value) {
  const normalizado = String(value || "").trim();
  return normalizado === "" ? null : normalizado;
}

/* ========================================================
   Actor de sistema para historial de Eventual: las altas
   externas no tienen un usuario humano detrás, pero
   saveEventual() exige un actorUsername resoluble.
======================================================== */
async function getIntegracionActor() {
  return prisma.usuario.upsert({
    where: { username: INTEGRACION_360_USERNAME },
    update: {},
    create: {
      username: INTEGRACION_360_USERNAME,
      nombre: "Integración Kazaró 360",
      rol: "integracion",
      activo: false,
      password: null,
      email: null,
    },
  });
}

/* ========================================================
   Match de supervisor por legajo o DNI: mismo criterio de
   elegibilidad que getSupervisorById (eventuales.service.js)
   y getSupervisoresCatalogo (admin_supervisores.controller.js).
   Prioriza legajo si vienen los dos.
======================================================== */
export async function resolverSupervisorPorLegajoODni({ legajo, dni } = {}) {
  const legajoNorm = normalizeCodigo(legajo);
  const dniNorm = normalizeCodigo(dni);

  if (!legajoNorm && !dniNorm) {
    return { usuario: null, motivo: "sin_dato" };
  }

  const usuario = await prisma.usuario.findFirst({
    where: {
      ...whereHasAnyRole(ROLES_PEDIDO_TITULAR),
      activo: true,
      ...(legajoNorm ? { legajo: legajoNorm } : { dni: dniNorm }),
    },
    select: { id: true, username: true, nombre: true },
  });

  if (!usuario) {
    return { usuario: null, motivo: "no_encontrado" };
  }

  return { usuario, motivo: null };
}

function buildSupervisorResponse(match) {
  if (!match.usuario) {
    return { matched: false, motivo: match.motivo };
  }
  return { matched: true, usuarioId: match.usuario.id, username: match.usuario.username };
}

/* ========================================================
   Alta de Servicio FIJO
======================================================== */
export async function crearServicioFijoExternal({ nombre, tipoServicio, idBrowix, legajo, dni }) {
  const nombreNorm = normalizeNombre(nombre);
  const tipoNorm = normalizeTipoServicio(tipoServicio);
  const idBrowixNorm = normalizeIdBrowix(idBrowix);

  if (!nombreNorm) {
    throw buildError("Nombre obligatorio", 400);
  }
  if (!tipoNorm) {
    throw buildError("Debe indicar el tipo del servicio (Limpieza o Espacios Verdes)", 400);
  }
  if (!idBrowixNorm) {
    throw buildError("idBrowix obligatorio para un servicio fijo", 400);
  }

  const existe = await prisma.servicio.findUnique({ where: { nombre: nombreNorm } });
  if (existe) {
    throw buildError("Ya existe un servicio con ese nombre", 409);
  }

  const match = await resolverSupervisorPorLegajoODni({ legajo, dni });

  const servicio = await prisma.$transaction(async (tx) => {
    const nuevo = await tx.servicio.create({
      data: { nombre: nombreNorm, idBrowix: idBrowixNorm, tipo: tipoNorm },
    });

    if (match.usuario) {
      await tx.usuarioServicio.create({
        data: { usuarioId: match.usuario.id, servicioId: nuevo.id },
      });
    }

    return nuevo;
  });

  return { servicio, supervisor: buildSupervisorResponse(match) };
}

/* ========================================================
   Alta de Servicio EVENTUAL
======================================================== */
export async function crearEventualExternal({ nombre, tipoServicio, fechaInicio, fechaFin, legajo, dni }) {
  const nombreNorm = normalizeNombre(nombre);

  if (!nombreNorm) {
    throw buildError("Nombre obligatorio", 400);
  }

  const existe = await prisma.eventual.findFirst({
    where: { nombre: nombreNorm },
    select: { id: true },
  });
  if (existe) {
    throw buildError("Ya existe un eventual con ese nombre", 409);
  }

  const match = await resolverSupervisorPorLegajoODni({ legajo, dni });
  const actor = await getIntegracionActor();

  const eventual = await saveEventual({
    eventualId: null,
    payload: {
      nombre: nombreNorm,
      tipo: tipoServicio,
      supervisorId: match.usuario?.id ?? null,
      estado: "activo",
      fechaInicio,
      fechaFin,
    },
    actorUsername: actor.username,
  });

  return { eventual, supervisor: buildSupervisorResponse(match) };
}
