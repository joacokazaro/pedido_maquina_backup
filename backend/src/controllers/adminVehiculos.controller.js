import prisma from "../db/prisma.js";
import ExcelJS from "exceljs";
import {
  ESTADOS_VEHICULO_VALIDOS,
  canonicalEstadoVehiculo,
  normalizeEstadoVehiculo as normalizeEstadoVehiculoCanon,
} from "../services/inventarioEstados.service.js";

function computeFaltantesFinalesFromHistorial(historial) {
  if (!Array.isArray(historial) || historial.length === 0) return [];

  const faltantes = new Set();
  const devueltas = new Set();

  for (const h of historial) {
    if (!h || !h.detalle) continue;
    let d = null;
    try {
      d = typeof h.detalle === "string" ? JSON.parse(h.detalle) : h.detalle;
    } catch (e) {
      d = null;
    }
    const f = d?.faltantes || d?.faltantesConfirmados || [];
    const dv = [].concat(d?.devueltas || [], d?.devueltasConfirmadas || [], d?.devueltasDeclaradas || []);

    if (Array.isArray(f)) {
      for (const id of f) if (id) faltantes.add(String(id));
    }

    if (Array.isArray(dv)) {
      for (const id of dv) if (id) devueltas.add(String(id));
    }
  }

  // quitar devueltas
  for (const id of devueltas) {
    if (faltantes.has(id)) faltantes.delete(id);
  }

  return Array.from(faltantes);
}

function normalizeString(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeNullableString(value) {
  const normalized = normalizeString(value);
  return normalized === "" ? null : normalized;
}

function normalizeEstadoVehiculo(value) {
  return normalizeEstadoVehiculoCanon(value, "disponible");
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;

  const normalized = normalizeString(value).toLowerCase();
  if (["1", "si", "sí", "true", "x", "tiene", "yes"].includes(normalized)) return true;
  if (["0", "no", "false", "no tiene"].includes(normalized)) return false;

  return fallback;
}

function parseNullableDate(value) {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "string") {
    const normalized = value.trim();
    const match = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

    if (match) {
      const [, day, month, year] = match;
      const parsed = new Date(Number(year), Number(month) - 1, Number(day));

      if (
        parsed.getFullYear() === Number(year) &&
        parsed.getMonth() === Number(month) - 1 &&
        parsed.getDate() === Number(day)
      ) {
        return parsed;
      }

      return null;
    }
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateForSpreadsheet(value) {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

function buildDateFieldPayload(rawDate, rawAplica, defaultAplica = true) {
  const aplica = rawAplica === undefined ? defaultAplica : normalizeBoolean(rawAplica, defaultAplica);
  return {
    aplica,
    fecha: aplica ? parseNullableDate(rawDate) : null,
  };
}

function normalizeImportHeader(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.]/g, "")
    .replace(/\s+/g, "_");
}

function getImportValue(row, ...keys) {
  for (const key of keys) {
    const normalizedKey = normalizeImportHeader(key);
    if (Object.prototype.hasOwnProperty.call(row, normalizedKey)) {
      return row[normalizedKey];
    }
  }
  return undefined;
}

// Distingue "celda vacía/columna ausente" (no tocar el dato existente en una
// actualización) de "celda con contenido" (aplicar el valor), sin importar el
// tipo de dato crudo que venga (string, número de fecha Excel, Date, etc.).
function hasImportValue(raw) {
  if (raw === undefined || raw === null) return false;
  if (typeof raw === "string") return raw.trim() !== "";
  return true;
}

// Aplica al objeto `data` de un update un par fecha/aplica respetando la regla
// "vacío = no cambiar": aplica solo se toca si vino informado (y si pasa a
// false, fuerza la fecha a null, igual que en el alta); la fecha solo se toca
// si vino informada.
function applyFechaAplicaUpdate(data, aplicaKey, fechaKey, aplicaProvided, aplicaValue, fechaProvided, fechaValue) {
  if (aplicaProvided) {
    data[aplicaKey] = aplicaValue;
    if (!aplicaValue) {
      data[fechaKey] = null;
      return;
    }
  }
  if (fechaProvided) {
    data[fechaKey] = fechaValue;
  }
}

function excelSerialToDateParts(serial) {
  const utcDays = Math.floor(serial - 25569);
  const date = new Date(utcDays * 86400 * 1000);
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() };
}

function excelCellRawValue(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value;
  if (typeof value === "object") {
    if (Array.isArray(value.richText)) {
      return value.richText.map((t) => t.text).join("");
    }
    if (value.result !== undefined) return excelCellRawValue(value.result);
    if (value.text !== undefined) return value.text;
    if (value.error !== undefined) return "";
  }
  return value;
}

function parseExcelDate(value) {
  if (value === undefined || value === null || value === "") return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "number") {
    const parsed = excelSerialToDateParts(value);
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }

  return parseNullableDate(value);
}

function mapVehiculo(vehiculo) {
  const asignacionActual = (vehiculo.historialAsignaciones || []).find((item) => !item.fechaHasta) || null;
  const asignacionPedido = (vehiculo.asignacionesPedido || [])[0] || null;

  const pedidoActivo = asignacionPedido?.pedido
    ? {
        id: asignacionPedido.pedido.id,
        estado: asignacionPedido.pedido.estado,
        destino: asignacionPedido.pedido.destino,
        supervisor: asignacionPedido.pedido.supervisor?.username ?? null,
        supervisorNombre:
          asignacionPedido.pedido.supervisor?.nombre ??
          asignacionPedido.pedido.supervisor?.username ??
          null,
        titular: asignacionPedido.pedido.supervisorDestinoUsername ?? null,
        conFaltantes: false,
      }
    : null;

  if (pedidoActivo && asignacionPedido.pedido.historial?.length) {
    const finales = computeFaltantesFinalesFromHistorial(asignacionPedido.pedido.historial);
    pedidoActivo.conFaltantes = asignacionPedido.pedido.estado === "CERRADO" && finales.length > 0;
  }

  return {
    id: vehiculo.id,
    empresa: vehiculo.empresa,
    estado: vehiculo.estado === "baja" ? "baja" : pedidoActivo ? "asignada" : canonicalEstadoVehiculo(vehiculo.estado),
    vehiculo: vehiculo.vehiculo,
    patente: vehiculo.patente,
    modelo: vehiculo.modelo,
    numeroPoliza: vehiculo.numeroPoliza,
    motor: vehiculo.motor,
    chasis: vehiculo.chasis,
    tipoCobertura: vehiculo.tipoCobertura,
    tarjetaVerde: vehiculo.tarjetaVerde,
    vtoSeguro: vehiculo.vtoSeguro,
    vtoSeguroAplica: vehiculo.vtoSeguroAplica,
    vtoMatafuego: vehiculo.vtoMatafuego,
    vtoMatafuegoAplica: vehiculo.vtoMatafuegoAplica,
    vtoItv: vehiculo.vtoItv,
    vtoItvAplica: vehiculo.vtoItvAplica,
    obleaGnc: vehiculo.obleaGnc,
    obleaGncAplica: vehiculo.obleaGncAplica,
    pruebaHidraulicaGnc: vehiculo.pruebaHidraulicaGnc,
    pruebaHidraulicaGncAplica: vehiculo.pruebaHidraulicaGncAplica,
    createdAt: vehiculo.createdAt,
    seguro: vehiculo.seguro
      ? { id: vehiculo.seguro.id, nombre: vehiculo.seguro.nombre }
      : null,
    tipoMaquina: vehiculo.tipoMaquina
      ? { id: vehiculo.tipoMaquina.id, nombre: vehiculo.tipoMaquina.nombre }
      : null,
    conductorActual: vehiculo.conductorActual
      ? {
          id: vehiculo.conductorActual.id,
          username: vehiculo.conductorActual.username,
          nombre: vehiculo.conductorActual.nombre,
          rol: vehiculo.conductorActual.rol,
          vtoCarnetConductor: vehiculo.conductorActual.vtoCarnetConductor,
        }
      : null,
    asignacionActual: asignacionActual
      ? {
          id: asignacionActual.id,
          fechaDesde: asignacionActual.fechaDesde,
          observacion: asignacionActual.observacion,
          usuario: asignacionActual.usuario
            ? {
                id: asignacionActual.usuario.id,
                username: asignacionActual.usuario.username,
                nombre: asignacionActual.usuario.nombre,
              }
            : null,
        }
      : null,
    pedidoActivo,
  };
}

async function ensureVehiculoTipoMaquina(client = prisma) {
  const nombre = "VEHICULO";
  const existentes = await client.tipoMaquina.findMany({
    where: {
      nombre: {
        equals: nombre,
      },
    },
    take: 1,
  });

  if (existentes.length > 0) return existentes[0];
  return client.tipoMaquina.create({ data: { nombre } });
}

async function ensureSeguroExists(seguroId) {
  if (!Number.isInteger(seguroId) || seguroId <= 0) return null;
  const seguro = await prisma.seguro.findUnique({ where: { id: seguroId } });
  return seguro;
}

async function ensureTipoMaquinaExists(tipoMaquinaId, client = prisma) {
  if (!Number.isInteger(tipoMaquinaId) || tipoMaquinaId <= 0) return null;
  return client.tipoMaquina.findUnique({ where: { id: tipoMaquinaId } });
}

async function ensureUsuarioExists(usuarioId) {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  return usuario;
}

function buildVehiculoData(body, currentVehiculo = null) {
  const vtoSeguro = buildDateFieldPayload(body.vtoSeguro, body.vtoSeguroAplica, currentVehiculo?.vtoSeguroAplica ?? true);
  const vtoMatafuego = buildDateFieldPayload(body.vtoMatafuego, body.vtoMatafuegoAplica, currentVehiculo?.vtoMatafuegoAplica ?? true);
  const vtoItv = buildDateFieldPayload(body.vtoItv, body.vtoItvAplica, currentVehiculo?.vtoItvAplica ?? true);
  const obleaGnc = buildDateFieldPayload(body.obleaGnc, body.obleaGncAplica, currentVehiculo?.obleaGncAplica ?? true);
  const pruebaHidraulicaGnc = buildDateFieldPayload(
    body.pruebaHidraulicaGnc,
    body.pruebaHidraulicaGncAplica,
    currentVehiculo?.pruebaHidraulicaGncAplica ?? true
  );

  return {
    tipoMaquinaId:
      body.tipoMaquinaId === undefined || body.tipoMaquinaId === null || body.tipoMaquinaId === ""
        ? null
        : Number(body.tipoMaquinaId),
    empresa: normalizeString(body.empresa),
    estado: normalizeEstadoVehiculo(body.estado ?? currentVehiculo?.estado),
    vehiculo: normalizeString(body.vehiculo),
    patente: normalizeString(body.patente).toUpperCase(),
    modelo: normalizeString(body.modelo),
    numeroPoliza: normalizeNullableString(body.numeroPoliza),
    motor: normalizeString(body.motor),
    chasis: normalizeString(body.chasis),
    tipoCobertura: normalizeString(body.tipoCobertura),
    seguroId:
      body.seguroId === undefined || body.seguroId === null || body.seguroId === ""
        ? null
        : Number(body.seguroId),
    conductorActualId:
      body.conductorActualId === undefined || body.conductorActualId === null || body.conductorActualId === ""
        ? null
        : Number(body.conductorActualId),
    tarjetaVerde: normalizeBoolean(body.tarjetaVerde, currentVehiculo?.tarjetaVerde ?? false),
    vtoSeguro: vtoSeguro.fecha,
    vtoSeguroAplica: vtoSeguro.aplica,
    vtoMatafuego: vtoMatafuego.fecha,
    vtoMatafuegoAplica: vtoMatafuego.aplica,
    vtoItv: vtoItv.fecha,
    vtoItvAplica: vtoItv.aplica,
    obleaGnc: obleaGnc.fecha,
    obleaGncAplica: obleaGnc.aplica,
    pruebaHidraulicaGnc: pruebaHidraulicaGnc.fecha,
    pruebaHidraulicaGncAplica: pruebaHidraulicaGnc.aplica,
  };
}

function validateVehiculoData(data) {
  const requiredFields = [
    ["empresa", data.empresa],
    ["estado", data.estado],
    ["vehiculo", data.vehiculo],
    ["patente", data.patente],
    ["modelo", data.modelo],
  ];

  const missing = requiredFields.filter(([, value]) => !value).map(([key]) => key);
  if (missing.length > 0) {
    return `Campos obligatorios faltantes: ${missing.join(", ")}`;
  }

  if (data.tipoMaquinaId !== null && (!Number.isInteger(data.tipoMaquinaId) || data.tipoMaquinaId <= 0)) {
    return "tipoMaquinaId inválido";
  }

  if (data.conductorActualId !== null && (!Number.isInteger(data.conductorActualId) || data.conductorActualId <= 0)) {
    return "conductorActualId inválido";
  }

  return null;
}

export async function adminGetVehiculos(req, res) {
  try {
    const { search, estado, empresa, seguroId, conductorId } = req.query;
    const where = {};

    if (normalizeString(estado)) {
      where.estado = normalizeEstadoVehiculo(estado);
    }

    if (normalizeString(empresa)) {
      where.empresa = { contains: normalizeString(empresa) };
    }

    if (normalizeString(seguroId)) {
      where.seguroId = Number(seguroId);
    }

    if (normalizeString(conductorId)) {
      where.conductorActualId = Number(conductorId);
    }

    if (normalizeString(search)) {
      const q = normalizeString(search);
      where.OR = [
        { id: { contains: q } },
        { patente: { contains: q } },
        { vehiculo: { contains: q } },
        { modelo: { contains: q } },
        { numeroPoliza: { contains: q } },
        { empresa: { contains: q } },
        { seguro: { nombre: { contains: q } } },
        { conductorActual: { username: { contains: q } } },
        { conductorActual: { nombre: { contains: q } } },
      ];
    }

    const vehiculos = await prisma.vehiculo.findMany({
      where,
      include: {
        seguro: true,
        tipoMaquina: {
          select: { id: true, nombre: true },
        },
        conductorActual: {
          select: {
            id: true,
            username: true,
            nombre: true,
            rol: true,
            vtoCarnetConductor: true,
          },
        },
        historialAsignaciones: {
          where: { fechaHasta: null },
          take: 1,
          orderBy: { fechaDesde: "desc" },
          include: {
            usuario: {
              select: { id: true, username: true, nombre: true },
            },
          },
        },
        asignacionesPedido: {
          where: {
            pedido: { estado: { notIn: ["CERRADO", "CANCELADO"] } },
          },
          take: 1,
          orderBy: { id: "desc" },
          include: {
            pedido: {
              include: {
                supervisor: { select: { username: true, nombre: true } },
                historial: {
                  where: { accion: "DEVOLUCION_CONFIRMADA" },
                  orderBy: { fecha: "desc" },
                  take: 1,
                },
              },
            },
          },
        },
      },
      orderBy: [{ empresa: "asc" }, { vehiculo: "asc" }, { id: "asc" }],
    });

    // Buscar pedidos cerrados con devolucion confirmada que contengan faltantes
    const pedidosCerrados = await prisma.pedido.findMany({
      where: { estado: "CERRADO" },
      include: { historial: { orderBy: { fecha: "asc" } } },
    });

    // Mapear ID de recurso (maquina/vehiculo) -> lista de pedidos donde figura como faltante final
    const faltanteMap = {};
    for (const p of pedidosCerrados) {
      const finales = computeFaltantesFinalesFromHistorial(p.historial || []);
      if (!finales || finales.length === 0) continue;
      for (const id of finales) {
        const key = String(id);
        faltanteMap[key] = faltanteMap[key] || [];
        faltanteMap[key].push(p.id);
      }
    }

    const resultado = vehiculos.map((v) => {
      const mapped = mapVehiculo(v);
      const faltantesPedidos = faltanteMap[String(v.id)] || [];
      mapped.estado = canonicalEstadoVehiculo(mapped.estado);
      mapped.esFaltante = faltantesPedidos.length > 0;
      mapped.faltantePedidos = faltantesPedidos;
      return mapped;
    });

    res.json(resultado);
  } catch (e) {
    console.error("adminGetVehiculos:", e);
    res.status(500).json({ error: "Error listando vehículos" });
  }
}

export async function adminGetVehiculoById(req, res) {
  try {
    const vehiculo = await prisma.vehiculo.findUnique({
      where: { id: req.params.id },
      include: {
        seguro: true,
        tipoMaquina: {
          select: { id: true, nombre: true },
        },
        conductorActual: {
          select: {
            id: true,
            username: true,
            nombre: true,
            rol: true,
            vtoCarnetConductor: true,
          },
        },
        historialAsignaciones: {
          orderBy: { fechaDesde: "desc" },
          take: 1,
          include: {
            usuario: {
              select: { id: true, username: true, nombre: true },
            },
          },
        },
        asignacionesPedido: {
          where: {
            pedido: { estado: { notIn: ["CERRADO", "CANCELADO"] } },
          },
          take: 1,
          orderBy: { id: "desc" },
          include: { pedido: { include: { supervisor: { select: { username: true, nombre: true } }, historial: { orderBy: { fecha: "asc" } } } } },
        },
      },
    });

    if (!vehiculo) {
      return res.status(404).json({ error: "Vehículo no encontrado" });
    }

    res.json(mapVehiculo(vehiculo));
  } catch (e) {
    console.error("adminGetVehiculoById:", e);
    res.status(500).json({ error: "Error obteniendo vehículo" });
  }
}

export async function adminGetHistorialVehiculo(req, res) {
  try {
    const vehiculo = await prisma.vehiculo.findUnique({
      where: { id: req.params.id },
      include: {
        seguro: true,
        tipoMaquina: {
          select: { id: true, nombre: true },
        },
        conductorActual: {
          select: {
            id: true,
            username: true,
            nombre: true,
            rol: true,
            vtoCarnetConductor: true,
          },
        },
      },
    });

    if (!vehiculo) {
      return res.status(404).json({ error: "Vehículo no encontrado" });
    }

    const historial = await prisma.vehiculoAsignacion.findMany({
      where: { vehiculoId: vehiculo.id },
      orderBy: { fechaDesde: "desc" },
      include: {
        usuario: { select: { id: true, username: true, nombre: true } },
        asignadoPor: { select: { id: true, username: true, nombre: true } },
      },
    });

    res.json({
      vehiculo: mapVehiculo({ ...vehiculo, historialAsignaciones: [] }),
      historial: historial.map((item) => ({
        id: item.id,
        fechaDesde: item.fechaDesde,
        fechaHasta: item.fechaHasta,
        observacion: item.observacion,
        usuario: item.usuario,
        asignadoPor: item.asignadoPor,
      })),
    });
  } catch (e) {
    console.error("adminGetHistorialVehiculo:", e);
    res.status(500).json({ error: "Error obteniendo historial de vehículo" });
  }
}

export async function adminCreateVehiculo(req, res) {
  try {
    const id = normalizeString(req.body?.id);
    const estadoRaw = normalizeString(req.body?.estado);
    if (!id) {
      return res.status(400).json({ error: "El ID es obligatorio" });
    }
    if (!estadoRaw) {
      return res.status(400).json({ error: "El estado es obligatorio" });
    }

    const data = buildVehiculoData(req.body || {});
    const validationError = validateVehiculoData(data);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const [existeVehiculo, existePatente, seguro, conductorActual, tipoMaquinaVehiculo, tipoMaquinaSeleccionado] = await Promise.all([
      prisma.vehiculo.findUnique({ where: { id } }),
      prisma.vehiculo.findUnique({ where: { patente: data.patente } }),
      data.seguroId ? ensureSeguroExists(data.seguroId) : Promise.resolve(null),
      data.conductorActualId ? ensureUsuarioExists(data.conductorActualId) : Promise.resolve(null),
      ensureVehiculoTipoMaquina(),
      data.tipoMaquinaId ? ensureTipoMaquinaExists(data.tipoMaquinaId) : Promise.resolve(null),
    ]);

    if (existeVehiculo) {
      return res.status(409).json({ error: "Ya existe un vehículo con ese ID" });
    }

    if (existePatente) {
      return res.status(409).json({ error: "Ya existe un vehículo con esa patente" });
    }

    if (data.seguroId && !seguro) {
      return res.status(400).json({ error: "Seguro inválido" });
    }

    if (data.conductorActualId && !conductorActual) {
      return res.status(400).json({ error: "Conductor actual inválido" });
    }

    if (data.tipoMaquinaId && !tipoMaquinaSeleccionado) {
      return res.status(400).json({ error: "Tipo de máquina inválido" });
    }

    const tipoMaquinaIdFinal = tipoMaquinaSeleccionado?.id || tipoMaquinaVehiculo.id;

    const nuevo = await prisma.$transaction(async (tx) => {
      const creado = await tx.vehiculo.create({
        data: {
          id,
          ...data,
          motor: data.motor || "N/D",
          chasis: data.chasis || "N/D",
          tipoCobertura: data.tipoCobertura || "N/D",
          seguroId: seguro?.id ?? null,
          tipoMaquinaId: tipoMaquinaIdFinal,
        },
      });

      if (data.conductorActualId) {
        await tx.vehiculoAsignacion.create({
          data: {
            vehiculoId: creado.id,
            usuarioId: data.conductorActualId,
          },
        });
      }

      return tx.vehiculo.findUnique({
        where: { id: creado.id },
        include: {
          seguro: true,
          tipoMaquina: {
            select: { id: true, nombre: true },
          },
          conductorActual: {
            select: {
              id: true,
              username: true,
              nombre: true,
              rol: true,
              vtoCarnetConductor: true,
            },
          },
          historialAsignaciones: {
            where: { fechaHasta: null },
            include: { usuario: { select: { id: true, username: true, nombre: true } } },
          },
        },
      });
    });

    res.status(201).json(mapVehiculo(nuevo));
  } catch (e) {
    console.error("adminCreateVehiculo:", e);
    res.status(500).json({ error: "Error creando vehículo" });
  }
}

export async function adminUpdateVehiculo(req, res) {
  try {
    const vehiculo = await prisma.vehiculo.findUnique({ where: { id: req.params.id } });
    if (!vehiculo) {
      return res.status(404).json({ error: "Vehículo no encontrado" });
    }

    const data = buildVehiculoData(req.body || {}, vehiculo);
    const validationError = validateVehiculoData(data);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const patenteDuplicada = await prisma.vehiculo.findFirst({
      where: {
        patente: data.patente,
        id: { not: vehiculo.id },
      },
    });

    if (patenteDuplicada) {
      return res.status(409).json({ error: "Ya existe un vehículo con esa patente" });
    }

    const [seguro, tipoMaquinaSeleccionado] = await Promise.all([
      data.seguroId ? ensureSeguroExists(data.seguroId) : Promise.resolve(null),
      data.tipoMaquinaId ? ensureTipoMaquinaExists(data.tipoMaquinaId) : Promise.resolve(null),
    ]);

    if (data.seguroId && !seguro) {
      return res.status(400).json({ error: "Seguro inválido" });
    }

    if (data.tipoMaquinaId && !tipoMaquinaSeleccionado) {
      return res.status(400).json({ error: "Tipo de máquina inválido" });
    }

    if (data.conductorActualId) {
      const conductor = await ensureUsuarioExists(data.conductorActualId);
      if (!conductor) {
        return res.status(400).json({ error: "Conductor actual inválido" });
      }
    }

    const actualizado = await prisma.$transaction(async (tx) => {
      const tipoMaquinaVehiculo = await ensureVehiculoTipoMaquina(tx);
      const asignacionActiva = await tx.vehiculoAsignacion.findFirst({
        where: { vehiculoId: vehiculo.id, fechaHasta: null },
        orderBy: { fechaDesde: "desc" },
      });

      if (asignacionActiva && data.conductorActualId !== asignacionActiva.usuarioId) {
        await tx.vehiculoAsignacion.update({
          where: { id: asignacionActiva.id },
          data: { fechaHasta: new Date() },
        });
      }

      if (data.conductorActualId && data.conductorActualId !== asignacionActiva?.usuarioId) {
        await tx.vehiculoAsignacion.create({
          data: {
            vehiculoId: vehiculo.id,
            usuarioId: data.conductorActualId,
          },
        });
      }

      const tipoMaquinaIdFinal =
        tipoMaquinaSeleccionado?.id || data.tipoMaquinaId || vehiculo.tipoMaquinaId || tipoMaquinaVehiculo.id;

      await tx.vehiculo.update({
        where: { id: vehiculo.id },
        data: {
          ...data,
          tipoMaquinaId: tipoMaquinaIdFinal,
        },
      });

      return tx.vehiculo.findUnique({
        where: { id: vehiculo.id },
        include: {
          seguro: true,
          tipoMaquina: {
            select: { id: true, nombre: true },
          },
          conductorActual: {
            select: {
              id: true,
              username: true,
              nombre: true,
              rol: true,
              vtoCarnetConductor: true,
            },
          },
          historialAsignaciones: {
            where: { fechaHasta: null },
            include: { usuario: { select: { id: true, username: true, nombre: true } } },
          },
        },
      });
    });

    res.json(mapVehiculo(actualizado));
  } catch (e) {
    console.error("adminUpdateVehiculo:", e);
    res.status(500).json({ error: "Error actualizando vehículo" });
  }
}

export async function adminDeleteVehiculo(req, res) {
  try {
    const vehiculo = await prisma.vehiculo.findUnique({ where: { id: req.params.id } });
    if (!vehiculo) {
      return res.status(404).json({ error: "Vehículo no encontrado" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.vehiculoAsignacion.updateMany({
        where: { vehiculoId: vehiculo.id, fechaHasta: null },
        data: { fechaHasta: new Date() },
      });

      await tx.vehiculo.update({
        where: { id: vehiculo.id },
        data: { estado: "baja", conductorActualId: null },
      });
    });

    res.json({ message: "Vehículo dado de baja" });
  } catch (e) {
    console.error("adminDeleteVehiculo:", e);
    res.status(500).json({ error: "Error dando de baja vehículo" });
  }
}

export async function adminAsignarVehiculo(req, res) {
  try {
    const vehiculoId = req.params.id;
    const usuarioId = Number(req.body?.usuarioId);
    const asignadoPorId = req.body?.asignadoPorId ? Number(req.body.asignadoPorId) : null;
    const observacion = normalizeNullableString(req.body?.observacion);

    if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
      return res.status(400).json({ error: "usuarioId es obligatorio" });
    }

    const vehiculo = await prisma.vehiculo.findUnique({ where: { id: vehiculoId } });
    if (!vehiculo) {
      return res.status(404).json({ error: "Vehículo no encontrado" });
    }

    if (vehiculo.estado === "baja") {
      return res.status(409).json({ error: "No se puede asignar un vehículo dado de baja" });
    }

    const [usuario, asignacionActiva] = await Promise.all([
      ensureUsuarioExists(usuarioId),
      prisma.vehiculoAsignacion.findFirst({
        where: { vehiculoId, fechaHasta: null },
      }),
    ]);

    if (!usuario) {
      return res.status(400).json({ error: "Usuario inválido" });
    }

    if (asignacionActiva) {
      return res.status(409).json({ error: "El vehículo ya está asignado a otro usuario" });
    }

    if (asignadoPorId) {
      const asignadoPor = await ensureUsuarioExists(asignadoPorId);
      if (!asignadoPor) {
        return res.status(400).json({ error: "asignadoPorId inválido" });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.vehiculoAsignacion.create({
        data: {
          vehiculoId,
          usuarioId,
          asignadoPorId,
          observacion,
        },
      });

      await tx.vehiculo.update({
        where: { id: vehiculoId },
        data: { conductorActualId: usuarioId },
      });
    });

    const actualizado = await prisma.vehiculo.findUnique({
      where: { id: vehiculoId },
      include: {
        seguro: true,
        tipoMaquina: {
          select: { id: true, nombre: true },
        },
        conductorActual: {
          select: {
            id: true,
            username: true,
            nombre: true,
            rol: true,
            vtoCarnetConductor: true,
          },
        },
        historialAsignaciones: {
          where: { fechaHasta: null },
          include: { usuario: { select: { id: true, username: true, nombre: true } } },
        },
      },
    });

    res.json(mapVehiculo(actualizado));
  } catch (e) {
    console.error("adminAsignarVehiculo:", e);
    res.status(500).json({ error: "Error asignando vehículo" });
  }
}

export async function adminDesasignarVehiculo(req, res) {
  try {
    const vehiculoId = req.params.id;

    const vehiculo = await prisma.vehiculo.findUnique({ where: { id: vehiculoId } });
    if (!vehiculo) {
      return res.status(404).json({ error: "Vehículo no encontrado" });
    }

    const asignacionActiva = await prisma.vehiculoAsignacion.findFirst({
      where: { vehiculoId, fechaHasta: null },
      orderBy: { fechaDesde: "desc" },
    });

    if (!asignacionActiva) {
      return res.status(409).json({ error: "El vehículo no tiene asignación activa" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.vehiculoAsignacion.update({
        where: { id: asignacionActiva.id },
        data: {
          fechaHasta: new Date(),
          observacion: normalizeNullableString(req.body?.observacion) ?? asignacionActiva.observacion,
        },
      });

      await tx.vehiculo.update({
        where: { id: vehiculoId },
        data: { conductorActualId: null },
      });
    });

    res.json({ message: "Vehículo desasignado" });
  } catch (e) {
    console.error("adminDesasignarVehiculo:", e);
    res.status(500).json({ error: "Error desasignando vehículo" });
  }
}

/* ========================================================
   POST /admin/vehiculos/asignaciones-masivas
======================================================== */
export async function adminAsignarVehiculosMasivo(req, res) {
  try {
    const {
      vehiculoIds,
      usuarioId,
      observacion,
      asignadoPorId,
      dryRun = false,
      confirmarReasignacion = false,
    } = req.body || {};

    const ids = Array.isArray(vehiculoIds)
      ? [...new Set(vehiculoIds.map((v) => String(v || "").trim()).filter(Boolean))]
      : [];

    if (!ids.length) {
      return res.status(400).json({ error: "Debe seleccionar al menos un vehículo" });
    }

    const desasignar = usuarioId === null || usuarioId === undefined || usuarioId === "";

    let usuarioDestinoId = null;
    let usuarioDestino = null;

    if (!desasignar) {
      usuarioDestinoId = Number(usuarioId);
      if (!Number.isInteger(usuarioDestinoId) || usuarioDestinoId <= 0) {
        return res.status(400).json({ error: "usuarioId inválido" });
      }

      usuarioDestino = await ensureUsuarioExists(usuarioDestinoId);
      if (!usuarioDestino) {
        return res.status(400).json({ error: "Usuario destino inválido" });
      }
    }

    let asignadoPorIdParsed = null;
    if (asignadoPorId) {
      asignadoPorIdParsed = Number(asignadoPorId);
      const asignadoPor = await ensureUsuarioExists(asignadoPorIdParsed);
      if (!asignadoPor) {
        return res.status(400).json({ error: "asignadoPorId inválido" });
      }
    }

    const observacionNormalizada = normalizeNullableString(observacion);

    const vehiculos = await prisma.vehiculo.findMany({
      where: { id: { in: ids } },
      include: {
        conductorActual: { select: { id: true, username: true, nombre: true } },
      },
    });

    const vehiculosById = new Map(vehiculos.map((v) => [v.id, v]));
    const inexistentes = ids.filter((id) => !vehiculosById.has(id));

    if (inexistentes.length) {
      return res.status(400).json({
        error: "Hay vehículos inexistentes en la selección",
        inexistentes,
      });
    }

    const bajas = [];
    const sinCambios = [];
    const reasignaciones = [];
    const nuevas = [];

    for (const id of ids) {
      const vehiculo = vehiculosById.get(id);
      const conductorActualNombre = vehiculo.conductorActual?.nombre || vehiculo.conductorActual?.username || null;

      if (!desasignar && vehiculo.estado === "baja") {
        bajas.push({ id, vehiculo: vehiculo.vehiculo, patente: vehiculo.patente });
        continue;
      }

      const destinoId = desasignar ? null : usuarioDestinoId;
      const item = { id, vehiculo: vehiculo.vehiculo, patente: vehiculo.patente, conductorActual: conductorActualNombre };

      if (vehiculo.conductorActualId === destinoId) {
        sinCambios.push(item);
      } else if (vehiculo.conductorActualId) {
        reasignaciones.push(item);
      } else {
        nuevas.push(item);
      }
    }

    const paraAplicar = [...reasignaciones, ...nuevas].map((item) => item.id);

    const resumen = {
      seleccionados: ids.length,
      sinCambios: sinCambios.length,
      reasignaciones: reasignaciones.length,
      nuevas: nuevas.length,
      bajasExcluidas: bajas.length,
      aAplicar: paraAplicar.length,
    };

    const usuarioDestinoRes = usuarioDestino
      ? { id: usuarioDestino.id, nombre: usuarioDestino.nombre, username: usuarioDestino.username }
      : null;

    if (dryRun) {
      return res.json({
        dryRun: true,
        requiereConfirmacion: reasignaciones.length > 0,
        usuarioDestino: usuarioDestinoRes,
        resumen,
        sinCambios,
        reasignaciones,
        nuevas,
        bajas,
      });
    }

    if (reasignaciones.length > 0 && !confirmarReasignacion) {
      return res.status(409).json({
        error: "Algunos vehículos ya tienen otro conductor asignado. Confirmá para reasignarlos.",
        code: "REQUIERE_CONFIRMACION_REASIGNACION",
        requiereConfirmacion: true,
        usuarioDestino: usuarioDestinoRes,
        resumen,
        sinCambios,
        reasignaciones,
        nuevas,
        bajas,
      });
    }

    if (!paraAplicar.length) {
      return res.json({
        message: "No hay cambios para aplicar",
        esMasivo: true,
        usuarioDestino: usuarioDestinoRes,
        resumen,
        sinCambios,
        reasignaciones: [],
        nuevas: [],
        bajas,
      });
    }

    const ahora = new Date();

    await prisma.$transaction(async (tx) => {
      for (const vehiculoId of paraAplicar) {
        const activa = await tx.vehiculoAsignacion.findFirst({
          where: { vehiculoId, fechaHasta: null },
        });

        if (activa) {
          await tx.vehiculoAsignacion.update({
            where: { id: activa.id },
            data: { fechaHasta: ahora },
          });
        }

        if (!desasignar) {
          await tx.vehiculoAsignacion.create({
            data: {
              vehiculoId,
              usuarioId: usuarioDestinoId,
              asignadoPorId: asignadoPorIdParsed,
              observacion: observacionNormalizada,
              fechaDesde: ahora,
            },
          });
        }

        await tx.vehiculo.update({
          where: { id: vehiculoId },
          data: { conductorActualId: desasignar ? null : usuarioDestinoId },
        });
      }
    });

    return res.json({
      message: "Asignaciones aplicadas correctamente",
      esMasivo: true,
      usuarioDestino: usuarioDestinoRes,
      resumen,
      aplicadas: paraAplicar,
      sinCambios,
      bajas,
    });
  } catch (e) {
    console.error("adminAsignarVehiculosMasivo:", e);
    res.status(500).json({ error: "Error aplicando asignaciones masivas" });
  }
}

export async function adminExportVehiculos(req, res) {
  try {
    const vehiculos = await prisma.vehiculo.findMany({
      include: {
        seguro: true,
        conductorActual: {
          select: { username: true, nombre: true },
        },
      },
      orderBy: [{ empresa: "asc" }, { vehiculo: "asc" }, { id: "asc" }],
    });

    const headers = [
      "ID",
      "EMPRESA",
      "ESTADO",
      "VEHICULO",
      "PATENTE",
      "MODELO",
      "NUMERO_POLIZA",
      "MOTOR",
      "CHASIS",
      "TIPO_COBERTURA",
      "SEGURO",
      "VTO_SEGURO",
      "VTO_SEGURO_APLICA",
      "VTO_MATAFUEGO",
      "VTO_MATAFUEGO_APLICA",
      "VTO_ITV",
      "VTO_ITV_APLICA",
      "OBLEA_GNC",
      "OBLEA_GNC_APLICA",
      "PRUEBA_HIDRAULICA_GNC",
      "PRUEBA_HIDRAULICA_GNC_APLICA",
      "TARJETA_VERDE",
      "CONDUCTOR_USERNAME",
      "CONDUCTOR_NOMBRE",
    ];

    const rows = vehiculos.map((item) => [
      item.id,
      item.empresa,
      item.estado,
      item.vehiculo,
      item.patente,
      item.modelo,
      item.numeroPoliza || "",
      item.motor,
      item.chasis,
      item.tipoCobertura,
      item.seguro?.nombre || "",
      formatDateForSpreadsheet(item.vtoSeguro),
      item.vtoSeguroAplica ? "SI" : "NO",
      formatDateForSpreadsheet(item.vtoMatafuego),
      item.vtoMatafuegoAplica ? "SI" : "NO",
      formatDateForSpreadsheet(item.vtoItv),
      item.vtoItvAplica ? "SI" : "NO",
      formatDateForSpreadsheet(item.obleaGnc),
      item.obleaGncAplica ? "SI" : "NO",
      formatDateForSpreadsheet(item.pruebaHidraulicaGnc),
      item.pruebaHidraulicaGncAplica ? "SI" : "NO",
      item.tarjetaVerde ? "TIENE" : "NO TIENE",
      item.conductorActual?.username || "",
      item.conductorActual?.nombre || "",
    ]);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Vehiculos");
    worksheet.addRow(headers);
    rows.forEach((row) => worksheet.addRow(row));

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="vehiculos-${Date.now()}.xlsx"`
    );
    res.send(buffer);
  } catch (e) {
    console.error("adminExportVehiculos:", e);
    res.status(500).json({ error: "Error exportando vehículos" });
  }
}

export async function adminDownloadVehiculosTemplate(req, res) {
  try {
    const workbook = new ExcelJS.Workbook();
    const headers = [
      "ID",
      "EMPRESA",
      "ESTADO",
      "VEHICULO",
      "PATENTE",
      "MODELO",
      "NUMERO_POLIZA",
      "MOTOR",
      "CHASIS",
      "TIPO_COBERTURA",
      "SEGURO",
      "VTO_SEGURO",
      "VTO_SEGURO_APLICA",
      "VTO_MATAFUEGO",
      "VTO_MATAFUEGO_APLICA",
      "VTO_ITV",
      "VTO_ITV_APLICA",
      "OBLEA_GNC",
      "OBLEA_GNC_APLICA",
      "PRUEBA_HIDRAULICA_GNC",
      "PRUEBA_HIDRAULICA_GNC_APLICA",
      "TARJETA_VERDE",
      "CONDUCTOR_USERNAME",
    ];

    const worksheet = workbook.addWorksheet("Vehiculos");
    worksheet.addRow(headers);

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="plantilla_vehiculos.xlsx"'
    );
    res.send(buffer);
  } catch (e) {
    console.error("adminDownloadVehiculosTemplate:", e);
    res.status(500).json({ error: "Error generando plantilla de vehículos" });
  }
}

export async function adminImportVehiculos(req, res) {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ error: "Debe adjuntar un archivo Excel" });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return res.status(400).json({ error: "El archivo no contiene hojas" });
    }

    const headers = [];
    worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers[colNumber] = normalizeImportHeader(excelCellRawValue(cell.value));
    });

    const rows = [];
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      if (row.cellCount === 0) continue;

      const normalized = {};
      let hasValue = false;
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const header = headers[colNumber];
        if (!header) return;
        const value = excelCellRawValue(cell.value);
        if (value !== "" && value !== null && value !== undefined) hasValue = true;
        normalized[header] = value;
      });

      if (hasValue) rows.push(normalized);
    }

    if (rows.length === 0) {
      return res.status(400).json({ error: "El archivo no contiene filas para importar" });
    }

    // ID = clave principal. Fila con ID inexistente -> alta (columnas base
    // obligatorias). Fila con ID existente -> actualización parcial: una
    // celda vacía o una columna ausente del archivo significa "no tocar ese
    // dato", nunca "vaciarlo". Por eso cada campo se acompaña de su propio
    // flag *Provided calculado sobre el valor crudo, antes de normalizar.
    const preparedRows = rows.map((row, index) => {
      const idRaw = getImportValue(row, "ID", "COD");
      const patenteRaw = getImportValue(row, "PATENTE");
      const empresaRaw = getImportValue(row, "EMPRESA");
      const estadoRaw = getImportValue(row, "ESTADO");
      const vehiculoRaw = getImportValue(row, "VEHICULO");
      const modeloRaw = getImportValue(row, "MODELO");
      const numeroPolizaRaw = getImportValue(row, "NUMERO_POLIZA", "NRO_POLIZA", "POLIZA");
      const motorRaw = getImportValue(row, "MOTOR");
      const chasisRaw = getImportValue(row, "CHASIS");
      const tipoCoberturaRaw = getImportValue(row, "TIPO_COBERTURA", "TIPO_COBERTURA_SEGURO", "COBERTURA");
      const seguroRaw = getImportValue(row, "SEGURO");
      const conductorRaw = getImportValue(row, "CONDUCTOR_DESIGNADO", "CONDUCTOR", "CONDUCTOR_USERNAME");
      const tarjetaVerdeRaw = getImportValue(row, "TARJETA_VERDE");
      const vtoSeguroRaw = getImportValue(row, "VTO_SEGURO");
      const vtoSeguroAplicaRaw = getImportValue(row, "VTO_SEGURO_APLICA");
      const vtoMatafuegoRaw = getImportValue(row, "VTO_MATAFUEGO");
      const vtoMatafuegoAplicaRaw = getImportValue(row, "VTO_MATAFUEGO_APLICA");
      const vtoItvRaw = getImportValue(row, "VTO_ITV");
      const vtoItvAplicaRaw = getImportValue(row, "VTO_ITV_APLICA");
      const obleaGncRaw = getImportValue(row, "OBLEA_GNC");
      const obleaGncAplicaRaw = getImportValue(row, "OBLEA_GNC_APLICA");
      const pruebaHidraulicaGncRaw = getImportValue(row, "PRUEBA_HIDRAULICA_GNC");
      const pruebaHidraulicaGncAplicaRaw = getImportValue(row, "PRUEBA_HIDRAULICA_GNC_APLICA");

      return {
        rowNumber: index + 2,
        id: normalizeString(idRaw),
        patente: normalizeString(patenteRaw).toUpperCase(),
        patenteProvided: hasImportValue(patenteRaw),
        empresa: normalizeString(empresaRaw),
        empresaProvided: hasImportValue(empresaRaw),
        estadoRaw: normalizeString(estadoRaw),
        estado: normalizeEstadoVehiculo(estadoRaw),
        estadoProvided: hasImportValue(estadoRaw),
        vehiculo: normalizeString(vehiculoRaw),
        vehiculoProvided: hasImportValue(vehiculoRaw),
        modelo: normalizeString(modeloRaw),
        modeloProvided: hasImportValue(modeloRaw),
        numeroPoliza: normalizeString(numeroPolizaRaw),
        numeroPolizaProvided: hasImportValue(numeroPolizaRaw),
        motor: normalizeString(motorRaw),
        motorProvided: hasImportValue(motorRaw),
        chasis: normalizeString(chasisRaw),
        chasisProvided: hasImportValue(chasisRaw),
        tipoCobertura: normalizeString(tipoCoberturaRaw),
        tipoCoberturaProvided: hasImportValue(tipoCoberturaRaw),
        seguroNombre: normalizeString(seguroRaw),
        seguroProvided: hasImportValue(seguroRaw),
        conductorUsername: normalizeString(conductorRaw),
        conductorProvided: hasImportValue(conductorRaw),
        tarjetaVerde: normalizeBoolean(tarjetaVerdeRaw, false),
        tarjetaVerdeProvided: hasImportValue(tarjetaVerdeRaw),
        vtoSeguro: parseExcelDate(vtoSeguroRaw),
        vtoSeguroProvided: hasImportValue(vtoSeguroRaw),
        vtoSeguroAplica: normalizeBoolean(vtoSeguroAplicaRaw, true),
        vtoSeguroAplicaProvided: hasImportValue(vtoSeguroAplicaRaw),
        vtoMatafuego: parseExcelDate(vtoMatafuegoRaw),
        vtoMatafuegoProvided: hasImportValue(vtoMatafuegoRaw),
        vtoMatafuegoAplica: normalizeBoolean(vtoMatafuegoAplicaRaw, true),
        vtoMatafuegoAplicaProvided: hasImportValue(vtoMatafuegoAplicaRaw),
        vtoItv: parseExcelDate(vtoItvRaw),
        vtoItvProvided: hasImportValue(vtoItvRaw),
        vtoItvAplica: normalizeBoolean(vtoItvAplicaRaw, true),
        vtoItvAplicaProvided: hasImportValue(vtoItvAplicaRaw),
        obleaGnc: parseExcelDate(obleaGncRaw),
        obleaGncProvided: hasImportValue(obleaGncRaw),
        obleaGncAplica: normalizeBoolean(obleaGncAplicaRaw, true),
        obleaGncAplicaProvided: hasImportValue(obleaGncAplicaRaw),
        pruebaHidraulicaGnc: parseExcelDate(pruebaHidraulicaGncRaw),
        pruebaHidraulicaGncProvided: hasImportValue(pruebaHidraulicaGncRaw),
        pruebaHidraulicaGncAplica: normalizeBoolean(pruebaHidraulicaGncAplicaRaw, true),
        pruebaHidraulicaGncAplicaProvided: hasImportValue(pruebaHidraulicaGncAplicaRaw),
      };
    });

    // Duplicados dentro del propio archivo (no depende de qué haya en la base).
    const erroresArchivo = [];
    const idsSeen = new Set();
    const patentesSeen = new Set();

    for (const item of preparedRows) {
      if (!item.id) erroresArchivo.push(`Fila ${item.rowNumber}: ID obligatorio`);

      if (item.id) {
        if (idsSeen.has(item.id)) erroresArchivo.push(`ID duplicado en archivo: ${item.id}`);
        idsSeen.add(item.id);
      }

      if (item.patenteProvided) {
        if (patentesSeen.has(item.patente)) erroresArchivo.push(`PATENTE duplicada en archivo: ${item.patente}`);
        patentesSeen.add(item.patente);
      }
    }

    if (erroresArchivo.length > 0) {
      return res.status(400).json({ error: "El archivo tiene errores de validación", detalles: erroresArchivo });
    }

    const [existentes, seguros, usuarios, tipoMaquinaVehiculo] = await Promise.all([
      prisma.vehiculo.findMany({
        where: {
          OR: [
            { id: { in: preparedRows.map((item) => item.id) } },
            { patente: { in: preparedRows.filter((item) => item.patenteProvided).map((item) => item.patente) } },
          ],
        },
        select: { id: true, patente: true, conductorActualId: true },
      }),
      prisma.seguro.findMany({
        where: {
          nombre: { in: preparedRows.map((item) => item.seguroNombre).filter(Boolean) },
        },
      }),
      prisma.usuario.findMany({
        where: {
          username: { in: preparedRows.map((item) => item.conductorUsername).filter(Boolean) },
        },
        select: { id: true, username: true },
      }),
      ensureVehiculoTipoMaquina(),
    ]);

    const existingById = new Map(existentes.map((item) => [item.id, item]));
    const existingByPatente = new Map(existentes.map((item) => [item.patente, item]));
    const segurosMap = new Map(seguros.map((item) => [item.nombre.toUpperCase(), item]));
    const usuariosMap = new Map(usuarios.map((item) => [item.username.toUpperCase(), item]));

    const errores = [];
    for (const item of preparedRows) {
      const existente = existingById.get(item.id) || null;
      item.isUpdate = Boolean(existente);
      item.existente = existente;

      if (!item.isUpdate) {
        if (!item.empresa) errores.push(`Fila ${item.rowNumber}: EMPRESA obligatoria para dar de alta un vehículo nuevo`);
        if (!item.estadoRaw) errores.push(`Fila ${item.rowNumber}: ESTADO obligatorio para dar de alta un vehículo nuevo`);
        if (!item.vehiculo) errores.push(`Fila ${item.rowNumber}: VEHICULO obligatorio para dar de alta un vehículo nuevo`);
        if (!item.patente) errores.push(`Fila ${item.rowNumber}: PATENTE obligatoria para dar de alta un vehículo nuevo`);
        if (!item.modelo) errores.push(`Fila ${item.rowNumber}: MODELO obligatorio para dar de alta un vehículo nuevo`);
      }

      if (item.patenteProvided) {
        const colision = existingByPatente.get(item.patente);
        if (colision && colision.id !== item.id) {
          errores.push(`Fila ${item.rowNumber}: la patente ${item.patente} ya pertenece al vehículo ${colision.id}`);
        }
      }

      if (item.seguroNombre && !segurosMap.has(item.seguroNombre.toUpperCase())) errores.push(`Seguro inexistente para ${item.id}: ${item.seguroNombre}`);
      if (item.conductorUsername && !usuariosMap.has(item.conductorUsername.toUpperCase())) {
        errores.push(`Usuario conductor inexistente para ${item.id}: ${item.conductorUsername}`);
      }
    }

    if (errores.length > 0) {
      return res.status(409).json({ error: "La importación fue rechazada", detalles: errores });
    }

    let creados = 0;
    let actualizados = 0;

    await prisma.$transaction(async (tx) => {
      for (const item of preparedRows) {
        const seguro = item.seguroNombre ? segurosMap.get(item.seguroNombre.toUpperCase()) : null;
        const conductor = item.conductorUsername ? usuariosMap.get(item.conductorUsername.toUpperCase()) : null;

        if (!item.isUpdate) {
          await tx.vehiculo.create({
            data: {
              id: item.id,
              tipoMaquinaId: tipoMaquinaVehiculo.id,
              empresa: item.empresa,
              estado: item.estado || "activo",
              vehiculo: item.vehiculo,
              patente: item.patente,
              modelo: item.modelo,
              numeroPoliza: item.numeroPoliza || null,
              motor: item.motor || "N/D",
              chasis: item.chasis || "N/D",
              tipoCobertura: item.tipoCobertura || "N/D",
              seguroId: seguro?.id ?? null,
              conductorActualId: conductor?.id || null,
              tarjetaVerde: item.tarjetaVerde,
              vtoSeguro: item.vtoSeguroAplica ? item.vtoSeguro : null,
              vtoSeguroAplica: item.vtoSeguroAplica,
              vtoMatafuego: item.vtoMatafuegoAplica ? item.vtoMatafuego : null,
              vtoMatafuegoAplica: item.vtoMatafuegoAplica,
              vtoItv: item.vtoItvAplica ? item.vtoItv : null,
              vtoItvAplica: item.vtoItvAplica,
              obleaGnc: item.obleaGncAplica ? item.obleaGnc : null,
              obleaGncAplica: item.obleaGncAplica,
              pruebaHidraulicaGnc: item.pruebaHidraulicaGncAplica ? item.pruebaHidraulicaGnc : null,
              pruebaHidraulicaGncAplica: item.pruebaHidraulicaGncAplica,
            },
          });

          if (conductor) {
            await tx.vehiculoAsignacion.create({
              data: {
                vehiculoId: item.id,
                usuarioId: conductor.id,
                observacion: "Importación inicial",
              },
            });
          }

          creados += 1;
          continue;
        }

        // Actualización parcial: solo entran a `data` los campos con celda
        // informada. Lo que no vino en el archivo queda intacto.
        const data = {};
        if (item.empresaProvided) data.empresa = item.empresa;
        if (item.estadoProvided) data.estado = item.estado;
        if (item.vehiculoProvided) data.vehiculo = item.vehiculo;
        if (item.patenteProvided) data.patente = item.patente;
        if (item.modeloProvided) data.modelo = item.modelo;
        if (item.numeroPolizaProvided) data.numeroPoliza = item.numeroPoliza || null;
        if (item.motorProvided) data.motor = item.motor;
        if (item.chasisProvided) data.chasis = item.chasis;
        if (item.tipoCoberturaProvided) data.tipoCobertura = item.tipoCobertura;
        if (item.tarjetaVerdeProvided) data.tarjetaVerde = item.tarjetaVerde;
        if (item.seguroProvided) data.seguroId = seguro?.id ?? null;

        applyFechaAplicaUpdate(data, "vtoSeguroAplica", "vtoSeguro", item.vtoSeguroAplicaProvided, item.vtoSeguroAplica, item.vtoSeguroProvided, item.vtoSeguro);
        applyFechaAplicaUpdate(data, "vtoMatafuegoAplica", "vtoMatafuego", item.vtoMatafuegoAplicaProvided, item.vtoMatafuegoAplica, item.vtoMatafuegoProvided, item.vtoMatafuego);
        applyFechaAplicaUpdate(data, "vtoItvAplica", "vtoItv", item.vtoItvAplicaProvided, item.vtoItvAplica, item.vtoItvProvided, item.vtoItv);
        applyFechaAplicaUpdate(data, "obleaGncAplica", "obleaGnc", item.obleaGncAplicaProvided, item.obleaGncAplica, item.obleaGncProvided, item.obleaGnc);
        applyFechaAplicaUpdate(data, "pruebaHidraulicaGncAplica", "pruebaHidraulicaGnc", item.pruebaHidraulicaGncAplicaProvided, item.pruebaHidraulicaGncAplica, item.pruebaHidraulicaGncProvided, item.pruebaHidraulicaGnc);

        // Conductor: solo se toca si vino informado y es distinto al actual.
        // Reasignar cierra la asignación abierta y abre una nueva, igual que
        // hacerlo a mano en dos pasos (desasignar + asignar).
        if (item.conductorProvided && conductor && conductor.id !== item.existente.conductorActualId) {
          await tx.vehiculoAsignacion.updateMany({
            where: { vehiculoId: item.id, fechaHasta: null },
            data: { fechaHasta: new Date() },
          });
          await tx.vehiculoAsignacion.create({
            data: {
              vehiculoId: item.id,
              usuarioId: conductor.id,
              observacion: "Reasignado por importación",
            },
          });
          data.conductorActualId = conductor.id;
        }

        await tx.vehiculo.update({ where: { id: item.id }, data });
        actualizados += 1;
      }
    });

    res.status(200).json({
      message: "Vehículos importados correctamente",
      total: preparedRows.length,
      creados,
      actualizados,
    });
  } catch (e) {
    console.error("adminImportVehiculos:", e);
    res.status(500).json({ error: "Error importando vehículos" });
  }
}
