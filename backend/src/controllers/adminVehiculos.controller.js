import prisma from "../db/prisma.js";
import xlsx from "xlsx";

const ESTADOS_VEHICULO_VALIDOS = ["activo", "baja"];

function normalizeString(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeNullableString(value) {
  const normalized = normalizeString(value);
  return normalized === "" ? null : normalized;
}

function normalizeEstadoVehiculo(value) {
  const normalized = normalizeString(value).toLowerCase();
  return ESTADOS_VEHICULO_VALIDOS.includes(normalized) ? normalized : "activo";
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

function parseExcelDate(value) {
  if (value === undefined || value === null || value === "") return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "number") {
    const parsed = xlsx.SSF.parse_date_code(value);
    if (!parsed) return null;
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }

  return parseNullableDate(value);
}

function mapVehiculo(vehiculo) {
  const asignacionActual = (vehiculo.historialAsignaciones || []).find((item) => !item.fechaHasta) || null;

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
  };
}

async function ensureSeguroExists(seguroId) {
  const seguro = await prisma.seguro.findUnique({ where: { id: seguroId } });
  return seguro;
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
    empresa: normalizeString(body.empresa),
    estado: normalizeEstadoVehiculo(body.estado ?? currentVehiculo?.estado),
    vehiculo: normalizeString(body.vehiculo),
    patente: normalizeString(body.patente).toUpperCase(),
    modelo: normalizeString(body.modelo),
    numeroPoliza: normalizeNullableString(body.numeroPoliza),
    motor: normalizeString(body.motor),
    chasis: normalizeString(body.chasis),
    tipoCobertura: normalizeString(body.tipoCobertura),
    seguroId: Number(body.seguroId),
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
    ["vehiculo", data.vehiculo],
    ["patente", data.patente],
    ["modelo", data.modelo],
    ["motor", data.motor],
    ["chasis", data.chasis],
    ["tipoCobertura", data.tipoCobertura],
  ];

  const missing = requiredFields.filter(([, value]) => !value).map(([key]) => key);
  if (missing.length > 0) {
    return `Campos obligatorios faltantes: ${missing.join(", ")}`;
  }

  if (!Number.isInteger(data.seguroId) || data.seguroId <= 0) {
    return "seguroId es obligatorio";
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
      },
      orderBy: [{ empresa: "asc" }, { vehiculo: "asc" }, { id: "asc" }],
    });

    res.json(vehiculos.map(mapVehiculo));
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
    if (!id) {
      return res.status(400).json({ error: "El ID es obligatorio" });
    }

    const data = buildVehiculoData(req.body || {});
    const validationError = validateVehiculoData(data);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const [existeVehiculo, existePatente, seguro, conductorActual] = await Promise.all([
      prisma.vehiculo.findUnique({ where: { id } }),
      prisma.vehiculo.findUnique({ where: { patente: data.patente } }),
      ensureSeguroExists(data.seguroId),
      data.conductorActualId ? ensureUsuarioExists(data.conductorActualId) : Promise.resolve(null),
    ]);

    if (existeVehiculo) {
      return res.status(409).json({ error: "Ya existe un vehículo con ese ID" });
    }

    if (existePatente) {
      return res.status(409).json({ error: "Ya existe un vehículo con esa patente" });
    }

    if (!seguro) {
      return res.status(400).json({ error: "Seguro inválido" });
    }

    if (data.conductorActualId && !conductorActual) {
      return res.status(400).json({ error: "Conductor actual inválido" });
    }

    const nuevo = await prisma.$transaction(async (tx) => {
      const creado = await tx.vehiculo.create({
        data: {
          id,
          ...data,
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

    const seguro = await ensureSeguroExists(data.seguroId);
    if (!seguro) {
      return res.status(400).json({ error: "Seguro inválido" });
    }

    if (data.conductorActualId) {
      const conductor = await ensureUsuarioExists(data.conductorActualId);
      if (!conductor) {
        return res.status(400).json({ error: "Conductor actual inválido" });
      }
    }

    const actualizado = await prisma.$transaction(async (tx) => {
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

      await tx.vehiculo.update({
        where: { id: vehiculo.id },
        data,
      });

      return tx.vehiculo.findUnique({
        where: { id: vehiculo.id },
        include: {
          seguro: true,
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

    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.aoa_to_sheet([headers, ...rows]);
    xlsx.utils.book_append_sheet(workbook, worksheet, "Vehiculos");

    const buffer = xlsx.write(workbook, { bookType: "xlsx", type: "buffer" });

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
    const workbook = xlsx.utils.book_new();
    const headers = [[
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
    ]];

    const worksheet = xlsx.utils.aoa_to_sheet(headers);
    xlsx.utils.book_append_sheet(workbook, worksheet, "Vehiculos");

    const buffer = xlsx.write(workbook, { bookType: "xlsx", type: "buffer" });

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

    const workbook = xlsx.read(req.file.buffer, { type: "buffer", cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return res.status(400).json({ error: "El archivo no contiene hojas" });
    }

    const sheet = workbook.Sheets[firstSheetName];
    const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: "" });
    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      return res.status(400).json({ error: "El archivo no contiene filas para importar" });
    }

    const rows = rawRows.map((rawRow) => {
      const normalized = {};
      Object.entries(rawRow).forEach(([key, value]) => {
        normalized[normalizeImportHeader(key)] = value;
      });
      return normalized;
    });

    const preparedRows = rows.map((row, index) => {
      const id = normalizeString(getImportValue(row, "ID", "COD"));
      const patente = normalizeString(getImportValue(row, "PATENTE")).toUpperCase();
      const seguroNombre = normalizeString(getImportValue(row, "SEGURO"));
      const conductorUsername = normalizeString(getImportValue(row, "CONDUCTOR_DESIGNADO", "CONDUCTOR", "CONDUCTOR_USERNAME"));

      return {
        rowNumber: index + 2,
        id,
        patente,
        empresa: normalizeString(getImportValue(row, "EMPRESA")),
        estado: normalizeEstadoVehiculo(getImportValue(row, "ESTADO")),
        vehiculo: normalizeString(getImportValue(row, "VEHICULO")),
        modelo: normalizeString(getImportValue(row, "MODELO")),
        numeroPoliza: normalizeString(getImportValue(row, "NUMERO_POLIZA", "NRO_POLIZA", "POLIZA")),
        motor: normalizeString(getImportValue(row, "MOTOR")),
        chasis: normalizeString(getImportValue(row, "CHASIS")),
        tipoCobertura: normalizeString(getImportValue(row, "TIPO_COBERTURA", "TIPO_COBERTURA_SEGURO", "COBERTURA")),
        seguroNombre,
        conductorUsername,
        tarjetaVerde: normalizeBoolean(getImportValue(row, "TARJETA_VERDE"), false),
        vtoSeguro: parseExcelDate(getImportValue(row, "VTO_SEGURO")),
        vtoSeguroAplica: !normalizeBoolean(getImportValue(row, "VTO_SEGURO_APLICA"), false) ? getImportValue(row, "VTO_SEGURO_APLICA") === "" ? true : normalizeBoolean(getImportValue(row, "VTO_SEGURO_APLICA"), true) : true,
        vtoMatafuego: parseExcelDate(getImportValue(row, "VTO_MATAFUEGO")),
        vtoMatafuegoAplica: getImportValue(row, "VTO_MATAFUEGO_APLICA") === "" ? true : normalizeBoolean(getImportValue(row, "VTO_MATAFUEGO_APLICA"), true),
        vtoItv: parseExcelDate(getImportValue(row, "VTO_ITV")),
        vtoItvAplica: getImportValue(row, "VTO_ITV_APLICA") === "" ? true : normalizeBoolean(getImportValue(row, "VTO_ITV_APLICA"), true),
        obleaGnc: parseExcelDate(getImportValue(row, "OBLEA_GNC")),
        obleaGncAplica: getImportValue(row, "OBLEA_GNC_APLICA") === "" ? true : normalizeBoolean(getImportValue(row, "OBLEA_GNC_APLICA"), true),
        pruebaHidraulicaGnc: parseExcelDate(getImportValue(row, "PRUEBA_HIDRAULICA_GNC")),
        pruebaHidraulicaGncAplica: getImportValue(row, "PRUEBA_HIDRAULICA_GNC_APLICA") === "" ? true : normalizeBoolean(getImportValue(row, "PRUEBA_HIDRAULICA_GNC_APLICA"), true),
      };
    });

    const idsDuplicadosArchivo = new Set();
    const patentesDuplicadasArchivo = new Set();
    const idsSeen = new Set();
    const patentesSeen = new Set();

    for (const item of preparedRows) {
      if (!item.id) idsDuplicadosArchivo.add(`Fila ${item.rowNumber}: ID obligatorio`);
      if (!item.patente) patentesDuplicadasArchivo.add(`Fila ${item.rowNumber}: PATENTE obligatoria`);
      if (!item.seguroNombre) idsDuplicadosArchivo.add(`Fila ${item.rowNumber}: SEGURO obligatorio`);

      if (item.id) {
        if (idsSeen.has(item.id)) idsDuplicadosArchivo.add(`ID duplicado en archivo: ${item.id}`);
        idsSeen.add(item.id);
      }

      if (item.patente) {
        if (patentesSeen.has(item.patente)) patentesDuplicadasArchivo.add(`PATENTE duplicada en archivo: ${item.patente}`);
        patentesSeen.add(item.patente);
      }
    }

    const erroresArchivo = [...idsDuplicadosArchivo, ...patentesDuplicadasArchivo];
    if (erroresArchivo.length > 0) {
      return res.status(400).json({ error: "El archivo tiene errores de validación", detalles: erroresArchivo });
    }

    const [existentes, seguros, usuarios] = await Promise.all([
      prisma.vehiculo.findMany({
        where: {
          OR: [
            { id: { in: preparedRows.map((item) => item.id) } },
            { patente: { in: preparedRows.map((item) => item.patente) } },
          ],
        },
        select: { id: true, patente: true },
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
    ]);

    const errores = [];
    const idsExistentes = new Set(existentes.map((item) => item.id));
    const patentesExistentes = new Set(existentes.map((item) => item.patente));
    const segurosMap = new Map(seguros.map((item) => [item.nombre.toUpperCase(), item]));
    const usuariosMap = new Map(usuarios.map((item) => [item.username.toUpperCase(), item]));

    for (const item of preparedRows) {
      if (idsExistentes.has(item.id)) errores.push(`Ya existe un vehículo con ID ${item.id}`);
      if (patentesExistentes.has(item.patente)) errores.push(`Ya existe un vehículo con patente ${item.patente}`);
      if (!segurosMap.has(item.seguroNombre.toUpperCase())) errores.push(`Seguro inexistente para ${item.id}: ${item.seguroNombre}`);
      if (item.conductorUsername && !usuariosMap.has(item.conductorUsername.toUpperCase())) {
        errores.push(`Usuario conductor inexistente para ${item.id}: ${item.conductorUsername}`);
      }
    }

    if (errores.length > 0) {
      return res.status(409).json({ error: "La importación fue rechazada", detalles: errores });
    }

    await prisma.$transaction(async (tx) => {
      for (const item of preparedRows) {
        const seguro = segurosMap.get(item.seguroNombre.toUpperCase());
        const conductor = item.conductorUsername ? usuariosMap.get(item.conductorUsername.toUpperCase()) : null;

        await tx.vehiculo.create({
          data: {
            id: item.id,
            empresa: item.empresa,
            estado: item.estado || "activo",
            vehiculo: item.vehiculo,
            patente: item.patente,
            modelo: item.modelo,
            numeroPoliza: item.numeroPoliza || null,
            motor: item.motor,
            chasis: item.chasis,
            tipoCobertura: item.tipoCobertura,
            seguroId: seguro.id,
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
      }
    });

    res.status(201).json({ message: "Vehículos importados correctamente", total: preparedRows.length });
  } catch (e) {
    console.error("adminImportVehiculos:", e);
    res.status(500).json({ error: "Error importando vehículos" });
  }
}
