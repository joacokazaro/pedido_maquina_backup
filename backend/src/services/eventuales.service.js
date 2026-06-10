import prisma from "../db/prisma.js";

export const ESTADOS_EVENTUAL_VALIDOS = ["activo", "finalizado", "cancelado"];
export const ESTADOS_KIT_VALIDOS = ["disponible", "asignado"];

const ESTADOS_PEDIDO_INACTIVOS = ["CERRADO", "CANCELADO"];

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeNullableText(value) {
  const normalized = normalizeText(value);
  return normalized ? normalized : null;
}

function uniqueStrings(values) {
  if (!Array.isArray(values)) return [];

  return Array.from(
    new Set(
      values
        .map((value) => normalizeText(value))
        .filter(Boolean)
    )
  );
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

function buildMachinePedidoActivo(maquina) {
  const pedido = maquina?.asignaciones?.[0]?.pedido;
  if (!pedido) return null;

  return {
    id: pedido.id,
    estado: pedido.estado,
    destino: pedido.destino,
    supervisorDestinoUsername: pedido.supervisorDestinoUsername,
    createdAt: pedido.createdAt,
    supervisor: pedido.supervisor?.username || null,
    supervisorNombre: pedido.supervisor?.nombre || null,
    titular: pedido.supervisor?.nombre || pedido.supervisor?.username || null,
  };
}

function buildMachineBloqueo(maquina) {
  const pedidoActivo = buildMachinePedidoActivo(maquina);
  if (pedidoActivo) {
    return {
      tipo: "pedido_activo",
      mensaje: `La maquina ${maquina.tipo} ${maquina.id} esta asignada al pedido ${pedidoActivo.id}.`,
    };
  }

  const estado = normalizeText(maquina?.estado).toLowerCase();
  if (estado && estado !== "disponible") {
    return {
      tipo: "estado",
      mensaje: `La maquina ${maquina.tipo} ${maquina.id} no esta disponible (${maquina.estado}).`,
    };
  }

  return null;
}

function buildVehiculoBloqueo(vehiculo) {
  const estado = normalizeText(vehiculo?.estado).toLowerCase();
  if (estado === "baja") {
    return {
      tipo: "estado",
      mensaje: `El vehiculo ${vehiculo.vehiculo} ${vehiculo.id} esta dado de baja.`,
    };
  }

  return null;
}

function mapMaquinaBasica(maquina, options = {}) {
  if (!maquina) return null;

  const pedidoActivo = buildMachinePedidoActivo(maquina);
  const kitActual = options.kitActual ?? maquina.kits?.[0]?.kit ?? null;
  const bloqueo = buildMachineBloqueo(maquina);

  return {
    id: maquina.id,
    tipo: maquina.tipo,
    modelo: maquina.modelo,
    serie: maquina.serie,
    estado: maquina.estado,
    servicio: maquina.servicio
      ? {
          id: maquina.servicio.id,
          nombre: maquina.servicio.nombre,
        }
      : null,
    pedidoActivo,
    kitActual: kitActual
      ? {
          id: kitActual.id,
          nombre: kitActual.nombre,
        }
      : null,
    bloqueo,
  };
}

function mapVehiculoBasico(vehiculo, options = {}) {
  if (!vehiculo) return null;

  const kitActual = options.kitActual ?? vehiculo.kits?.[0]?.kit ?? null;
  const bloqueo = buildVehiculoBloqueo(vehiculo);

  return {
    id: vehiculo.id,
    empresa: vehiculo.empresa,
    estado: vehiculo.estado,
    vehiculo: vehiculo.vehiculo,
    patente: vehiculo.patente,
    modelo: vehiculo.modelo,
    numeroPoliza: vehiculo.numeroPoliza,
    motor: vehiculo.motor,
    chasis: vehiculo.chasis,
    tipoCobertura: vehiculo.tipoCobertura,
    conductorActual: vehiculo.conductorActual
      ? {
          id: vehiculo.conductorActual.id,
          username: vehiculo.conductorActual.username,
          nombre: vehiculo.conductorActual.nombre,
        }
      : null,
    kitActual: kitActual
      ? {
          id: kitActual.id,
          nombre: kitActual.nombre,
        }
      : null,
    bloqueo,
  };
}

async function getActorByUsername(username) {
  const normalized = normalizeText(username);
  if (!normalized) return null;

  return prisma.usuario.findUnique({
    where: { username: normalized },
    select: { id: true, username: true, nombre: true, rol: true, activo: true },
  });
}

async function getSupervisorById(supervisorId) {
  if (!Number.isInteger(Number(supervisorId)) || Number(supervisorId) <= 0) return null;

  return prisma.usuario.findFirst({
    where: {
      id: Number(supervisorId),
      rol: "supervisor",
      activo: true,
    },
    select: { id: true, username: true, nombre: true },
  });
}

function buildKitInclude() {
  return {
    maquinas: {
      include: {
        maquina: {
          include: {
            servicio: { select: { id: true, nombre: true } },
            asignaciones: {
              where: { pedido: { estado: { notIn: ESTADOS_PEDIDO_INACTIVOS } } },
              orderBy: { pedido: { createdAt: "desc" } },
              take: 1,
              include: {
                pedido: {
                  select: {
                    id: true,
                    estado: true,
                    destino: true,
                    supervisorDestinoUsername: true,
                    createdAt: true,
                    supervisor: { select: { username: true, nombre: true } },
                  },
                },
              },
            },
          },
        },
      },
    },
    vehiculos: {
      include: {
        vehiculo: {
          include: {
            conductorActual: { select: { id: true, username: true, nombre: true } },
          },
        },
      },
    },
    eventuales: {
      where: { activo: true, estado: "activo" },
      select: {
        id: true,
        nombre: true,
        supervisor: { select: { id: true, username: true, nombre: true } },
      },
      take: 1,
    },
  };
}

async function getKitRecordById(kitId, tx = prisma) {
  if (!Number.isInteger(Number(kitId)) || Number(kitId) <= 0) return null;

  return tx.kit.findUnique({
    where: { id: Number(kitId) },
    include: buildKitInclude(),
  });
}

function buildKitBloqueos(kitRecord) {
  const bloqueos = [];

  for (const item of kitRecord?.maquinas || []) {
    const maquina = mapMaquinaBasica(item.maquina, {
      kitActual: { id: kitRecord.id, nombre: kitRecord.nombre },
    });
    if (maquina?.bloqueo) {
      bloqueos.push({
        categoria: "maquina",
        id: maquina.id,
        nombre: `${maquina.tipo} ${maquina.id}`,
        ...maquina.bloqueo,
      });
    }
  }

  for (const item of kitRecord?.vehiculos || []) {
    const vehiculo = mapVehiculoBasico(item.vehiculo, {
      kitActual: { id: kitRecord.id, nombre: kitRecord.nombre },
    });
    if (vehiculo?.bloqueo) {
      bloqueos.push({
        categoria: "vehiculo",
        id: vehiculo.id,
        nombre: `${vehiculo.vehiculo} ${vehiculo.id}`,
        ...vehiculo.bloqueo,
      });
    }
  }

  return bloqueos;
}

function mapKitDetail(kitRecord) {
  if (!kitRecord) return null;

  const bloqueos = buildKitBloqueos(kitRecord);

  return {
    id: kitRecord.id,
    nombre: kitRecord.nombre,
    observaciones: kitRecord.observaciones,
    estado: kitRecord.estado,
    activo: kitRecord.activo,
    createdAt: kitRecord.createdAt,
    eventualActivo: kitRecord.eventuales?.[0]
      ? {
          id: kitRecord.eventuales[0].id,
          nombre: kitRecord.eventuales[0].nombre,
          supervisor: kitRecord.eventuales[0].supervisor,
        }
      : null,
    maquinas: (kitRecord.maquinas || []).map((item) =>
      mapMaquinaBasica(item.maquina, { kitActual: { id: kitRecord.id, nombre: kitRecord.nombre } })
    ),
    vehiculos: (kitRecord.vehiculos || []).map((item) =>
      mapVehiculoBasico(item.vehiculo, { kitActual: { id: kitRecord.id, nombre: kitRecord.nombre } })
    ),
    resumen: {
      maquinas: kitRecord.maquinas?.length || 0,
      vehiculos: kitRecord.vehiculos?.length || 0,
      bloqueos: bloqueos.length,
    },
    bloqueadoParaAsignacion: bloqueos.length > 0,
    bloqueos,
  };
}

function buildKitSnapshotFromRecord(kitRecord) {
  const detail = mapKitDetail(kitRecord);
  if (!detail) return null;

  return {
    id: detail.id,
    nombre: detail.nombre,
    observaciones: detail.observaciones,
    estado: detail.estado,
    activo: detail.activo,
    createdAt: detail.createdAt,
    maquinas: detail.maquinas,
    vehiculos: detail.vehiculos,
    resumen: detail.resumen,
    bloqueadoParaAsignacion: detail.bloqueadoParaAsignacion,
    bloqueos: detail.bloqueos,
  };
}

export async function getKitSnapshotById(kitId, tx = prisma) {
  const kit = await getKitRecordById(kitId, tx);
  return buildKitSnapshotFromRecord(kit);
}

async function getMaquinasCatalogo(tx = prisma) {
  const maquinas = await tx.maquina.findMany({
    include: {
      servicio: { select: { id: true, nombre: true } },
      asignaciones: {
        where: { pedido: { estado: { notIn: ESTADOS_PEDIDO_INACTIVOS } } },
        orderBy: { pedido: { createdAt: "desc" } },
        take: 1,
        include: {
          pedido: {
            select: {
              id: true,
              estado: true,
              destino: true,
              supervisorDestinoUsername: true,
              createdAt: true,
              supervisor: { select: { username: true, nombre: true } },
            },
          },
        },
      },
      kits: {
        where: { kit: { activo: true } },
        select: { kit: { select: { id: true, nombre: true } } },
        take: 1,
      },
    },
    orderBy: [{ tipo: "asc" }, { id: "asc" }],
  });

  return maquinas.map((maquina) => mapMaquinaBasica(maquina));
}

async function getVehiculosCatalogo(tx = prisma) {
  const vehiculos = await tx.vehiculo.findMany({
    include: {
      conductorActual: { select: { id: true, username: true, nombre: true } },
      kits: {
        where: { kit: { activo: true } },
        select: { kit: { select: { id: true, nombre: true } } },
        take: 1,
      },
    },
    orderBy: [{ vehiculo: "asc" }, { id: "asc" }],
  });

  return vehiculos.map((vehiculo) => mapVehiculoBasico(vehiculo));
}

function parseComponentesUtilizados(value) {
  const parsed = parseJson(value);
  if (!parsed) {
    return { maquinaIds: [], vehiculoIds: [], kitSnapshot: null };
  }

  const maquinaIds = uniqueStrings(
    Array.isArray(parsed.maquinaIds)
      ? parsed.maquinaIds
      : Array.isArray(parsed.maquinas)
        ? parsed.maquinas.map((item) => (typeof item === "string" ? item : item?.id))
        : []
  );

  const vehiculoIds = uniqueStrings(
    Array.isArray(parsed.vehiculoIds)
      ? parsed.vehiculoIds
      : Array.isArray(parsed.vehiculos)
        ? parsed.vehiculos.map((item) => (typeof item === "string" ? item : item?.id))
        : []
  );

  const rawKitSnapshot = parsed.kitSnapshot && typeof parsed.kitSnapshot === "object"
    ? parsed.kitSnapshot
    : null;

  return { maquinaIds, vehiculoIds, kitSnapshot: rawKitSnapshot };
}

function serializeComponentesUtilizados(maquinaIds, vehiculoIds, kitSnapshot = null) {
  const normalized = {
    maquinaIds: uniqueStrings(maquinaIds),
    vehiculoIds: uniqueStrings(vehiculoIds),
  };

  if (!normalized.maquinaIds.length && !normalized.vehiculoIds.length && !kitSnapshot) {
    return null;
  }

  if (kitSnapshot) {
    normalized.kitSnapshot = kitSnapshot;
  }

  return JSON.stringify(normalized);
}

function buildPersistedKitSnapshot(snapshot) {
  if (!snapshot) return null;

  return {
    id: snapshot.id,
    nombre: snapshot.nombre,
    observaciones: snapshot.observaciones || null,
    estado: snapshot.estado,
    activo: snapshot.activo,
    createdAt: snapshot.createdAt,
    maquinas: Array.isArray(snapshot.maquinas) ? snapshot.maquinas : [],
    vehiculos: Array.isArray(snapshot.vehiculos) ? snapshot.vehiculos : [],
    resumen: snapshot.resumen || {
      maquinas: Array.isArray(snapshot.maquinas) ? snapshot.maquinas.length : 0,
      vehiculos: Array.isArray(snapshot.vehiculos) ? snapshot.vehiculos.length : 0,
      bloqueos: 0,
    },
    bloqueadoParaAsignacion: Boolean(snapshot.bloqueadoParaAsignacion),
    bloqueos: Array.isArray(snapshot.bloqueos) ? snapshot.bloqueos : [],
  };
}

function getIdsFromKitSnapshot(snapshot) {
  return {
    maquinaIds: uniqueStrings((snapshot?.maquinas || []).map((item) => item.id)),
    vehiculoIds: uniqueStrings((snapshot?.vehiculos || []).map((item) => item.id)),
  };
}

function sameIds(left, right) {
  const leftSorted = uniqueStrings(left).sort();
  const rightSorted = uniqueStrings(right).sort();
  return leftSorted.join("|") === rightSorted.join("|");
}

async function buildComponentesSnapshotFromIds(maquinaIds, vehiculoIds, tx = prisma) {
  const [maquinasCatalogo, vehiculosCatalogo] = await Promise.all([
    getMaquinasCatalogo(tx),
    getVehiculosCatalogo(tx),
  ]);

  const maquinasById = new Map(maquinasCatalogo.map((item) => [item.id, item]));
  const vehiculosById = new Map(vehiculosCatalogo.map((item) => [item.id, item]));

  return {
    maquinas: uniqueStrings(maquinaIds).map((id) => maquinasById.get(id)).filter(Boolean),
    vehiculos: uniqueStrings(vehiculoIds).map((id) => vehiculosById.get(id)).filter(Boolean),
  };
}

function ensureComponentesExist(snapshot, maquinaIds, vehiculoIds) {
  if (snapshot.maquinas.length !== uniqueStrings(maquinaIds).length) {
    throw buildError("Hay maquinas seleccionadas que no existen", 400);
  }

  if (snapshot.vehiculos.length !== uniqueStrings(vehiculoIds).length) {
    throw buildError("Hay vehiculos seleccionados que no existen", 400);
  }
}

function buildKitSnapshotWithComponentes(baseSnapshot, componentesSnapshot) {
  if (!baseSnapshot) return null;

  return {
    ...baseSnapshot,
    maquinas: componentesSnapshot.maquinas,
    vehiculos: componentesSnapshot.vehiculos,
    resumen: {
      maquinas: componentesSnapshot.maquinas.length,
      vehiculos: componentesSnapshot.vehiculos.length,
      bloqueos: baseSnapshot.bloqueos?.length || 0,
    },
  };
}

async function replaceKitComposition(tx, kitId, maquinaIds, vehiculoIds) {
  const resolvedKitId = Number(kitId);
  const machineIds = uniqueStrings(maquinaIds);
  const vehicleIds = uniqueStrings(vehiculoIds);

  if (machineIds.length > 0) {
    await tx.kitMaquina.deleteMany({
      where: {
        maquinaId: { in: machineIds },
        NOT: { kitId: resolvedKitId },
      },
    });
  }

  if (vehicleIds.length > 0) {
    await tx.kitVehiculo.deleteMany({
      where: {
        vehiculoId: { in: vehicleIds },
        NOT: { kitId: resolvedKitId },
      },
    });
  }

  await tx.kitMaquina.deleteMany({ where: { kitId: resolvedKitId } });
  await tx.kitVehiculo.deleteMany({ where: { kitId: resolvedKitId } });

  for (const maquinaId of machineIds) {
    await tx.kitMaquina.create({
      data: {
        kitId: resolvedKitId,
        maquinaId,
      },
    });
  }

  for (const vehiculoId of vehicleIds) {
    await tx.kitVehiculo.create({
      data: {
        kitId: resolvedKitId,
        vehiculoId,
      },
    });
  }
}

export async function syncKitEstado(kitId, tx = prisma) {
  if (!kitId) return null;

  const usoActivo = await tx.eventual.findFirst({
    where: {
      kitId: Number(kitId),
      activo: true,
      estado: "activo",
    },
    select: { id: true },
  });

  return tx.kit.update({
    where: { id: Number(kitId) },
    data: { estado: usoActivo ? "asignado" : "disponible" },
  });
}

async function syncKitEstados(kitIds, tx = prisma) {
  const ids = Array.from(new Set((kitIds || []).filter(Boolean).map((id) => Number(id))));
  for (const id of ids) {
    await syncKitEstado(id, tx);
  }
}

export async function getKitCatalogo() {
  const [maquinas, vehiculos] = await Promise.all([
    getMaquinasCatalogo(prisma),
    getVehiculosCatalogo(prisma),
  ]);

  return { maquinas, vehiculos };
}

export async function listKits(filters = {}) {
  const where = {};
  const search = normalizeText(filters.search);
  const estado = normalizeText(filters.estado).toLowerCase();

  if (filters.activo === "true") where.activo = true;
  if (filters.activo === "false") where.activo = false;
  if (estado && ESTADOS_KIT_VALIDOS.includes(estado)) where.estado = estado;
  if (search) {
    where.OR = [
      { nombre: { contains: search } },
      { observaciones: { contains: search } },
    ];
  }

  const kits = await prisma.kit.findMany({
    where,
    include: buildKitInclude(),
    orderBy: [{ nombre: "asc" }],
  });

  return kits.map((kit) => {
    const detail = mapKitDetail(kit);
    return {
      id: detail.id,
      nombre: detail.nombre,
      observaciones: detail.observaciones,
      estado: detail.estado,
      activo: detail.activo,
      createdAt: detail.createdAt,
      eventualActivo: detail.eventualActivo,
      resumen: detail.resumen,
      bloqueadoParaAsignacion: detail.bloqueadoParaAsignacion,
      bloqueos: detail.bloqueos,
    };
  });
}

export async function getKitDetail(kitId) {
  const kit = await getKitRecordById(kitId, prisma);
  if (!kit) return null;
  return mapKitDetail(kit);
}

function buildConflictos(maquinasCatalogo, vehiculosCatalogo, maquinaIds, vehiculoIds, currentKitId = null) {
  const conflictos = [];

  for (const maquinaId of uniqueStrings(maquinaIds)) {
    const maquina = maquinasCatalogo.find((item) => item.id === maquinaId);
    if (!maquina?.kitActual) continue;
    if (Number(maquina.kitActual.id) === Number(currentKitId)) continue;

    conflictos.push({
      tipo: "maquina",
      id: maquina.id,
      nombre: `${maquina.tipo} ${maquina.id}`,
      kitOrigen: maquina.kitActual,
    });
  }

  for (const vehiculoId of uniqueStrings(vehiculoIds)) {
    const vehiculo = vehiculosCatalogo.find((item) => item.id === vehiculoId);
    if (!vehiculo?.kitActual) continue;
    if (Number(vehiculo.kitActual.id) === Number(currentKitId)) continue;

    conflictos.push({
      tipo: "vehiculo",
      id: vehiculo.id,
      nombre: `${vehiculo.vehiculo} ${vehiculo.id}`,
      kitOrigen: vehiculo.kitActual,
    });
  }

  return conflictos;
}

export async function saveKit({ kitId, payload }) {
  const nombre = normalizeText(payload.nombre);
  const observaciones = normalizeNullableText(payload.observaciones);
  const maquinaIds = uniqueStrings(payload.maquinaIds);
  const vehiculoIds = uniqueStrings(payload.vehiculoIds);
  const confirmarReasignacion = Boolean(payload.confirmarReasignacion);

  if (!nombre) {
    throw buildError("El nombre del kit es obligatorio", 400);
  }

  const existing = kitId
    ? await prisma.kit.findUnique({
        where: { id: Number(kitId) },
        include: {
          maquinas: { select: { maquinaId: true } },
          vehiculos: { select: { vehiculoId: true } },
          eventuales: {
            where: { activo: true, estado: "activo" },
            select: { id: true },
            take: 1,
          },
        },
      })
    : null;

  if (kitId && !existing) {
    throw buildError("Kit no encontrado", 404);
  }

  const duplicate = await prisma.kit.findFirst({
    where: {
      nombre,
      NOT: kitId ? { id: Number(kitId) } : undefined,
    },
    select: { id: true },
  });

  if (duplicate) {
    throw buildError("Ya existe un kit con ese nombre", 400);
  }

  const [maquinasCatalogo, vehiculosCatalogo] = await Promise.all([
    getMaquinasCatalogo(prisma),
    getVehiculosCatalogo(prisma),
  ]);

  const conflictos = buildConflictos(
    maquinasCatalogo,
    vehiculosCatalogo,
    maquinaIds,
    vehiculoIds,
    existing?.id || null
  );

  if (conflictos.length > 0 && !confirmarReasignacion) {
    throw buildError("Hay componentes que ya pertenecen a otro kit", 409, { conflictos });
  }

  const existingMachineIds = uniqueStrings((existing?.maquinas || []).map((item) => item.maquinaId));
  const existingVehicleIds = uniqueStrings((existing?.vehiculos || []).map((item) => item.vehiculoId));
  const composicionCambio = !sameIds(existingMachineIds, maquinaIds) || !sameIds(existingVehicleIds, vehiculoIds);

  if (existing?.eventuales?.length && composicionCambio) {
    throw buildError("No se puede modificar la composicion de un kit asociado a un eventual activo", 400);
  }

  const savedKit = await prisma.$transaction(async (tx) => {
    const saved = existing
      ? await tx.kit.update({
          where: { id: Number(kitId) },
          data: {
            nombre,
            observaciones,
          },
        })
      : await tx.kit.create({
          data: {
            nombre,
            observaciones,
            estado: "disponible",
            activo: true,
          },
        });

    if (!existing?.eventuales?.length) {
      await replaceKitComposition(tx, saved.id, maquinaIds, vehiculoIds);
    }

    await syncKitEstado(saved.id, tx);
    return saved;
  });

  return getKitDetail(savedKit.id);
}

export async function deleteKit(kitId) {
  const existing = await prisma.kit.findUnique({
    where: { id: Number(kitId) },
    include: {
      eventuales: {
        where: { activo: true, estado: "activo" },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!existing) return null;

  if (existing.eventuales?.length) {
    throw buildError("No se puede dar de baja un kit asociado a un eventual activo", 400);
  }

  await prisma.kit.update({
    where: { id: Number(kitId) },
    data: { activo: false },
  });

  return true;
}

export async function reactivateKit(kitId) {
  const existing = await prisma.kit.findUnique({ where: { id: Number(kitId) } });
  if (!existing) return null;

  if (existing.activo) return true;

  const saved = await prisma.kit.update({ where: { id: Number(kitId) }, data: { activo: true } });
  await syncKitEstado(saved.id);
  return true;
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

function getSnapshotFromHistorial(historialEntries = []) {
  if (!Array.isArray(historialEntries)) return null;

  let last = null;
  for (const entry of historialEntries) {
    const detalle = parseJson(entry?.detalle);
    if (!detalle) continue;

    const candidate = detalle.actual || detalle.inicial || null;
    if (!candidate) continue;

    if (candidate.kit || candidate.componentesUtilizados) {
      last = {
        kit: candidate.kit || null,
        componentesUtilizados: candidate.componentesUtilizados || null,
      };
    }
  }

  return last;
}

function buildEventualSummary(eventual) {
  return {
    id: eventual.id,
    nombre: eventual.nombre,
    estado: eventual.estado,
    fechaInicio: eventual.fechaInicio,
    fechaFin: eventual.fechaFin,
    observaciones: eventual.observaciones,
    activo: eventual.activo,
    createdAt: eventual.createdAt,
    supervisor: eventual.supervisor
      ? {
          id: eventual.supervisor.id,
          username: eventual.supervisor.username,
          nombre: eventual.supervisor.nombre,
        }
      : null,
    kit: eventual.kit
      ? {
          id: eventual.kit.id,
          nombre: eventual.kit.nombre,
          estado: eventual.kit.estado,
        }
      : null,
    tieneComponentesUtilizadosPersonalizados: Boolean(eventual.componentesUtilizados),
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
  if (filters.kitId) where.kitId = Number(filters.kitId);
  if (estado && ESTADOS_EVENTUAL_VALIDOS.includes(estado)) where.estado = estado;
  if (username) where.supervisor = { username };
  if (search) {
    where.OR = [
      { nombre: { contains: search } },
      { observaciones: { contains: search } },
      { supervisor: { username: { contains: search } } },
      { supervisor: { nombre: { contains: search } } },
      { kit: { nombre: { contains: search } } },
    ];
  }

  const eventuales = await prisma.eventual.findMany({
    where,
    include: {
      supervisor: { select: { id: true, username: true, nombre: true } },
      kit: { select: { id: true, nombre: true, estado: true } },
      historial: {
        include: { usuario: { select: { id: true, username: true, nombre: true } } },
        orderBy: { fecha: "asc" },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return eventuales.map((eventual) => ({
    ...buildEventualSummary(eventual),
    historial: eventual.historial.map(mapHistorialEntry),
  }));
}

export async function getEventualDetail(eventualId) {
  const eventual = await prisma.eventual.findUnique({
    where: { id: Number(eventualId) },
    include: {
      supervisor: { select: { id: true, username: true, nombre: true } },
      kit: {
        select: {
          id: true,
          nombre: true,
          estado: true,
          observaciones: true,
        },
      },
      historial: {
        include: { usuario: { select: { id: true, username: true, nombre: true } } },
        orderBy: { fecha: "asc" },
      },
    },
  });

  if (!eventual) return null;

  const kitDetalle = eventual.kitId ? await getKitDetail(eventual.kitId) : null;
  const componentesIds = parseComponentesUtilizados(eventual.componentesUtilizados);
  const historialSnapshot = getSnapshotFromHistorial(eventual.historial);

  // Detecta datos legacy donde componentesUtilizados quedó desfasado respecto al kit del eventual.
  function isComponentesStale() {
    if (!eventual.componentesUtilizados || !kitDetalle) return false;
    const kitMaquinaIds = new Set((kitDetalle.maquinas || []).map((m) => m.id));
    const kitVehiculoIds = new Set((kitDetalle.vehiculos || []).map((v) => v.id));
    const savedMaquinas = componentesIds.maquinaIds || [];
    const savedVehiculos = componentesIds.vehiculoIds || [];
    const maquinasStale =
      savedMaquinas.length > 0 &&
      kitMaquinaIds.size > 0 &&
      !savedMaquinas.some((id) => kitMaquinaIds.has(id));
    const vehiculosStale =
      savedVehiculos.length > 0 &&
      kitVehiculoIds.size > 0 &&
      !savedVehiculos.some((id) => kitVehiculoIds.has(id));
    return maquinasStale || vehiculosStale;
  }

  const stale = isComponentesStale();
  const hasStoredKitSnapshot = Boolean(componentesIds.kitSnapshot);
  const storedSnapshot = hasStoredKitSnapshot ? buildPersistedKitSnapshot(componentesIds.kitSnapshot) : null;
  const historialComponentes = historialSnapshot?.componentesUtilizados && typeof historialSnapshot.componentesUtilizados === "object"
    ? historialSnapshot.componentesUtilizados
    : null;
  const historialKit = historialSnapshot?.kit && typeof historialSnapshot.kit === "object"
    ? buildPersistedKitSnapshot(historialSnapshot.kit)
    : null;

  const componentesSnapshot = storedSnapshot
    ? {
        maquinas: storedSnapshot.maquinas || [],
        vehiculos: storedSnapshot.vehiculos || [],
      }
    : historialComponentes
      ? {
          maquinas: Array.isArray(historialComponentes.maquinas) ? historialComponentes.maquinas : [],
          vehiculos: Array.isArray(historialComponentes.vehiculos) ? historialComponentes.vehiculos : [],
        }
    : eventual.componentesUtilizados && !stale
    ? await buildComponentesSnapshotFromIds(componentesIds.maquinaIds, componentesIds.vehiculoIds)
    : kitDetalle
      ? {
          maquinas: kitDetalle.maquinas,
          vehiculos: kitDetalle.vehiculos,
        }
      : { maquinas: [], vehiculos: [] };

  const resolvedMaquinaIds = storedSnapshot
    ? uniqueStrings((storedSnapshot.maquinas || []).map((item) => item.id))
    : historialComponentes
      ? uniqueStrings((historialComponentes.maquinas || []).map((item) => item.id))
    : eventual.componentesUtilizados && !stale
    ? componentesIds.maquinaIds
    : (kitDetalle?.maquinas || []).map((item) => item.id);
  const resolvedVehiculoIds = storedSnapshot
    ? uniqueStrings((storedSnapshot.vehiculos || []).map((item) => item.id))
    : historialComponentes
      ? uniqueStrings((historialComponentes.vehiculos || []).map((item) => item.id))
    : eventual.componentesUtilizados && !stale
    ? componentesIds.vehiculoIds
    : (kitDetalle?.vehiculos || []).map((item) => item.id);

  const kitResolved = storedSnapshot
    ? storedSnapshot
    : historialKit
      ? {
          ...historialKit,
          maquinas: componentesSnapshot.maquinas,
          vehiculos: componentesSnapshot.vehiculos,
          resumen: {
            maquinas: componentesSnapshot.maquinas.length,
            vehiculos: componentesSnapshot.vehiculos.length,
            bloqueos: historialKit.resumen?.bloqueos || 0,
          },
        }
    : kitDetalle
      ? {
          id: kitDetalle.id,
          nombre: kitDetalle.nombre,
          estado: kitDetalle.estado,
          observaciones: kitDetalle.observaciones,
          maquinas: componentesSnapshot.maquinas,
          vehiculos: componentesSnapshot.vehiculos,
          resumen: {
            maquinas: componentesSnapshot.maquinas.length,
            vehiculos: componentesSnapshot.vehiculos.length,
            bloqueos: kitDetalle.resumen?.bloqueos || 0,
          },
          bloqueadoParaAsignacion: kitDetalle.bloqueadoParaAsignacion,
          bloqueos: kitDetalle.bloqueos,
          activo: kitDetalle.activo,
          createdAt: kitDetalle.createdAt,
        }
      : null;

  return {
    ...buildEventualSummary(eventual),
    kit: kitResolved,
    componentesUtilizados: {
      maquinaIds: resolvedMaquinaIds,
      vehiculoIds: resolvedVehiculoIds,
      maquinas: componentesSnapshot.maquinas,
      vehiculos: componentesSnapshot.vehiculos,
      personalizados: Boolean(eventual.componentesUtilizados) && !stale,
    },
    historial: eventual.historial.map(mapHistorialEntry),
  };
}

async function validateKitAssignment(kitId, eventualId = null, tx = prisma) {
  if (!kitId) return { kit: null, snapshot: null };

  const kit = await getKitRecordById(kitId, tx);
  if (!kit || !kit.activo) {
    throw buildError("Kit no encontrado", 404);
  }

  const kitEnUso = await tx.eventual.findFirst({
    where: {
      kitId: Number(kitId),
      activo: true,
      estado: "activo",
      NOT: eventualId ? { id: Number(eventualId) } : undefined,
    },
    select: { id: true, nombre: true },
  });

  if (kitEnUso) {
    throw buildError("El kit ya esta asignado a otro eventual activo", 400);
  }

  const bloqueos = buildKitBloqueos(kit);
  if (bloqueos.length > 0) {
    throw buildError("El kit no puede asignarse porque tiene componentes bloqueados", 400, { bloqueos });
  }

  return {
    kit,
    snapshot: await getKitSnapshotById(kitId, tx),
  };
}

function toDateOrNull(value) {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const [, year, month, day] = match;
      // Guardar como fecha estable en UTC evita corrimientos por timezone.
      return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12, 0, 0));
    }
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildEventualPayload(payload) {
  return {
    nombre: normalizeText(payload.nombre),
    supervisorId: Number(payload.supervisorId),
    kitId:
      payload.kitId === null || payload.kitId === undefined || payload.kitId === ""
        ? null
        : Number(payload.kitId),
    estado: normalizeEstadoEventual(payload.estado),
    fechaInicio: toDateOrNull(payload.fechaInicio),
    fechaFin: toDateOrNull(payload.fechaFin),
    observaciones: normalizeNullableText(payload.observaciones),
    observacionesPosteriores: normalizeNullableText(payload.observacionesPosteriores),
    maquinaIds: Array.isArray(payload.maquinaIds) ? uniqueStrings(payload.maquinaIds) : null,
    vehiculoIds: Array.isArray(payload.vehiculoIds) ? uniqueStrings(payload.vehiculoIds) : null,
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

  if (!Number.isInteger(data.supervisorId) || data.supervisorId <= 0) {
    throw buildError("Supervisor invalido", 400);
  }

  if (data.fechaInicio && data.fechaFin && data.fechaFin < data.fechaInicio) {
    throw buildError("La fecha de finalización no puede ser menor a la fecha de inicio", 400);
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
          kit: { select: { id: true, nombre: true, estado: true, observaciones: true } },
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

  const supervisor = await getSupervisorById(data.supervisorId);
  if (!supervisor) {
    throw buildError("Supervisor no encontrado", 400);
  }

  if (!data.kitId && ((data.maquinaIds || []).length > 0 || (data.vehiculoIds || []).length > 0)) {
    throw buildError("No se pueden definir componentes utilizados sin kit asociado", 400);
  }

  const shouldAssignKit = Boolean(data.kitId && data.estado === "activo" && (existing?.activo ?? true));
  const validatedKit = shouldAssignKit
    ? await validateKitAssignment(data.kitId, eventualId || null)
    : data.kitId
      ? { kit: await getKitRecordById(data.kitId), snapshot: await getKitSnapshotById(data.kitId) }
      : { kit: null, snapshot: null };

  if (data.kitId && !validatedKit.kit) {
    throw buildError("Kit no encontrado", 404);
  }

  const tieneCierreSupervisorPrevio = Boolean(existing?.historial?.length) || existing?.estado === "finalizado";


  const previousKitSnapshot = existing?.kitId ? await getKitSnapshotById(existing.kitId) : null;
  const previousComponentesIds = parseComponentesUtilizados(existing?.componentesUtilizados);
  const previousComponentesSnapshot = existing?.componentesUtilizados
    ? await buildComponentesSnapshotFromIds(previousComponentesIds.maquinaIds, previousComponentesIds.vehiculoIds)
    : previousKitSnapshot
      ? {
          maquinas: previousKitSnapshot.maquinas || [],
          vehiculos: previousKitSnapshot.vehiculos || [],
        }
      : { maquinas: [], vehiculos: [] };

  const kitBaseIds = getIdsFromKitSnapshot(validatedKit.snapshot);
  // Si el kit cambió respecto al guardado anterior, siempre usamos la composición base del nuevo kit
  // para evitar que queden componentesUtilizados de un kit anterior.
  const kitChanged = Boolean(existing && Number(existing.kitId) !== Number(data.kitId));
  const selectedMachineIds = kitChanged
    ? kitBaseIds.maquinaIds
    : (data.maquinaIds ?? (data.kitId ? kitBaseIds.maquinaIds : []));
  const selectedVehicleIds = kitChanged
    ? kitBaseIds.vehiculoIds
    : (data.vehiculoIds ?? (data.kitId ? kitBaseIds.vehiculoIds : []));
  const componentesSnapshot = await buildComponentesSnapshotFromIds(selectedMachineIds, selectedVehicleIds);
  ensureComponentesExist(componentesSnapshot, selectedMachineIds, selectedVehicleIds);

  const kitSnapshotActual = buildKitSnapshotWithComponentes(validatedKit.snapshot, componentesSnapshot);

  // Persistimos SIEMPRE el snapshot de componentes/kit cuando hay kit para asegurar trazabilidad
  // aunque el kit se modifique más adelante.
  const componentesUtilizados = data.kitId
    ? serializeComponentesUtilizados(
        selectedMachineIds,
        selectedVehicleIds,
        buildPersistedKitSnapshot(kitSnapshotActual)
      )
    : null;

  const isFinalizedEdit = Boolean(existing && tieneCierreSupervisorPrevio);
  const observacionesPreviasPersistidas = existing
    ? (isFinalizedEdit ? existing.observaciones : data.observaciones)
    : data.observaciones;

  const eventual = await prisma.$transaction(async (tx) => {
    const saved = existing
      ? await tx.eventual.update({
          where: { id: Number(eventualId) },
          data: {
            nombre: data.nombre,
            supervisorId: data.supervisorId,
            kitId: data.kitId,
            estado: data.estado,
            fechaInicio: data.fechaInicio,
            fechaFin: data.fechaFin,
            observaciones: observacionesPreviasPersistidas,
            componentesUtilizados,
          },
        })
      : await tx.eventual.create({
          data: {
            nombre: data.nombre,
            supervisorId: data.supervisorId,
            kitId: data.kitId,
            estado: data.estado,
            fechaInicio: data.fechaInicio,
            fechaFin: data.fechaFin,
            observaciones: data.observaciones,
            componentesUtilizados,
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
            kit: previousKitSnapshot,
            componentesUtilizados: previousComponentesSnapshot,
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
            kit: kitSnapshotActual,
            componentesUtilizados: componentesSnapshot,
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
            kit: kitSnapshotActual,
            componentesUtilizados: componentesSnapshot,
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
      const accionObservacion = String(actor.rol || "").toLowerCase() === "coordinador"
        ? "COORDINADOR_OBSERVACION_POSTERIOR"
        : "ADMIN_OBSERVACION_POSTERIOR";

      await tx.historialEventual.create({
        data: {
          eventualId: saved.id,
          accion: accionObservacion,
          detalle: JSON.stringify({ observacion: data.observacionesPosteriores, tipo: "posterior" }),
          usuarioId: actor.id,
        },
      });
    }

    await syncKitEstados([existing?.kitId, data.kitId], tx);
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
      activo: true,
      kitId: true,
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

    await syncKitEstados([existing.kitId], tx);
  });

  return true;
}

export async function addSupervisorObservation(eventualId, actorUsername, observacion) {
  const actor = await getActorByUsername(actorUsername);
  if (!actor || actor.rol !== "supervisor") {
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

export async function finalizeSupervisorEventual(eventualId, actorUsername) {
  const actor = await getActorByUsername(actorUsername);
  if (!actor || actor.rol !== "supervisor") {
    throw buildError("Supervisor invalido", 403);
  }

  const eventual = await prisma.eventual.findUnique({
    where: { id: Number(eventualId) },
    include: {
      supervisor: { select: { id: true, username: true, nombre: true } },
      kit: { select: { id: true, nombre: true, estado: true, observaciones: true } },
    },
  });

  if (!eventual) {
    throw buildError("Eventual no encontrado", 404);
  }

  if (eventual.supervisor?.username !== actor.username) {
    throw buildError("No autorizado para finalizar este eventual", 403);
  }

  if (!eventual.activo) {
    throw buildError("El eventual no esta activo", 400);
  }

  if (eventual.estado !== "activo") {
    throw buildError("Solo se pueden finalizar eventuales en estado activo", 400);
  }

  const previousKitSnapshot = eventual.kitId ? await getKitSnapshotById(eventual.kitId) : null;
  const componentesIds = parseComponentesUtilizados(eventual.componentesUtilizados);
  const componentesSnapshot = eventual.componentesUtilizados
    ? await buildComponentesSnapshotFromIds(componentesIds.maquinaIds, componentesIds.vehiculoIds)
    : previousKitSnapshot
      ? {
          maquinas: previousKitSnapshot.maquinas || [],
          vehiculos: previousKitSnapshot.vehiculos || [],
        }
      : { maquinas: [], vehiculos: [] };
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
            kit: previousKitSnapshot,
            componentesUtilizados: componentesSnapshot,
          },
          actual: {
            nombre: eventual.nombre,
            estado: "finalizado",
            fechaInicio: eventual.fechaInicio,
            fechaFin,
            observaciones: eventual.observaciones,
            supervisor: eventual.supervisor,
            kit: previousKitSnapshot,
            componentesUtilizados: componentesSnapshot,
          },
        }),
        usuarioId: actor.id,
      },
    });

    await syncKitEstados([eventual.kitId], tx);
  });

  return getEventualDetail(eventualId);
}
