import prisma from "../db/prisma.js";
import { whereHasAnyRole, ROLES_PEDIDO_TITULAR } from "./roles.service.js";
import { normalizeTipoServicio } from "./tipoServicio.service.js";
import {
  saveEventual,
  getEventualDetail,
  contarPedidosQueFijanSupervisor,
  toDateOrNull,
} from "./eventuales.service.js";

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

/* ========================================================
   EDICIÓN (PATCH /external/servicios/:id)
   Solo se tocan los campos presentes en el body; repetir el
   mismo PATCH no cambia nada (cambios = []). El nombre sigue
   la misma regla de unicidad que el alta, pero cruzada: un
   nombre no puede repetirse entre servicios Y eventuales,
   porque crearPedido() vincula un eventual con su servicio
   homónimo por nombre.
======================================================== */
const ACCION_HISTORIAL_EDICION_360 = "EVENTUAL_EDITADO_KAZARO360";

function tieneCampo(body, campo) {
  return Object.prototype.hasOwnProperty.call(body, campo);
}

function mismoInstante(a, b) {
  return (a ? a.getTime() : null) === (b ? b.getTime() : null);
}

function validarNombreEdicion(body) {
  if (!tieneCampo(body, "nombre")) return undefined;
  const nombre = normalizeNombre(body.nombre);
  if (!nombre) {
    throw buildError('El campo "nombre" no puede estar vacío', 400);
  }
  return nombre;
}

function validarTipoServicioEdicion(body) {
  if (!tieneCampo(body, "tipoServicio")) return undefined;
  const tipo = normalizeTipoServicio(body.tipoServicio);
  if (!tipo) {
    throw buildError('El campo "tipoServicio" debe ser "LIMPIEZA" o "ESPACIOS_VERDES"', 400);
  }
  return tipo;
}

// undefined = no vino (no tocar), null = borrar la fecha.
function validarFechaEdicion(body, campo) {
  if (!tieneCampo(body, campo)) return undefined;
  const raw = body[campo];
  if (raw === null || String(raw).trim() === "") return null;
  const fecha = toDateOrNull(raw);
  if (!fecha) {
    throw buildError(`El campo "${campo}" no es una fecha válida (formato esperado: AAAA-MM-DD)`, 400);
  }
  return fecha;
}

function pidioCambioSupervisor(body) {
  return Boolean(normalizeCodigo(body.legajoSupervisor) || normalizeCodigo(body.dniSupervisor));
}

// "aplicado" = ese usuario queda como supervisor después del PATCH (haya
// cambiado algo o no). "matched" sin "aplicado" solo pasa en un eventual con
// el supervisor fijado por pedidos complementarios.
function buildSupervisorEdicionResponse(match, { aplicado, motivo } = {}) {
  if (!match.usuario) {
    return { matched: false, aplicado: false, motivo: match.motivo };
  }
  const respuesta = {
    matched: true,
    aplicado: Boolean(aplicado),
    usuarioId: match.usuario.id,
    username: match.usuario.username,
  };
  if (motivo) respuesta.motivo = motivo;
  return respuesta;
}

// El supervisor anterior se busca sin filtrar por rol ni por activo: si ya no
// es supervisor o fue dado de baja, igual hay que poder desvincularlo.
async function resolverUsuarioAnterior({ legajo, dni }) {
  const legajoNorm = normalizeCodigo(legajo);
  const dniNorm = normalizeCodigo(dni);
  if (!legajoNorm && !dniNorm) return null;

  return prisma.usuario.findFirst({
    where: legajoNorm ? { legajo: legajoNorm } : { dni: dniNorm },
    select: { id: true, username: true },
  });
}

async function assertNombreDisponible(nombre, { servicioIdPropio = null, eventualIdPropio = null } = {}) {
  const [servicio, eventual] = await Promise.all([
    prisma.servicio.findFirst({
      where: { nombre, ...(servicioIdPropio ? { NOT: { id: servicioIdPropio } } : {}) },
      select: { id: true },
    }),
    prisma.eventual.findFirst({
      where: { nombre, ...(eventualIdPropio ? { NOT: { id: eventualIdPropio } } : {}) },
      select: { id: true },
    }),
  ]);

  if (servicio) throw buildError("Ya existe un servicio con ese nombre", 409);
  if (eventual) throw buildError("Ya existe un eventual con ese nombre", 409);
}

// Carrera entre el chequeo de unicidad y el update: el índice único de la
// base termina rechazando el segundo, y se informa igual que el chequeo.
function mapUniqueViolation(e) {
  if (e?.code === "P2002") {
    return buildError("Ya existe un servicio o eventual con ese nombre", 409);
  }
  return e;
}

/* ========================================================
   Edición de Servicio FIJO
   Supervisores N:N: se agrega el nuevo sin tocar los que
   se cargaron a mano acá; el anterior solo se desvincula si
   360 lo informa explícitamente.
======================================================== */
export async function editarServicioFijoExternal(servicioId, body) {
  const servicio = await prisma.servicio.findUnique({ where: { id: servicioId } });
  if (!servicio) {
    throw buildError("No existe un servicio fijo con ese id", 404);
  }

  if (tieneCampo(body, "fechaInicio") || tieneCampo(body, "fechaFin")) {
    throw buildError('"fechaInicio" y "fechaFin" solo aplican a un servicio EVENTUAL', 400);
  }
  if (tieneCampo(body, "idBrowix") && normalizeIdBrowix(body.idBrowix) !== servicio.idBrowix) {
    throw buildError('El campo "idBrowix" no se puede modificar por esta API', 400);
  }

  const nombre = validarNombreEdicion(body);
  const tipo = validarTipoServicioEdicion(body);

  const cambios = [];
  const data = {};

  if (nombre !== undefined && nombre !== servicio.nombre) {
    await assertNombreDisponible(nombre, { servicioIdPropio: servicio.id });
    data.nombre = nombre;
    cambios.push("nombre");
  }
  if (tipo !== undefined && tipo !== servicio.tipo) {
    data.tipo = tipo;
    cambios.push("tipoServicio");
  }

  const match = pidioCambioSupervisor(body)
    ? await resolverSupervisorPorLegajoODni({ legajo: body.legajoSupervisor, dni: body.dniSupervisor })
    : { usuario: null, motivo: "sin_dato" };

  let agregarSupervisor = false;
  let desvincularId = null;
  let supervisorAnterior;

  if (match.usuario) {
    const vinculado = await prisma.usuarioServicio.findUnique({
      where: { usuarioId_servicioId: { usuarioId: match.usuario.id, servicioId: servicio.id } },
    });
    agregarSupervisor = !vinculado;
  }

  const pidioAnterior = Boolean(
    normalizeCodigo(body.legajoSupervisorAnterior) || normalizeCodigo(body.dniSupervisorAnterior)
  );
  if (pidioAnterior) {
    if (!match.usuario) {
      // Sin supervisor nuevo válido no se desvincula a nadie: el servicio
      // podría quedar sin supervisor por un legajo mal cargado en 360.
      supervisorAnterior = { encontrado: null, desvinculado: false, motivo: "sin_supervisor_nuevo" };
    } else {
      const anterior = await resolverUsuarioAnterior({
        legajo: body.legajoSupervisorAnterior,
        dni: body.dniSupervisorAnterior,
      });
      if (!anterior) {
        supervisorAnterior = { encontrado: false, desvinculado: false, motivo: "no_encontrado" };
      } else if (anterior.id === match.usuario.id) {
        supervisorAnterior = { encontrado: true, desvinculado: false, motivo: "es_el_supervisor_nuevo" };
      } else {
        const vinculoAnterior = await prisma.usuarioServicio.findUnique({
          where: { usuarioId_servicioId: { usuarioId: anterior.id, servicioId: servicio.id } },
        });
        if (vinculoAnterior) {
          desvincularId = vinculoAnterior.id;
          supervisorAnterior = { encontrado: true, desvinculado: true, username: anterior.username };
        } else {
          supervisorAnterior = {
            encontrado: true,
            desvinculado: false,
            username: anterior.username,
            motivo: "no_vinculado",
          };
        }
      }
    }
  }

  if (agregarSupervisor || desvincularId) cambios.push("supervisor");

  let actualizado = servicio;
  if (cambios.length > 0) {
    try {
      actualizado = await prisma.$transaction(async (tx) => {
        const saved = Object.keys(data).length
          ? await tx.servicio.update({ where: { id: servicio.id }, data })
          : servicio;

        if (agregarSupervisor) {
          await tx.usuarioServicio.create({
            data: { usuarioId: match.usuario.id, servicioId: servicio.id },
          });
        }
        if (desvincularId) {
          await tx.usuarioServicio.delete({ where: { id: desvincularId } });
        }

        return saved;
      });
    } catch (e) {
      throw mapUniqueViolation(e);
    }
  }

  const respuesta = {
    servicio: actualizado,
    cambios,
    supervisor: buildSupervisorEdicionResponse(match, { aplicado: Boolean(match.usuario) }),
  };
  if (supervisorAnterior) respuesta.supervisorAnterior = supervisorAnterior;
  return respuesta;
}

/* ========================================================
   Edición de Servicio EVENTUAL
   - Renombre en cascada del servicio homónimo que crearPedido()
     creó para los pedidos complementarios; si no, el próximo
     pedido crearía un servicio nuevo y partiría el historial.
     Se identifica por los pedidos del eventual (no solo por
     nombre) para no renombrar por error un servicio fijo que
     casualmente se llame igual.
   - El tipo no se propaga al servicio homónimo: mismo criterio
     que crearPedido(), que no pisa una reclasificación manual.
   - Mismas reglas que saveEventual() para supervisor fijado por
     pedidos, orden de fechas y fecha de fin de un finalizado.
======================================================== */
export async function editarEventualExternal(eventualId, body) {
  const eventual = await prisma.eventual.findUnique({
    where: { id: eventualId },
    include: { supervisor: { select: { id: true, username: true, nombre: true } } },
  });
  if (!eventual) {
    throw buildError("No existe un eventual con ese id", 404);
  }

  const nombre = validarNombreEdicion(body);
  const tipo = validarTipoServicioEdicion(body);
  const fechaInicio = validarFechaEdicion(body, "fechaInicio");
  const fechaFin = validarFechaEdicion(body, "fechaFin");

  const fechaInicioFinal = fechaInicio !== undefined ? fechaInicio : eventual.fechaInicio;
  const fechaFinFinal = fechaFin !== undefined ? fechaFin : eventual.fechaFin;

  if (fechaInicioFinal && fechaFinFinal && fechaFinFinal < fechaInicioFinal) {
    throw buildError('"fechaFin" no puede ser anterior a "fechaInicio"', 400);
  }
  if (eventual.estado === "finalizado" && !fechaFinFinal) {
    throw buildError('No se puede borrar "fechaFin" de un eventual finalizado', 400);
  }

  const cambios = [];
  const data = {};
  const anterior = {};
  const actual = {};
  let servicioHomonimo = null;

  if (nombre !== undefined && nombre !== eventual.nombre) {
    await assertNombreDisponible(nombre, { eventualIdPropio: eventual.id });
    servicioHomonimo = await prisma.servicio.findFirst({
      where: { nombre: eventual.nombre, pedidos: { some: { eventualId: eventual.id } } },
      select: { id: true, nombre: true },
    });
    data.nombre = nombre;
    cambios.push("nombre");
    anterior.nombre = eventual.nombre;
    actual.nombre = nombre;
  }

  if (tipo !== undefined && tipo !== eventual.tipo) {
    data.tipo = tipo;
    cambios.push("tipoServicio");
    anterior.tipo = eventual.tipo;
    actual.tipo = tipo;
  }

  for (const [campo, valor] of [["fechaInicio", fechaInicio], ["fechaFin", fechaFin]]) {
    if (valor !== undefined && !mismoInstante(valor, eventual[campo])) {
      data[campo] = valor;
      cambios.push(campo);
      anterior[campo] = eventual[campo];
      actual[campo] = valor;
    }
  }

  const match = pidioCambioSupervisor(body)
    ? await resolverSupervisorPorLegajoODni({ legajo: body.legajoSupervisor, dni: body.dniSupervisor })
    : { usuario: null, motivo: "sin_dato" };

  let supervisor = buildSupervisorEdicionResponse(match);
  if (match.usuario) {
    if (match.usuario.id === eventual.supervisorId) {
      supervisor = buildSupervisorEdicionResponse(match, { aplicado: true });
    } else if ((await contarPedidosQueFijanSupervisor(eventual.id)) > 0) {
      supervisor = buildSupervisorEdicionResponse(match, {
        aplicado: false,
        motivo: "supervisor_fijado_por_pedidos",
      });
    } else {
      data.supervisorId = match.usuario.id;
      cambios.push("supervisor");
      anterior.supervisor = eventual.supervisor;
      actual.supervisor = { id: match.usuario.id, username: match.usuario.username, nombre: match.usuario.nombre };
      supervisor = buildSupervisorEdicionResponse(match, { aplicado: true });
    }
  }

  if (cambios.length > 0) {
    const actor = await getIntegracionActor();

    try {
      await prisma.$transaction(async (tx) => {
        await tx.eventual.update({ where: { id: eventual.id }, data });

        if (servicioHomonimo) {
          await tx.servicio.update({ where: { id: servicioHomonimo.id }, data: { nombre } });
        }

        await tx.historialEventual.create({
          data: {
            eventualId: eventual.id,
            accion: ACCION_HISTORIAL_EDICION_360,
            detalle: JSON.stringify({
              origen: "Kazaró 360 (API externa)",
              cambios,
              anterior,
              actual,
              ...(servicioHomonimo
                ? {
                    servicioHomonimoRenombrado: {
                      id: servicioHomonimo.id,
                      nombreAnterior: servicioHomonimo.nombre,
                      nombreNuevo: nombre,
                    },
                  }
                : {}),
            }),
            usuarioId: actor.id,
          },
        });
      });
    } catch (e) {
      throw mapUniqueViolation(e);
    }
  }

  return {
    eventual: await getEventualDetail(eventual.id),
    cambios,
    supervisor,
  };
}
