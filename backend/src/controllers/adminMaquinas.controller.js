import prisma from "../db/prisma.js";
import xlsx from "xlsx";
import ExcelJS from "exceljs";
import { requireActor } from "../services/requestActor.service.js";
import {
  ESTADOS_MAQUINA_VALIDOS,
  canonicalEstadoMaquina,
  normalizeEstadoMaquina,
} from "../services/inventarioEstados.service.js";
import {
  buildReferenciaKey,
  deleteReferenciaFromS3,
  getReferenciaSignedUrl,
  uploadReferenciaToS3,
} from "../services/s3Referencias.service.js";

/* ========================================================
   CONSTANTES
======================================================== */
const ESTADO_PEDIDO_CERRADO = "CERRADO";

const EMPRESAS_VALIDAS = ["Pulizia", "Pazar"];

const ESTADO_AMORTIZACION = {
  AMORTIZADA: "AMORTIZADA",
  NO_AMORTIZADA: "NO_AMORTIZADA",
  SIN_DATOS: "SIN_DATOS",
};

const ESTADOS_AMORTIZACION_VALIDOS = new Set(Object.values(ESTADO_AMORTIZACION));

/* ========================================================
   NORMALIZAR ESTADO DE MÁQUINA
   (FUENTE ÚNICA DE VERDAD)
======================================================== */
function normalizeEstado(raw) {
  return normalizeEstadoMaquina(raw);
}

function normalizeEmpresa(raw) {
  if (raw === undefined || raw === null) return null;

  const value = String(raw).trim();
  if (!value) return null;

  const match = EMPRESAS_VALIDAS.find(
    (empresa) => empresa.toLowerCase() === value.toLowerCase()
  );

  if (!match) {
    throw new Error(`Empresa inválida. Debe ser una de: ${EMPRESAS_VALIDAS.join(", ")}`);
  }

  return match;
}

function parseNullableInt(raw, fieldName) {
  if (raw === undefined || raw === null || String(raw).trim() === "") return null;

  const value = Number(raw);
  if (!Number.isInteger(value)) {
    throw new Error(`${fieldName} debe ser un entero`);
  }

  return value;
}

function parseNullableNonNegativeFloat(raw, fieldName) {
  if (raw === undefined || raw === null || String(raw).trim() === "") return null;

  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`${fieldName} debe ser numérico`);
  }

  if (value < 0) {
    throw new Error(`${fieldName} no puede ser negativo`);
  }

  return Math.round(value * 100) / 100;
}

function parseNullableDate(raw, fieldName) {
  if (!raw) return null;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} inválida`);
  }

  return date;
}

function parseExcelDate(raw) {
  if (raw === undefined || raw === null || raw === "") return null;

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw;
  }

  if (typeof raw === "number") {
    const parsed = xlsx.SSF.parse_date_code(raw);
    if (!parsed) return null;
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }

  const value = String(raw).trim();
  const ddmmyyyy = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (
      date.getFullYear() === Number(year) &&
      date.getMonth() === Number(month) - 1 &&
      date.getDate() === Number(day)
    ) {
      return date;
    }
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function parseNullableImportDate(raw, fieldName) {
  if (raw === undefined || raw === null || String(raw).trim() === "") return null;
  const date = parseExcelDate(raw);
  if (!date) {
    throw new Error(`${fieldName} inválida`);
  }
  return date;
}

function calcularAntiguedad(anio) {
  if (anio === null || anio === undefined) return null;
  const actual = new Date().getFullYear();
  return Math.max(actual - anio, 0);
}

function parseNullableString(raw) {
  if (raw === undefined || raw === null) return null;
  const value = String(raw).trim();
  return value === "" ? null : value;
}

function normalizeTipoMaquina(raw) {
  return String(raw || "").trim().toUpperCase();
}

function normalizeDescripcionReferencia(raw) {
  return String(raw || "").trim();
}

function isReferenciaMimeValido(mimeType) {
  return ["image/jpeg", "image/png", "image/webp"].includes(String(mimeType || "").toLowerCase());
}

function parseTipoMaquinaIdParam(raw) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function serializeReferenciaTipoMaquina(referencia) {
  return {
    id: referencia.id,
    tipoMaquinaId: referencia.tipoMaquinaId,
    descripcion: referencia.descripcion,
    originalName: referencia.originalName,
    mimeType: referencia.mimeType,
    s3Key: referencia.s3Key,
    createdAt: referencia.createdAt,
    updatedAt: referencia.updatedAt,
    imageUrl: await getReferenciaSignedUrl(referencia.s3Key),
  };
}

async function loadTipoMaquinaOr404(tipoId) {
  const tipo = await prisma.tipoMaquina.findUnique({
    where: { id: tipoId },
    select: { id: true, nombre: true },
  });

  if (!tipo) {
    return null;
  }

  return tipo;
}

function normalizeImportHeader(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\*]/g, "")
    .replace(/[.]/g, "")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .trim();
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

function parseEstadoObligatorio(raw) {
  const value = String(raw || "").trim();
  if (!value) {
    throw new Error("Estado obligatorio");
  }

  const estadoNorm = normalizeEstadoMaquina(value, null);
  if (!estadoNorm || !ESTADOS_MAQUINA_VALIDOS.includes(estadoNorm)) {
    throw new Error(
      `Estado inválido. Debe ser uno de: ${ESTADOS_MAQUINA_VALIDOS.join(", ")}`
    );
  }

  return estadoNorm;
}

function toEstadoAmortizacionLabel(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === ESTADO_AMORTIZACION.AMORTIZADA) return "Amortizada";
  if (normalized === ESTADO_AMORTIZACION.NO_AMORTIZADA) return "No amortizada";
  return "Sin datos";
}

function normalizeEstadoAmortizacionFilter(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";

  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .toUpperCase();

  if (normalized === "AMORTIZADA") return ESTADO_AMORTIZACION.AMORTIZADA;
  if (normalized === "NO_AMORTIZADA") return ESTADO_AMORTIZACION.NO_AMORTIZADA;
  if (normalized === "SIN_DATOS") return ESTADO_AMORTIZACION.SIN_DATOS;
  return "";
}

function getYearMonthFromDateOnly(rawDate) {
  if (!rawDate) return null;

  if (typeof rawDate === "string") {
    const match = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return {
        year: Number(match[1]),
        month: Number(match[2]),
      };
    }
  }

  const date = rawDate instanceof Date ? rawDate : new Date(rawDate);
  if (Number.isNaN(date.getTime())) return null;

  // Fecha de compra es semánticamente "fecha sin hora".
  // Usar UTC evita corrimientos de día/mes por zona horaria.
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
  };
}

function getCurrentYearMonthInArgentina(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);

  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);

  if (!Number.isInteger(year) || !Number.isInteger(month)) return null;
  return { year, month };
}

function calculateEstadoAmortizacion(fechaCompra, amortizacionMeses, now = new Date()) {
  if (!fechaCompra || !Number.isInteger(amortizacionMeses) || amortizacionMeses <= 0) {
    return ESTADO_AMORTIZACION.SIN_DATOS;
  }

  const compra = getYearMonthFromDateOnly(fechaCompra);
  const actual = getCurrentYearMonthInArgentina(now);
  if (!compra || !actual) return ESTADO_AMORTIZACION.SIN_DATOS;

  const mesesTranscurridos = (actual.year - compra.year) * 12 + (actual.month - compra.month);
  return mesesTranscurridos >= amortizacionMeses
    ? ESTADO_AMORTIZACION.AMORTIZADA
    : ESTADO_AMORTIZACION.NO_AMORTIZADA;
}

function readWorkbookRows(buffer) {
  const workbook = xlsx.read(buffer, { type: "buffer", cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("El archivo no contiene hojas");
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    throw new Error("El archivo no contiene filas para importar");
  }

  if (rawRows.length > 5000) {
    throw new Error("El archivo supera el máximo permitido de 5000 filas");
  }

  return rawRows.map((rawRow) => {
    const normalized = {};
    Object.entries(rawRow).forEach(([key, value]) => {
      normalized[normalizeImportHeader(key)] = value;
    });
    return normalized;
  });
}

async function parseAndValidateMaquinasImport(fileBuffer) {
  const rows = readWorkbookRows(fileBuffer);

  const parsedRows = rows.map((row, index) => ({
    rowNumber: index + 2,
    id: String(getImportValue(row, "CODIGO", "COD", "ID") || "").trim(),
    tipo: String(getImportValue(row, "TIPO") || "").trim(),
    modelo: String(getImportValue(row, "MODELO") || "").trim(),
    serie: getImportValue(row, "SERIE"),
    estado: getImportValue(row, "ESTADO"),
    servicioOriginal: String(
      getImportValue(row, "SERVICIO_ORIGINAL", "SERVICIO") || ""
    ).trim(),
    fechaCompra: getImportValue(row, "FECHA_COMPRA", "FECHA_COMPRA"),
    proveedorFactura: getImportValue(
      row,
      "PROVEEDOR_N_FACTURA",
      "PROVEEDOR_FACTURA",
      "PROVEEDOR"
    ),
    empresa: getImportValue(row, "EMPRESA"),
    anio: getImportValue(row, "ANIO", "AÑO"),
    amortizacion: getImportValue(row, "AMORTIZACION", "AMORTIZACIÓN"),
    valorUsadaDolares: getImportValue(row, "VALOR_USADA_USD"),
    valorUsadaPesos: getImportValue(row, "VALOR_USADA_ARS"),
    valorNuevaDolares: getImportValue(row, "VALOR_NUEVA_USD"),
    valorNuevaPesos: getImportValue(row, "VALOR_NUEVA_ARS"),
    origenInfo: getImportValue(row, "ORIGEN_INFO"),
    servicioAmortizacion: String(
      getImportValue(row, "SERVICIO_AMORTIZACION") || ""
    ).trim(),
    comentarios: getImportValue(row, "COMENTARIOS"),
  }));

  const errores = [];
  const ids = new Map();

  for (const item of parsedRows) {
    if (!item.id) {
      errores.push(`Fila ${item.rowNumber}: Código obligatorio`);
    }
    if (!item.tipo) {
      errores.push(`Fila ${item.rowNumber}: Tipo obligatorio`);
    }
    if (!item.modelo) {
      errores.push(`Fila ${item.rowNumber}: Modelo obligatorio`);
    }
    if (!String(item.estado || "").trim()) {
      errores.push(`Fila ${item.rowNumber}: Estado obligatorio`);
    }
    if (!item.servicioOriginal) {
      errores.push(`Fila ${item.rowNumber}: Servicio Original obligatorio`);
    }

    if (item.id) {
      if (!ids.has(item.id)) ids.set(item.id, []);
      ids.get(item.id).push(item.rowNumber);
    }
  }

  for (const [id, rowNumbers] of ids.entries()) {
    if (rowNumbers.length > 1) {
      errores.push(
        `Código duplicado en archivo (${id}) en filas: ${rowNumbers.join(", ")}`
      );
    }
  }

  const [servicios, tipos, existentes] = await Promise.all([
    prisma.servicio.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
    }),
    prisma.tipoMaquina.findMany({
      include: {
        plazoAmortizacion: {
          select: { id: true, nombre: true, meses: true },
        },
      },
    }),
    prisma.maquina.findMany({
      where: { id: { in: parsedRows.map((item) => item.id).filter(Boolean) } },
      select: { id: true, servicioId: true },
    }),
  ]);

  const servicioByName = new Map(
    servicios.map((s) => [String(s.nombre || "").trim().toLowerCase(), s])
  );
  const tipoByNombre = new Map(
    tipos.map((t) => [String(t.nombre || "").trim().toLowerCase(), t])
  );
  const existentesById = new Map(existentes.map((m) => [m.id, m]));

  const normalizedRows = [];

  for (const item of parsedRows) {
    try {
      const tipoNorm = normalizeTipoMaquina(item.tipo);
      const tipo = tipoByNombre.get(tipoNorm.toLowerCase());
      if (!tipo) {
        throw new Error("Tipo de máquina inválido. Crealo desde Tipos de máquinas.");
      }

      const servicio = servicioByName.get(item.servicioOriginal.toLowerCase());
      if (!servicio) {
        throw new Error("Servicio Original inexistente");
      }

      let servicioAmortizacionId = null;
      if (item.servicioAmortizacion) {
        const servicioAmort = servicioByName.get(item.servicioAmortizacion.toLowerCase());
        if (!servicioAmort) {
          throw new Error("Servicio amortización inexistente");
        }
        servicioAmortizacionId = servicioAmort.id;
      }

      const empresa = normalizeEmpresa(item.empresa);
      const anio = parseNullableInt(item.anio, "Año");
      const amortizacion = parseNullableInt(item.amortizacion, "Amortización");
      const fechaCompra = parseNullableImportDate(item.fechaCompra, "Fecha de compra");
      const estado = parseEstadoObligatorio(item.estado);

      normalizedRows.push({
        rowNumber: item.rowNumber,
        id: item.id,
        tipo: tipoNorm,
        tipoMaquinaId: tipo.id,
        modelo: item.modelo,
        serie: parseNullableString(item.serie),
        estado,
        servicioId: servicio.id,
        fechaCompra,
        proveedorFactura: parseNullableString(item.proveedorFactura),
        empresa,
        anio,
        amortizacion: tipo.plazoAmortizacion?.meses ?? amortizacion,
        antiguedad: calcularAntiguedad(anio),
        valorUsadaDolares: parseNullableNonNegativeFloat(
          item.valorUsadaDolares,
          "Valor usada en dólares"
        ),
        valorUsadaPesos: parseNullableNonNegativeFloat(
          item.valorUsadaPesos,
          "Valor herramienta usada en pesos"
        ),
        valorNuevaDolares: parseNullableNonNegativeFloat(
          item.valorNuevaDolares,
          "Valor herramienta nueva en dólares"
        ),
        valorNuevaPesos: parseNullableNonNegativeFloat(
          item.valorNuevaPesos,
          "Valor herramienta nueva en pesos"
        ),
        origenInfo: parseNullableString(item.origenInfo),
        servicioAmortizacionId,
        comentarios: parseNullableString(item.comentarios),
      });
    } catch (e) {
      errores.push(`Fila ${item.rowNumber}${item.id ? ` (${item.id})` : ""}: ${e.message}`);
    }
  }

  if (errores.length > 0) {
    const err = new Error("El archivo tiene errores de validación");
    err.status = 409;
    err.detalles = errores;
    throw err;
  }

  const resumen = {
    detectadas: normalizedRows.length,
    creadas: normalizedRows.filter((item) => !existentesById.has(item.id)).length,
    actualizadas: normalizedRows.filter((item) => existentesById.has(item.id)).length,
  };

  return {
    normalizedRows,
    existentesById,
    resumen,
  };
}

async function findTipoMaquinaByNombre(nombre, client = prisma) {
  const tipos = await client.tipoMaquina.findMany({
    include: {
      plazoAmortizacion: {
        select: { id: true, nombre: true, meses: true },
      },
    },
  });
  return tipos.find((tipo) => tipo.nombre.toLowerCase() === nombre.toLowerCase()) || null;
}

async function getSinTipoMaquina(client = prisma) {
  const nombre = "SIN TIPO";
  const existente = await findTipoMaquinaByNombre(nombre, client);
  if (existente) return existente;
  return client.tipoMaquina.create({ data: { nombre } });
}

async function assertTipoMaquinaExists(nombre, client = prisma) {
  const normalized = normalizeTipoMaquina(nombre);
  if (!normalized) {
    throw new Error("Tipo de máquina obligatorio");
  }

  const tipo = await findTipoMaquinaByNombre(normalized, client);
  if (!tipo) {
    throw new Error("Tipo de máquina inválido. Crealo desde Tipos de máquinas.");
  }

  return tipo;
}

function resolveAmortizacionByTipo(tipoMaquina) {
  return tipoMaquina?.plazoAmortizacion?.meses ?? null;
}

async function resolveTipoMaquinaForExisting(maquina, client = prisma) {
  if (maquina?.tipoMaquinaId) {
    const byId = await client.tipoMaquina.findUnique({
      where: { id: maquina.tipoMaquinaId },
      include: {
        plazoAmortizacion: {
          select: { id: true, nombre: true, meses: true },
        },
      },
    });
    if (byId) return byId;
  }

  const byNombre = await findTipoMaquinaByNombre(maquina?.tipo || "", client);
  if (byNombre) return byNombre;

  return getSinTipoMaquina(client);
}

async function syncMaquinaAmortizacionByTipos(tipoIds, client = prisma) {
  const uniqueIds = Array.from(
    new Set((Array.isArray(tipoIds) ? tipoIds : []).filter((id) => Number.isInteger(id) && id > 0))
  );
  if (!uniqueIds.length) return;

  const tipos = await client.tipoMaquina.findMany({
    where: { id: { in: uniqueIds } },
    include: {
      plazoAmortizacion: {
        select: { meses: true },
      },
    },
  });

  for (const tipo of tipos) {
    await client.maquina.updateMany({
      where: { tipoMaquinaId: tipo.id },
      data: {
        tipo: tipo.nombre,
        amortizacion: resolveAmortizacionByTipo(tipo),
      },
    });
  }
}

function mapRutaServicio(item) {
  return {
    id: item.id,
    servicio: item.servicioId
      ? {
          id: item.servicioId,
          nombre: item.servicioNombre,
        }
      : null,
    fechaAsignacion: item.fechaAsignacion,
    tipoMovimiento: item.tipoMovimiento || "individual",
  };
}

let hasTipoMovimientoColumnCache = null;

async function hasTipoMovimientoColumn(client = prisma) {
  if (hasTipoMovimientoColumnCache !== null) return hasTipoMovimientoColumnCache;

  try {
    const cols = await client.$queryRaw`PRAGMA table_info("MaquinaServicioHistorial")`;
    hasTipoMovimientoColumnCache = Array.isArray(cols)
      ? cols.some((c) => String(c.name || "").toLowerCase() === "tipomovimiento")
      : false;
  } catch (_) {
    hasTipoMovimientoColumnCache = false;
  }

  return hasTipoMovimientoColumnCache;
}

async function insertMaquinaServicioHistorial(
  client,
  { maquinaId, servicioId, fechaAsignacion = null, tipoMovimiento = "individual" }
) {
  const hasColumn = await hasTipoMovimientoColumn(client);

  if (hasColumn) {
    if (fechaAsignacion) {
      await client.$executeRaw`
        INSERT INTO "MaquinaServicioHistorial" ("maquinaId", "servicioId", "fechaAsignacion", "tipoMovimiento")
        VALUES (${maquinaId}, ${servicioId}, ${fechaAsignacion}, ${tipoMovimiento})
      `;
      return;
    }

    await client.$executeRaw`
      INSERT INTO "MaquinaServicioHistorial" ("maquinaId", "servicioId", "tipoMovimiento")
      VALUES (${maquinaId}, ${servicioId}, ${tipoMovimiento})
    `;
    return;
  }

  if (fechaAsignacion) {
    await client.$executeRaw`
      INSERT INTO "MaquinaServicioHistorial" ("maquinaId", "servicioId", "fechaAsignacion")
      VALUES (${maquinaId}, ${servicioId}, ${fechaAsignacion})
    `;
    return;
  }

  await client.$executeRaw`
    INSERT INTO "MaquinaServicioHistorial" ("maquinaId", "servicioId")
    VALUES (${maquinaId}, ${servicioId})
  `;
}

/* ========================================================
   ABM TIPOS DE MÁQUINA
======================================================== */
export async function adminGetTiposMaquina(req, res) {
  try {
    const tipos = await prisma.tipoMaquina.findMany({
      include: {
        plazoAmortizacion: {
          select: { id: true, nombre: true, meses: true },
        },
        _count: {
          select: {
            maquinas: true,
            referencias: true,
          },
        },
      },
      orderBy: { nombre: "asc" },
    });

    res.json(
      tipos.map((tipo) => ({
        id: tipo.id,
        nombre: tipo.nombre,
        plazoAmortizacionId: tipo.plazoAmortizacionId,
        plazoAmortizacion: tipo.plazoAmortizacion
          ? {
              id: tipo.plazoAmortizacion.id,
              nombre: tipo.plazoAmortizacion.nombre,
              meses: tipo.plazoAmortizacion.meses,
            }
          : null,
          maquinasCount: tipo._count?.maquinas || 0,
          referenciasCount: tipo._count?.referencias || 0,
      }))
    );
  } catch (e) {
    console.error("adminGetTiposMaquina:", e);
    res.status(500).json({ error: "Error listando tipos de máquinas" });
  }
}

export async function adminGetTipoMaquinaReferencias(req, res) {
  try {
    const tipoId = parseTipoMaquinaIdParam(req.params.tipoId);
    if (!tipoId) {
      return res.status(400).json({ error: "ID de tipo de máquina inválido" });
    }

    const tipo = await loadTipoMaquinaOr404(tipoId);

    if (!tipo) {
      return res.status(404).json({ error: "Tipo de máquina no encontrado" });
    }

    const referencias = await prisma.tipoMaquinaReferencia.findMany({
      where: { tipoMaquinaId: tipoId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    const data = await Promise.all(referencias.map((referencia) => serializeReferenciaTipoMaquina(referencia)));
    res.json({ tipo, referencias: data });
  } catch (e) {
    console.error("adminGetTipoMaquinaReferencias:", e);
    res.status(500).json({ error: "Error listando referencias del tipo" });
  }
}

export async function adminCreateTipoMaquinaReferencia(req, res) {
  let uploadedKey = null;

  try {
    const tipoId = parseTipoMaquinaIdParam(req.params.tipoId);
    if (!tipoId) {
      return res.status(400).json({ error: "ID de tipo de máquina inválido" });
    }

    const tipo = await loadTipoMaquinaOr404(tipoId);

    if (!tipo) {
      return res.status(404).json({ error: "Tipo de máquina no encontrado" });
    }

    const descripcion = normalizeDescripcionReferencia(req.body?.descripcion);
    if (!descripcion) {
      return res.status(400).json({ error: "Descripción obligatoria" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Imagen obligatoria" });
    }

    if (!isReferenciaMimeValido(req.file.mimetype)) {
      return res.status(400).json({ error: "Formato inválido. Usá JPG, PNG o WEBP" });
    }

    uploadedKey = buildReferenciaKey({ tipoMaquinaId: tipoId, file: req.file });

    await uploadReferenciaToS3({
      key: uploadedKey,
      body: req.file.buffer,
      contentType: req.file.mimetype,
    });

    const referencia = await prisma.tipoMaquinaReferencia.create({
      data: {
        tipoMaquinaId: tipoId,
        s3Key: uploadedKey,
        originalName: req.file.originalname || null,
        mimeType: req.file.mimetype || null,
        descripcion,
      },
    });

    res.status(201).json(await serializeReferenciaTipoMaquina(referencia));
  } catch (e) {
    if (uploadedKey) {
      try {
        await deleteReferenciaFromS3(uploadedKey);
      } catch (s3Error) {
        console.warn("No se pudo limpiar la imagen subida:", s3Error);
      }
    }

    console.error("adminCreateTipoMaquinaReferencia:", e);
    res.status(500).json({ error: e.message || "Error creando referencia" });
  }
}

export async function adminUpdateTipoMaquinaReferencia(req, res) {
  let newKey = null;

  try {
    const tipoId = parseTipoMaquinaIdParam(req.params.tipoId);
    const referenciaId = parseTipoMaquinaIdParam(req.params.referenciaId);
    if (!tipoId || !referenciaId) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const tipo = await loadTipoMaquinaOr404(tipoId);

    if (!tipo) {
      return res.status(404).json({ error: "Tipo de máquina no encontrado" });
    }

    const referencia = await prisma.tipoMaquinaReferencia.findFirst({
      where: { id: referenciaId, tipoMaquinaId: tipoId },
    });

    if (!referencia) {
      return res.status(404).json({ error: "Referencia no encontrada" });
    }

    const descripcion = normalizeDescripcionReferencia(req.body?.descripcion);
    if (!descripcion) {
      return res.status(400).json({ error: "Descripción obligatoria" });
    }

    let data = {
      descripcion,
    };

    if (req.file) {
      if (!isReferenciaMimeValido(req.file.mimetype)) {
        return res.status(400).json({ error: "Formato inválido. Usá JPG, PNG o WEBP" });
      }

      newKey = buildReferenciaKey({ tipoMaquinaId: tipoId, file: req.file });
      await uploadReferenciaToS3({
        key: newKey,
        body: req.file.buffer,
        contentType: req.file.mimetype,
      });

      data = {
        ...data,
        s3Key: newKey,
        originalName: req.file.originalname || null,
        mimeType: req.file.mimetype || null,
      };
    }

    const updated = await prisma.tipoMaquinaReferencia.update({
      where: { id: referencia.id },
      data,
    });

    if (newKey && referencia.s3Key !== newKey) {
      try {
        await deleteReferenciaFromS3(referencia.s3Key);
      } catch (s3Error) {
        console.warn("No se pudo eliminar la imagen anterior:", s3Error);
      }
    }

    res.json(await serializeReferenciaTipoMaquina(updated));
  } catch (e) {
    if (newKey) {
      try {
        await deleteReferenciaFromS3(newKey);
      } catch (s3Error) {
        console.warn("No se pudo limpiar la imagen nueva:", s3Error);
      }
    }

    console.error("adminUpdateTipoMaquinaReferencia:", e);
    res.status(500).json({ error: e.message || "Error actualizando referencia" });
  }
}

export async function adminDeleteTipoMaquinaReferencia(req, res) {
  try {
    const tipoId = parseTipoMaquinaIdParam(req.params.tipoId);
    const referenciaId = parseTipoMaquinaIdParam(req.params.referenciaId);
    if (!tipoId || !referenciaId) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const tipo = await loadTipoMaquinaOr404(tipoId);

    if (!tipo) {
      return res.status(404).json({ error: "Tipo de máquina no encontrado" });
    }

    const referencia = await prisma.tipoMaquinaReferencia.findFirst({
      where: { id: referenciaId, tipoMaquinaId: tipoId },
    });

    if (!referencia) {
      return res.status(404).json({ error: "Referencia no encontrada" });
    }

    await prisma.tipoMaquinaReferencia.delete({ where: { id: referencia.id } });

    try {
      await deleteReferenciaFromS3(referencia.s3Key);
    } catch (s3Error) {
      console.warn("No se pudo eliminar la imagen de S3:", s3Error);
    }

    res.json({ message: "Referencia eliminada" });
  } catch (e) {
    console.error("adminDeleteTipoMaquinaReferencia:", e);
    res.status(500).json({ error: "Error eliminando referencia" });
  }
}

export async function adminCreateTipoMaquina(req, res) {
  try {
    const nombre = normalizeTipoMaquina(req.body?.nombre);
    const plazoAmortizacionId = req.body?.plazoAmortizacionId;
    if (!nombre) {
      return res.status(400).json({ error: "Nombre obligatorio" });
    }

    const plazoIdParsed =
      plazoAmortizacionId === undefined || plazoAmortizacionId === null || String(plazoAmortizacionId).trim() === ""
        ? null
        : Number(plazoAmortizacionId);

    if (plazoIdParsed !== null && (!Number.isInteger(plazoIdParsed) || plazoIdParsed <= 0)) {
      return res.status(400).json({ error: "plazoAmortizacionId inválido" });
    }

    if (plazoIdParsed !== null) {
      const plazo = await prisma.plazoAmortizacion.findUnique({ where: { id: plazoIdParsed } });
      if (!plazo) {
        return res.status(404).json({ error: "Plazo de amortización no encontrado" });
      }
    }

    const existente = await findTipoMaquinaByNombre(nombre);
    if (existente) {
      return res.status(409).json({ error: "Ya existe un tipo con ese nombre" });
    }

    const tipo = await prisma.tipoMaquina.create({
      data: {
        nombre,
        plazoAmortizacionId: plazoIdParsed,
      },
      include: {
        plazoAmortizacion: {
          select: { id: true, nombre: true, meses: true },
        },
      },
    });

    await syncMaquinaAmortizacionByTipos([tipo.id]);
    res.status(201).json(tipo);
  } catch (e) {
    console.error("adminCreateTipoMaquina:", e);
    res.status(500).json({ error: "Error creando tipo de máquina" });
  }
}

export async function adminUpdateTipoMaquina(req, res) {
  try {
    const id = Number(req.params.tipoId);
    const nombre = normalizeTipoMaquina(req.body?.nombre);
    const plazoAmortizacionId = req.body?.plazoAmortizacionId;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "ID inválido" });
    }

    if (!nombre) {
      return res.status(400).json({ error: "Nombre obligatorio" });
    }

    const plazoIdParsed =
      plazoAmortizacionId === undefined
        ? undefined
        : plazoAmortizacionId === null || String(plazoAmortizacionId).trim() === ""
          ? null
          : Number(plazoAmortizacionId);

    if (
      plazoIdParsed !== undefined &&
      plazoIdParsed !== null &&
      (!Number.isInteger(plazoIdParsed) || plazoIdParsed <= 0)
    ) {
      return res.status(400).json({ error: "plazoAmortizacionId inválido" });
    }

    if (plazoIdParsed !== undefined && plazoIdParsed !== null) {
      const plazo = await prisma.plazoAmortizacion.findUnique({ where: { id: plazoIdParsed } });
      if (!plazo) {
        return res.status(404).json({ error: "Plazo de amortización no encontrado" });
      }
    }

    const tipo = await prisma.tipoMaquina.findUnique({ where: { id } });
    if (!tipo) {
      return res.status(404).json({ error: "Tipo de máquina no encontrado" });
    }

    const duplicado = await findTipoMaquinaByNombre(nombre);
    if (duplicado && duplicado.id !== id) {
      return res.status(409).json({ error: "Ya existe un tipo con ese nombre" });
    }

    const actualizado = await prisma.$transaction(async (tx) => {
      const result = await tx.tipoMaquina.update({
        where: { id },
        data: {
          nombre,
          ...(plazoIdParsed !== undefined ? { plazoAmortizacionId: plazoIdParsed } : {}),
        },
        include: {
          plazoAmortizacion: {
            select: { id: true, nombre: true, meses: true },
          },
        },
      });

      if (tipo.nombre !== nombre) {
        await tx.maquina.updateMany({
          where: { OR: [{ tipo: tipo.nombre }, { tipoMaquinaId: id }] },
          data: { tipo: nombre },
        });
      }

      await syncMaquinaAmortizacionByTipos([id], tx);

      return result;
    });

    res.json(actualizado);
  } catch (e) {
    console.error("adminUpdateTipoMaquina:", e);
    res.status(500).json({ error: "Error actualizando tipo de máquina" });
  }
}

export async function adminDeleteTipoMaquina(req, res) {
  try {
    const id = Number(req.params.tipoId);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const tipo = await prisma.tipoMaquina.findUnique({ where: { id } });
    if (!tipo) {
      return res.status(404).json({ error: "Tipo de máquina no encontrado" });
    }

    const maquinasCount = await prisma.maquina.count({ where: { tipoMaquinaId: id } });

    if (maquinasCount > 0) {
      return res.status(409).json({
        error: "No se puede eliminar un tipo con máquinas asociadas",
      });
    }

    await prisma.tipoMaquina.delete({ where: { id } });
    res.json({ message: "Tipo de máquina eliminado" });
  } catch (e) {
    console.error("adminDeleteTipoMaquina:", e);
    res.status(500).json({ error: "Error eliminando tipo de máquina" });
  }
}

function normalizePlazoNombre(raw) {
  return String(raw || "").trim();
}

function parsePlazoMeses(raw) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("La cantidad de meses debe ser un entero mayor a 0");
  }
  return value;
}

function parseTipoIds(raw) {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    throw new Error("tipoIds debe ser un arreglo");
  }

  const ids = raw
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);

  return Array.from(new Set(ids));
}

export async function adminGetPlazosAmortizacion(req, res) {
  try {
    const [plazos, tipos] = await Promise.all([
      prisma.plazoAmortizacion.findMany({
        include: {
          tiposMaquina: {
            select: { id: true, nombre: true },
            orderBy: { nombre: "asc" },
          },
        },
        orderBy: [{ meses: "asc" }, { nombre: "asc" }],
      }),
      prisma.tipoMaquina.findMany({
        select: {
          id: true,
          nombre: true,
          plazoAmortizacionId: true,
        },
        orderBy: { nombre: "asc" },
      }),
    ]);

    res.json({
      plazos: plazos.map((plazo) => ({
        id: plazo.id,
        nombre: plazo.nombre,
        meses: plazo.meses,
        tiposMaquina: plazo.tiposMaquina,
      })),
      tipos,
    });
  } catch (e) {
    console.error("adminGetPlazosAmortizacion:", e);
    res.status(500).json({ error: "Error listando plazos de amortización" });
  }
}

export async function adminCreatePlazoAmortizacion(req, res) {
  try {
    const nombre = normalizePlazoNombre(req.body?.nombre);
    const meses = parsePlazoMeses(req.body?.meses);
    const tipoIds = parseTipoIds(req.body?.tipoIds);

    if (!nombre) {
      return res.status(400).json({ error: "Nombre obligatorio" });
    }

    const existente = await prisma.plazoAmortizacion.findFirst({
      where: { nombre: { equals: nombre } },
    });
    if (existente) {
      return res.status(409).json({ error: "Ya existe un plazo con ese nombre" });
    }

    const created = await prisma.$transaction(async (tx) => {
      const plazo = await tx.plazoAmortizacion.create({
        data: { nombre, meses },
      });

      if (tipoIds.length) {
        const found = await tx.tipoMaquina.findMany({ where: { id: { in: tipoIds } }, select: { id: true } });
        if (found.length !== tipoIds.length) {
          throw new Error("Hay tipos de máquina inexistentes en la selección");
        }

        await tx.tipoMaquina.updateMany({
          where: { id: { in: tipoIds } },
          data: { plazoAmortizacionId: plazo.id },
        });

        await syncMaquinaAmortizacionByTipos(tipoIds, tx);
      }

      return tx.plazoAmortizacion.findUnique({
        where: { id: plazo.id },
        include: {
          tiposMaquina: {
            select: { id: true, nombre: true },
            orderBy: { nombre: "asc" },
          },
        },
      });
    });

    res.status(201).json(created);
  } catch (e) {
    console.error("adminCreatePlazoAmortizacion:", e);
    if (e.message?.includes("meses") || e.message?.includes("tipoIds") || e.message?.includes("Nombre") || e.message?.includes("tipos")) {
      return res.status(400).json({ error: e.message });
    }
    res.status(500).json({ error: "Error creando plazo de amortización" });
  }
}

export async function adminUpdatePlazoAmortizacion(req, res) {
  try {
    const id = Number(req.params.plazoId);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const nombre = normalizePlazoNombre(req.body?.nombre);
    const meses = parsePlazoMeses(req.body?.meses);
    const tipoIds = parseTipoIds(req.body?.tipoIds);

    if (!nombre) {
      return res.status(400).json({ error: "Nombre obligatorio" });
    }

    const existing = await prisma.plazoAmortizacion.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Plazo de amortización no encontrado" });
    }

    const duplicate = await prisma.plazoAmortizacion.findFirst({
      where: {
        nombre: { equals: nombre },
        NOT: { id },
      },
    });

    if (duplicate) {
      return res.status(409).json({ error: "Ya existe un plazo con ese nombre" });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.plazoAmortizacion.update({
        where: { id },
        data: { nombre, meses },
      });

      const tiposAntes = await tx.tipoMaquina.findMany({
        where: { plazoAmortizacionId: id },
        select: { id: true },
      });

      await tx.tipoMaquina.updateMany({
        where: { plazoAmortizacionId: id, id: { notIn: tipoIds } },
        data: { plazoAmortizacionId: null },
      });

      if (tipoIds.length) {
        const found = await tx.tipoMaquina.findMany({ where: { id: { in: tipoIds } }, select: { id: true } });
        if (found.length !== tipoIds.length) {
          throw new Error("Hay tipos de máquina inexistentes en la selección");
        }

        await tx.tipoMaquina.updateMany({
          where: { id: { in: tipoIds } },
          data: { plazoAmortizacionId: id },
        });
      }

      const tiposAfectados = Array.from(
        new Set([...tiposAntes.map((t) => t.id), ...tipoIds])
      );
      await syncMaquinaAmortizacionByTipos(tiposAfectados, tx);

      return tx.plazoAmortizacion.findUnique({
        where: { id },
        include: {
          tiposMaquina: {
            select: { id: true, nombre: true },
            orderBy: { nombre: "asc" },
          },
        },
      });
    });

    res.json(updated);
  } catch (e) {
    console.error("adminUpdatePlazoAmortizacion:", e);
    if (e.message?.includes("meses") || e.message?.includes("tipoIds") || e.message?.includes("Nombre") || e.message?.includes("tipos")) {
      return res.status(400).json({ error: e.message });
    }
    res.status(500).json({ error: "Error actualizando plazo de amortización" });
  }
}

export async function adminDeletePlazoAmortizacion(req, res) {
  try {
    const id = Number(req.params.plazoId);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const plazo = await prisma.plazoAmortizacion.findUnique({ where: { id } });
    if (!plazo) {
      return res.status(404).json({ error: "Plazo de amortización no encontrado" });
    }

    const tiposCount = await prisma.tipoMaquina.count({ where: { plazoAmortizacionId: id } });
    if (tiposCount > 0) {
      return res.status(409).json({
        error: "No se puede eliminar el plazo porque tiene tipos de máquina asociados",
      });
    }

    await prisma.plazoAmortizacion.delete({ where: { id } });
    res.json({ message: "Plazo de amortización eliminado" });
  } catch (e) {
    console.error("adminDeletePlazoAmortizacion:", e);
    res.status(500).json({ error: "Error eliminando plazo de amortización" });
  }
}

/* ========================================================
   POST /admin/maquinas/amortizacion/recalcular
======================================================== */
export async function adminRecalcularEstadoAmortizacion(req, res) {
  const actor = await requireActor(req, res, ["admin"]);
  if (!actor) return;

  try {
    const maquinas = await prisma.maquina.findMany({
      include: {
        tipoMaquina: {
          select: {
            id: true,
            plazoAmortizacion: {
              select: { meses: true },
            },
          },
        },
      },
    });

    const resumen = {
      total: maquinas.length,
      amortizada: 0,
      noAmortizada: 0,
      sinDatos: 0,
    };

    for (const maquina of maquinas) {
      const estadoAmortizacion = calculateEstadoAmortizacion(
        maquina.fechaCompra,
        resolveAmortizacionByTipo(maquina.tipoMaquina)
      );

      if (estadoAmortizacion === ESTADO_AMORTIZACION.AMORTIZADA) resumen.amortizada += 1;
      else if (estadoAmortizacion === ESTADO_AMORTIZACION.NO_AMORTIZADA) resumen.noAmortizada += 1;
      else resumen.sinDatos += 1;

      await prisma.maquina.update({
        where: { id: maquina.id },
        data: { estadoAmortizacion },
      });
    }

    return res.json({
      message: "Estado de amortización recalculado correctamente",
      resumen,
    });
  } catch (e) {
    console.error("adminRecalcularEstadoAmortizacion:", e);
    return res.status(500).json({ error: "Error recalculando estado de amortización" });
  }
}

/* ========================================================
   POST /admin/maquinas/:id/amortizacion/recalcular
======================================================== */
export async function adminRecalcularEstadoAmortizacionByMaquina(req, res) {
  const actor = await requireActor(req, res, ["admin"]);
  if (!actor) return;

  try {
    const { id } = req.params;

    const maquina = await prisma.maquina.findUnique({
      where: { id },
      include: {
        servicio: {
          select: { id: true, nombre: true },
        },
        servicioAmortizacion: {
          select: { id: true, nombre: true },
        },
        tipoMaquina: {
          select: {
            id: true,
            nombre: true,
            plazoAmortizacion: {
              select: { id: true, nombre: true, meses: true },
            },
          },
        },
      },
    });

    if (!maquina) {
      return res.status(404).json({ error: "Máquina no encontrada" });
    }

    const amortizacionMeses = resolveAmortizacionByTipo(maquina.tipoMaquina);
    const estadoAmortizacion = calculateEstadoAmortizacion(maquina.fechaCompra, amortizacionMeses);

    const updated = await prisma.maquina.update({
      where: { id: maquina.id },
      data: { estadoAmortizacion },
      include: {
        servicio: {
          select: { id: true, nombre: true },
        },
        servicioAmortizacion: {
          select: { id: true, nombre: true },
        },
        tipoMaquina: {
          select: {
            id: true,
            nombre: true,
            plazoAmortizacion: {
              select: { id: true, nombre: true, meses: true },
            },
          },
        },
      },
    });

    return res.json({
      message: "Estado de amortización recalculado correctamente",
      maquina: {
        id: updated.id,
        tipo: updated.tipoMaquina?.nombre || updated.tipo,
        fechaCompra: updated.fechaCompra,
        amortizacion: resolveAmortizacionByTipo(updated.tipoMaquina),
        estadoAmortizacion: ESTADOS_AMORTIZACION_VALIDOS.has(updated.estadoAmortizacion)
          ? updated.estadoAmortizacion
          : ESTADO_AMORTIZACION.SIN_DATOS,
        estadoAmortizacionLabel: toEstadoAmortizacionLabel(updated.estadoAmortizacion),
      },
    });
  } catch (e) {
    console.error("adminRecalcularEstadoAmortizacionByMaquina:", e);
    return res.status(500).json({ error: "Error recalculando estado de amortización de la máquina" });
  }
}

/* ========================================================
   GET /admin/maquinas
======================================================== */
export async function adminGetMaquinas(req, res) {
  try {
    const { tipo, estado, search, estadoAmortizacion } = req.query;
    const where = {};

    if (tipo && String(tipo).trim() !== "") {
      where.tipo = String(tipo);
    }

    if (estado) {
      where.estado = normalizeEstado(estado);
    }

    if (estadoAmortizacion && String(estadoAmortizacion).trim() !== "") {
      const normalizedEstadoAmortizacion = normalizeEstadoAmortizacionFilter(estadoAmortizacion);
      if (normalizedEstadoAmortizacion) {
        where.estadoAmortizacion = normalizedEstadoAmortizacion;
      }
    }

    if (search && String(search).trim() !== "") {
      const q = String(search).trim();
      where.OR = [
        { id: { contains: q } },
        { tipo: { contains: q } },
        { modelo: { contains: q } },
        { serie: { contains: q } },
      ];
    }

    const maquinas = await prisma.maquina.findMany({
      where,
      include: {
        servicio: {
          select: { id: true, nombre: true },
        },
        servicioAmortizacion: {
          select: { id: true, nombre: true },
        },
        tipoMaquina: {
          select: {
            id: true,
            nombre: true,
            plazoAmortizacion: {
              select: { id: true, nombre: true, meses: true },
            },
          },
        },
      },
      orderBy: [{ tipo: "asc" }, { id: "asc" }],
    });

    const maquinasIds = maquinas.map((m) => m.id);

    const asignacionesActivas = maquinasIds.length
      ? await prisma.pedidoMaquina.findMany({
          where: {
            maquinaId: { in: maquinasIds },
            pedido: {
              estado: {
                notIn: ["CERRADO", "CANCELADO"],
              },
            },
          },
          include: {
            pedido: {
              select: {
                id: true,
                estado: true,
                createdAt: true,
                destino: true,
                servicio: {
                  select: { id: true, nombre: true },
                },
              },
            },
          },
          orderBy: {
            pedido: {
              createdAt: "desc",
            },
          },
        })
      : [];

    const maquinasNoDevueltasIds = maquinas
      .filter((m) => canonicalEstadoMaquina(m.estado) === "no_devuelta")
      .map((m) => m.id);

    const asignacionesHistoricasNoDevueltas = maquinasNoDevueltasIds.length
      ? await prisma.pedidoMaquina.findMany({
          where: {
            maquinaId: { in: maquinasNoDevueltasIds },
          },
          include: {
            pedido: {
              select: {
                id: true,
                estado: true,
                createdAt: true,
                destino: true,
                servicio: {
                  select: { id: true, nombre: true },
                },
              },
            },
          },
          orderBy: {
            pedido: {
              createdAt: "desc",
            },
          },
        })
      : [];

    const asignacionPorMaquina = new Map();
    for (const a of asignacionesActivas) {
      if (!asignacionPorMaquina.has(a.maquinaId)) {
        asignacionPorMaquina.set(a.maquinaId, {
          pedidoId: a.pedido.id,
          estadoPedido: a.pedido.estado,
          destino: a.pedido.destino,
          servicio: a.pedido.servicio,
        });
      }
    }

    const asignacionHistoricaPorMaquina = new Map();
    for (const a of asignacionesHistoricasNoDevueltas) {
      if (!asignacionHistoricaPorMaquina.has(a.maquinaId)) {
        asignacionHistoricaPorMaquina.set(a.maquinaId, {
          pedidoId: a.pedido.id,
          estadoPedido: a.pedido.estado,
          destino: a.pedido.destino,
          servicio: a.pedido.servicio,
        });
      }
    }

    const result = maquinas.map((m) => ({
      ...m,
      tipo: m.tipoMaquina?.nombre || m.tipo,
      amortizacion: resolveAmortizacionByTipo(m.tipoMaquina),
      estadoAmortizacion: ESTADOS_AMORTIZACION_VALIDOS.has(m.estadoAmortizacion)
        ? m.estadoAmortizacion
        : ESTADO_AMORTIZACION.SIN_DATOS,
      estadoAmortizacionLabel: toEstadoAmortizacionLabel(m.estadoAmortizacion),
      estado: canonicalEstadoMaquina(m.estado),
      asignacion:
        asignacionPorMaquina.get(m.id) ||
        (canonicalEstadoMaquina(m.estado) === "no_devuelta"
          ? asignacionHistoricaPorMaquina.get(m.id) || null
          : null),
    }));

    res.json(result);
  } catch (e) {
    console.error("adminGetMaquinas:", e);
    res.status(500).json({ error: "Error listando máquinas" });
  }
}

/* ========================================================
   GET /admin/maquinas/:id
======================================================== */
export async function adminGetMaquinaById(req, res) {
  try {
    const { id } = req.params;

    const maquina = await prisma.maquina.findUnique({
      where: { id },
      include: {
        servicio: {
          select: { id: true, nombre: true },
        },
        servicioAmortizacion: {
          select: { id: true, nombre: true },
        },
        tipoMaquina: {
          select: {
            id: true,
            nombre: true,
            plazoAmortizacion: {
              select: { id: true, nombre: true, meses: true },
            },
          },
        },
      },
    });

    if (!maquina) {
      return res.status(404).json({ error: "Máquina no encontrada" });
    }

    const tipoMaquinaNombre = maquina.tipoMaquina?.nombre || maquina.tipo;

    // 🔑 Pedido actual (no cerrado) más reciente
    const pedidoActual = await prisma.pedido.findFirst({
      where: {
        estado: { notIn: [ESTADO_PEDIDO_CERRADO, "CANCELADO"] },
        asignadas: {
          some: { maquinaId: id },
        },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        estado: true,
        servicio: {
          select: { nombre: true },
        },
      },
    });

    const pedidoHistoricoNoDevuelto = !pedidoActual && canonicalEstadoMaquina(maquina.estado) === "no_devuelta"
      ? await prisma.pedido.findFirst({
          where: {
            asignadas: {
              some: { maquinaId: id },
            },
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            estado: true,
            servicio: {
              select: { nombre: true },
            },
          },
        })
      : null;

    res.json({
      ...maquina,
      tipo: maquina.tipoMaquina?.nombre || maquina.tipo,
      amortizacion: resolveAmortizacionByTipo(maquina.tipoMaquina),
      estadoAmortizacion: ESTADOS_AMORTIZACION_VALIDOS.has(maquina.estadoAmortizacion)
        ? maquina.estadoAmortizacion
        : ESTADO_AMORTIZACION.SIN_DATOS,
      estadoAmortizacionLabel: toEstadoAmortizacionLabel(maquina.estadoAmortizacion),
      estado: canonicalEstadoMaquina(maquina.estado),
      asignacion: pedidoActual || pedidoHistoricoNoDevuelto
        ? {
            pedidoId: (pedidoActual || pedidoHistoricoNoDevuelto).id,
            servicio: (pedidoActual || pedidoHistoricoNoDevuelto).servicio?.nombre ?? null,
            estadoPedido: (pedidoActual || pedidoHistoricoNoDevuelto).estado,
          }
        : null,
    });
  } catch (e) {
    console.error("adminGetMaquinaById:", e);
    res.status(500).json({ error: "Error obteniendo máquina" });
  }
}

/* ========================================================
   GET /admin/maquinas/:id/pedidos-historicos
======================================================== */
export async function adminGetPedidosHistoricosByMaquina(req, res) {
  try {
    const { id } = req.params;

    const maquina = await prisma.maquina.findUnique({
      where: { id },
      include: {
        servicio: {
          select: { id: true, nombre: true },
        },
        servicioAmortizacion: {
          select: { id: true, nombre: true },
        },
        tipoMaquina: {
          select: {
            id: true,
            nombre: true,
            plazoAmortizacion: {
              select: { id: true, nombre: true, meses: true },
            },
          },
        },
      },
    });

    if (!maquina) {
      return res.status(404).json({ error: "Máquina no encontrada" });
    }

    const tipoMaquinaNombre = maquina.tipoMaquina?.nombre || maquina.tipo;

    const asignaciones = await prisma.pedidoMaquina.findMany({
      where: { maquinaId: id },
      include: {
        pedido: {
          select: {
            id: true,
            estado: true,
            destino: true,
            supervisorDestinoUsername: true,
            createdAt: true,
            servicio: {
              select: { id: true, nombre: true },
            },
            supervisor: {
              select: {
                id: true,
                username: true,
                nombre: true,
              },
            },
          },
        },
      },
      orderBy: {
        pedido: {
          createdAt: "desc",
        },
      },
    });

    const eventuales = await prisma.eventual.findMany({
      where: {
        maquinasUtilizadas: {
          contains: `\"tipo\":\"${tipoMaquinaNombre}\"`,
        },
      },
      select: {
        id: true,
        nombre: true,
        estado: true,
        fechaInicio: true,
        fechaFin: true,
        createdAt: true,
        activo: true,
        supervisor: {
          select: {
            id: true,
            username: true,
            nombre: true,
          },
        },
      },
      orderBy: [
        { fechaInicio: "desc" },
        { createdAt: "desc" },
      ],
    });

    const rutaServiciosRaw = (await hasTipoMovimientoColumn())
      ? await prisma.$queryRaw`
          SELECT
            h.id,
            h."fechaAsignacion",
            h."tipoMovimiento",
            s.id AS "servicioId",
            s.nombre AS "servicioNombre"
          FROM "MaquinaServicioHistorial" h
          INNER JOIN "Servicio" s ON s.id = h."servicioId"
          WHERE h."maquinaId" = ${id}
          ORDER BY h."fechaAsignacion" ASC, h.id ASC
        `
      : await prisma.$queryRaw`
          SELECT
            h.id,
            h."fechaAsignacion",
            'individual' AS "tipoMovimiento",
            s.id AS "servicioId",
            s.nombre AS "servicioNombre"
          FROM "MaquinaServicioHistorial" h
          INNER JOIN "Servicio" s ON s.id = h."servicioId"
          WHERE h."maquinaId" = ${id}
          ORDER BY h."fechaAsignacion" ASC, h.id ASC
        `;

    const rutaServicios = rutaServiciosRaw.length
      ? rutaServiciosRaw.map(mapRutaServicio)
      : maquina.servicio
        ? [
            {
              id: null,
              servicio: maquina.servicio,
              fechaAsignacion: maquina.createdAt,
            },
          ]
        : [];

    res.json({
      maquina: {
        id: maquina.id,
        tipo: tipoMaquinaNombre,
        modelo: maquina.modelo,
        serie: maquina.serie,
        estado: canonicalEstadoMaquina(maquina.estado),
        fechaCompra: maquina.fechaCompra,
        proveedorFactura: maquina.proveedorFactura,
        empresa: maquina.empresa,
        anio: maquina.anio,
        amortizacion: resolveAmortizacionByTipo(maquina.tipoMaquina),
        estadoAmortizacion: ESTADOS_AMORTIZACION_VALIDOS.has(maquina.estadoAmortizacion)
          ? maquina.estadoAmortizacion
          : ESTADO_AMORTIZACION.SIN_DATOS,
        estadoAmortizacionLabel: toEstadoAmortizacionLabel(maquina.estadoAmortizacion),
        antiguedad: maquina.antiguedad,
        valorUsadaDolares: maquina.valorUsadaDolares,
        valorUsadaPesos: maquina.valorUsadaPesos,
        valorNuevaDolares: maquina.valorNuevaDolares,
        valorNuevaPesos: maquina.valorNuevaPesos,
        origenInfo: maquina.origenInfo,
        comentarios: maquina.comentarios,
        servicio: maquina.servicio,
        servicioAmortizacion: maquina.servicioAmortizacion,
      },
      pedidos: asignaciones.map((asignacion) => ({
        id: asignacion.pedido.id,
        estado: asignacion.pedido.estado,
        destino: asignacion.pedido.destino,
        supervisorDestinoUsername: asignacion.pedido.supervisorDestinoUsername,
        createdAt: asignacion.pedido.createdAt,
        servicio: asignacion.pedido.servicio,
        supervisor: asignacion.pedido.supervisor,
      })),
      eventuales,
      rutaServicios,
    });
  } catch (e) {
    console.error("adminGetPedidosHistoricosByMaquina:", e);
    res.status(500).json({ error: "Error obteniendo histórico de pedidos" });
  }
}

/* ========================================================
   POST /admin/maquinas
======================================================== */
export async function adminCreateMaquina(req, res) {
  try {
    const {
      id,
      tipo,
      modelo,
      serie,
      estado,
      servicioId,
      fechaCompra,
      proveedorFactura,
      empresa,
      anio,
      valorUsadaDolares,
      valorUsadaPesos,
      valorNuevaDolares,
      valorNuevaPesos,
      origenInfo,
      servicioAmortizacionId,
      comentarios,
    } = req.body || {};

    if (!id || !tipo || !modelo || !servicioId) {
      return res.status(400).json({
        error: "id, tipo, modelo y servicioId son obligatorios",
      });
    }

    const existe = await prisma.maquina.findUnique({ where: { id } });
    if (existe) {
      return res.status(409).json({
        error: `Ya existe una máquina con código ${id}`,
      });
    }

    const empresaNormalizada = normalizeEmpresa(empresa);
    const anioParsed = parseNullableInt(anio, "Año");
    const antiguedadCalculada = calcularAntiguedad(anioParsed);
    const servicioAmortizacionIdParsed =
      servicioAmortizacionId !== undefined &&
      servicioAmortizacionId !== null &&
      String(servicioAmortizacionId).trim() !== ""
        ? Number(servicioAmortizacionId)
        : null;

    if (
      servicioAmortizacionIdParsed !== null &&
      (!Number.isInteger(servicioAmortizacionIdParsed) || servicioAmortizacionIdParsed <= 0)
    ) {
      return res.status(400).json({ error: "servicioAmortizacionId inválido" });
    }

    const tipoSeleccionado = await assertTipoMaquinaExists(tipo);

    const nueva = await prisma.maquina.create({
      data: {
        id: String(id),
        tipo: tipoSeleccionado.nombre,
        tipoMaquinaId: tipoSeleccionado.id,
        modelo: String(modelo),
        serie:
          serie !== undefined && String(serie).trim() !== ""
            ? String(serie)
            : null,
        estado: normalizeEstado(estado),
        servicioId: Number(servicioId),
        fechaCompra: parseNullableDate(fechaCompra, "Fecha de compra"),
        proveedorFactura: parseNullableString(proveedorFactura),
        empresa: empresaNormalizada,
        anio: anioParsed,
        amortizacion: resolveAmortizacionByTipo(tipoSeleccionado),
        antiguedad: antiguedadCalculada,
        valorUsadaDolares: parseNullableNonNegativeFloat(valorUsadaDolares, "Valor usada en dólares"),
        valorUsadaPesos: parseNullableNonNegativeFloat(valorUsadaPesos, "Valor herramienta usada en pesos"),
        valorNuevaDolares: parseNullableNonNegativeFloat(valorNuevaDolares, "Valor herramienta nueva en dólares"),
        valorNuevaPesos: parseNullableNonNegativeFloat(valorNuevaPesos, "Valor herramienta nueva en pesos"),
        origenInfo: parseNullableString(origenInfo),
        servicioAmortizacionId: servicioAmortizacionIdParsed,
        comentarios: parseNullableString(comentarios),
      },
    });

    await insertMaquinaServicioHistorial(prisma, {
      maquinaId: nueva.id,
      servicioId: nueva.servicioId,
      fechaAsignacion: nueva.createdAt,
      tipoMovimiento: "individual",
    });

    res.status(201).json({
      message: "Máquina creada correctamente",
      maquina: nueva,
    });
  } catch (e) {
    console.error("adminCreateMaquina:", e);
    if (e.message?.includes("debe ser") || e.message?.includes("inválida") || e.message?.includes("inválido") || e.message?.includes("obligatorio") || e.message?.includes("negativo")) {
      return res.status(400).json({ error: e.message });
    }
    res.status(500).json({ error: "Error creando máquina" });
  }
}

/* ========================================================
   PUT /admin/maquinas/:id
======================================================== */
export async function adminUpdateMaquina(req, res) {
  try {
    const { id } = req.params;
    const {
      tipo,
      modelo,
      serie,
      estado,
      servicioId,
      fechaCompra,
      proveedorFactura,
      empresa,
      anio,
      valorUsadaDolares,
      valorUsadaPesos,
      valorNuevaDolares,
      valorNuevaPesos,
      origenInfo,
      servicioAmortizacionId,
      comentarios,
    } = req.body || {};

    const existe = await prisma.maquina.findUnique({ where: { id } });
    if (!existe) {
      return res.status(404).json({ error: "Máquina no encontrada" });
    }

    const anioParsed =
      anio !== undefined ? parseNullableInt(anio, "Año") : existe.anio;
    const servicioAmortizacionIdParsed =
      servicioAmortizacionId !== undefined
        ? servicioAmortizacionId === null || String(servicioAmortizacionId).trim() === ""
          ? null
          : Number(servicioAmortizacionId)
        : existe.servicioAmortizacionId;

    if (
      servicioAmortizacionIdParsed !== null &&
      (!Number.isInteger(servicioAmortizacionIdParsed) || servicioAmortizacionIdParsed <= 0)
    ) {
      return res.status(400).json({ error: "servicioAmortizacionId inválido" });
    }

    const nuevoServicioId =
      servicioId !== undefined
        ? Number(servicioId)
        : existe.servicioId;

    const tipoSeleccionado =
      tipo !== undefined && String(tipo).trim() !== ""
        ? await assertTipoMaquinaExists(tipo)
        : await resolveTipoMaquinaForExisting(existe);

    const actualizada = await prisma.maquina.update({
      where: { id },
      data: {
        tipo: tipoSeleccionado.nombre,
        tipoMaquinaId: tipoSeleccionado.id,

        modelo:
          modelo !== undefined && String(modelo).trim() !== ""
            ? String(modelo)
            : existe.modelo,

        serie:
          serie !== undefined
            ? String(serie).trim() !== ""
              ? String(serie)
              : null
            : existe.serie,

        estado:
          estado !== undefined
            ? normalizeEstado(estado)
            : existe.estado,

        servicioId: nuevoServicioId,

        fechaCompra:
          fechaCompra !== undefined
            ? parseNullableDate(fechaCompra, "Fecha de compra")
            : existe.fechaCompra,

        proveedorFactura:
          proveedorFactura !== undefined
            ? parseNullableString(proveedorFactura)
            : existe.proveedorFactura,

        empresa:
          empresa !== undefined
            ? normalizeEmpresa(empresa)
            : existe.empresa,

        anio: anioParsed,

        amortizacion: resolveAmortizacionByTipo(tipoSeleccionado),

        antiguedad: calcularAntiguedad(anioParsed),

        valorUsadaDolares:
          valorUsadaDolares !== undefined
            ? parseNullableNonNegativeFloat(valorUsadaDolares, "Valor usada en dólares")
            : existe.valorUsadaDolares,

        valorUsadaPesos:
          valorUsadaPesos !== undefined
            ? parseNullableNonNegativeFloat(valorUsadaPesos, "Valor herramienta usada en pesos")
            : existe.valorUsadaPesos,

        valorNuevaDolares:
          valorNuevaDolares !== undefined
            ? parseNullableNonNegativeFloat(valorNuevaDolares, "Valor herramienta nueva en dólares")
            : existe.valorNuevaDolares,

        valorNuevaPesos:
          valorNuevaPesos !== undefined
            ? parseNullableNonNegativeFloat(valorNuevaPesos, "Valor herramienta nueva en pesos")
            : existe.valorNuevaPesos,

        origenInfo:
          origenInfo !== undefined
            ? parseNullableString(origenInfo)
            : existe.origenInfo,

        servicioAmortizacionId: servicioAmortizacionIdParsed,

        comentarios:
          comentarios !== undefined
            ? parseNullableString(comentarios)
            : existe.comentarios,
      },
    });

    if (nuevoServicioId !== existe.servicioId) {
      await insertMaquinaServicioHistorial(prisma, {
        maquinaId: actualizada.id,
        servicioId: nuevoServicioId,
        tipoMovimiento: "individual",
      });
    }

    res.json({
      message: "Máquina actualizada correctamente",
      maquina: actualizada,
    });
  } catch (e) {
    console.error("adminUpdateMaquina:", e);
    if (e.message?.includes("debe ser") || e.message?.includes("inválida") || e.message?.includes("inválido") || e.message?.includes("obligatorio") || e.message?.includes("negativo")) {
      return res.status(400).json({ error: e.message });
    }
    res.status(500).json({ error: "Error actualizando máquina" });
  }
}

/* ========================================================
   POST /admin/maquinas/movimientos-masivos
======================================================== */
export async function adminMoverMaquinasMasivo(req, res) {
  try {
    const {
      maquinaIds,
      servicioId,
      dryRun = false,
      confirmarConActivos = false,
    } = req.body || {};

    const ids = Array.isArray(maquinaIds)
      ? [...new Set(maquinaIds.map((id) => String(id || "").trim()).filter(Boolean))]
      : [];

    if (!ids.length) {
      return res.status(400).json({ error: "Debe enviar al menos una máquina" });
    }

    const servicioDestinoId = Number(servicioId);
    if (!Number.isInteger(servicioDestinoId) || servicioDestinoId <= 0) {
      return res.status(400).json({ error: "servicioId inválido" });
    }

    const servicioDestino = await prisma.servicio.findUnique({
      where: { id: servicioDestinoId },
      select: { id: true, nombre: true, activo: true },
    });

    if (!servicioDestino || !servicioDestino.activo) {
      return res.status(404).json({ error: "Servicio destino no encontrado" });
    }

    const [maquinas, asignacionesActivas] = await Promise.all([
      prisma.maquina.findMany({
        where: { id: { in: ids } },
        include: {
          servicio: {
            select: { id: true, nombre: true },
          },
        },
      }),
      prisma.pedidoMaquina.findMany({
        where: {
          maquinaId: { in: ids },
          pedido: {
            estado: {
              notIn: ["CERRADO", "CANCELADO"],
            },
          },
        },
        include: {
          pedido: {
            select: {
              id: true,
              estado: true,
              servicio: {
                select: { id: true, nombre: true },
              },
            },
          },
        },
        orderBy: {
          pedido: {
            createdAt: "desc",
          },
        },
      }),
    ]);

    const maquinasById = new Map(maquinas.map((m) => [m.id, m]));
    const inexistentes = ids.filter((id) => !maquinasById.has(id));

    if (inexistentes.length) {
      return res.status(400).json({
        error: "Hay máquinas inexistentes en la selección",
        inexistentes,
      });
    }

    const asignacionActivaByMaquina = new Map();
    for (const a of asignacionesActivas) {
      if (!asignacionActivaByMaquina.has(a.maquinaId)) {
        asignacionActivaByMaquina.set(a.maquinaId, a);
      }
    }

    const conPedidoActivo = ids
      .filter((id) => asignacionActivaByMaquina.has(id))
      .map((id) => {
        const maquina = maquinasById.get(id);
        const asignacion = asignacionActivaByMaquina.get(id);
        return {
          id,
          tipo: maquina?.tipo || null,
          modelo: maquina?.modelo || null,
          pedidoId: asignacion.pedido.id,
          estadoPedido: asignacion.pedido.estado,
          servicioPedido: asignacion.pedido.servicio?.nombre || null,
        };
      });

    const sinCambios = ids
      .filter((id) => maquinasById.get(id)?.servicioId === servicioDestinoId)
      .map((id) => ({
        id,
        servicioActual: maquinasById.get(id)?.servicio?.nombre || null,
      }));

    const paraMover = ids.filter(
      (id) => maquinasById.get(id)?.servicioId !== servicioDestinoId
    );

    const resumen = {
      seleccionadas: ids.length,
      conPedidoActivo: conPedidoActivo.length,
      sinCambios: sinCambios.length,
      paraMover: paraMover.length,
    };

    if (dryRun) {
      return res.json({
        dryRun: true,
        requiereConfirmacionActivos: conPedidoActivo.length > 0,
        servicioDestino,
        resumen,
        conPedidoActivo,
        sinCambios,
        paraMover,
      });
    }

    if (conPedidoActivo.length > 0 && !confirmarConActivos) {
      return res.status(409).json({
        error:
          "Estas máquinas forman parte de un pedido activo. Confirmá para continuar.",
        code: "REQUIERE_CONFIRMACION_ACTIVOS",
        servicioDestino,
        resumen,
        conPedidoActivo,
        sinCambios,
        paraMover,
      });
    }

    const ahora = new Date();

    await prisma.$transaction(async (tx) => {
      const maquinasTx = await tx.maquina.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          servicioId: true,
        },
      });

      if (maquinasTx.length !== ids.length) {
        throw new Error("La selección cambió durante el proceso. Reintentá.");
      }

      const activasTx = await tx.pedidoMaquina.findMany({
        where: {
          maquinaId: { in: ids },
          pedido: {
            estado: {
              notIn: ["CERRADO", "CANCELADO"],
            },
          },
        },
        select: {
          maquinaId: true,
        },
      });

      if (activasTx.length > 0 && !confirmarConActivos) {
        throw new Error("Estas máquinas tienen pedidos activos sin confirmar.");
      }

      const idsParaMoverTx = maquinasTx
        .filter((m) => m.servicioId !== servicioDestinoId)
        .map((m) => m.id);

      for (const maquinaId of idsParaMoverTx) {
        await tx.maquina.update({
          where: { id: maquinaId },
          data: { servicioId: servicioDestinoId },
        });

        await insertMaquinaServicioHistorial(tx, {
          maquinaId,
          servicioId: servicioDestinoId,
          fechaAsignacion: ahora,
          tipoMovimiento: "masivo",
        });
      }
    });

    return res.json({
      message: "Movimiento masivo aplicado correctamente",
      esMasivo: true,
      servicioDestino,
      resumen,
      conPedidoActivo,
      sinCambios,
      movidas: paraMover,
    });
  } catch (e) {
    console.error("adminMoverMaquinasMasivo:", e);
    if (e.message?.includes("Reintentá") || e.message?.includes("activos")) {
      return res.status(409).json({ error: e.message });
    }
    res.status(500).json({ error: "Error aplicando movimiento masivo" });
  }
}

/* ========================================================
   DELETE /admin/maquinas/:id
   (BAJA LÓGICA)
======================================================== */
export async function adminDeleteMaquina(req, res) {
  try {
    const { id } = req.params;

    const existe = await prisma.maquina.findUnique({ where: { id } });
    if (!existe) {
      return res.status(404).json({ error: "Máquina no encontrada" });
    }

    const maquina = await prisma.maquina.update({
      where: { id },
      data: { estado: "baja" },
    });

    res.json({
      message: "Máquina dada de baja correctamente",
      maquina,
    });
  } catch (e) {
    console.error("adminDeleteMaquina:", e);
    res.status(500).json({ error: "Error dando de baja máquina" });
  }
}

/* ========================================================
   PUT /admin/maquinas/:id/estado
======================================================== */
export async function adminCambiarEstado(req, res) {
  try {
    const { id } = req.params;
    const { estado } = req.body || {};

    if (!estado) {
      return res.status(400).json({ error: "Debe enviar el nuevo estado" });
    }

    const estadoNorm = normalizeEstado(estado);
    if (!ESTADOS_MAQUINA_VALIDOS.includes(estadoNorm)) {
      return res.status(400).json({
        error: `Estado inválido. Debe ser uno de: ${ESTADOS_MAQUINA_VALIDOS.join(
          ", "
        )}`,
      });
    }

    const existe = await prisma.maquina.findUnique({ where: { id } });
    if (!existe) {
      return res.status(404).json({ error: "Máquina no encontrada" });
    }

    const maquina = await prisma.maquina.update({
      where: { id },
      data: { estado: estadoNorm },
    });

    res.json({
      message: "Estado actualizado correctamente",
      maquina,
    });
  } catch (e) {
    console.error("adminCambiarEstado:", e);
    res.status(500).json({ error: "Error actualizando estado" });
  }
}

/* ========================================================
   GET /admin/maquinas/stock-resumen
======================================================== */
export async function adminResumenStock(req, res) {
  try {
    const maquinas = await prisma.maquina.findMany();

    const porEstado = {};
    const porTipo = {};

    for (const m of maquinas) {
      const est = normalizeEstado(m.estado);

      porEstado[est] = (porEstado[est] || 0) + 1;

      const tipo = m.tipo || "SIN_TIPO";
      if (!porTipo[tipo]) {
        porTipo[tipo] = {
          total: 0,
          disponible: 0,
          asignada: 0,
          no_devuelta: 0,
          fuera_servicio: 0,
          taller: 0,
          baja: 0,
        };
      }

      porTipo[tipo].total += 1;
      if (porTipo[tipo][est] !== undefined) {
        porTipo[tipo][est] += 1;
      }
    }

    res.json({ porEstado, porTipo });
  } catch (e) {
    console.error("adminResumenStock:", e);
    res.status(500).json({ error: "Error obteniendo resumen de stock" });
  }
}

/* ========================================================
   GET /admin/maquinas/export
======================================================== */
export async function adminExportMaquinas(req, res) {
  try {
    const maquinas = await prisma.maquina.findMany({
      include: {
        servicio: {
          select: { id: true, nombre: true },
        },
        servicioAmortizacion: {
          select: { id: true, nombre: true },
        },
        tipoMaquina: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
      orderBy: [{ tipo: "asc" }, { id: "asc" }],
    });

    const maquinasIds = maquinas.map((maquina) => maquina.id);

    const asignacionesActivas = maquinasIds.length
      ? await prisma.pedidoMaquina.findMany({
          where: {
            maquinaId: { in: maquinasIds },
            pedido: {
              estado: {
                notIn: ["CERRADO", "CANCELADO"],
              },
            },
          },
          include: {
            pedido: {
              select: {
                id: true,
                estado: true,
                destino: true,
                createdAt: true,
                servicio: {
                  select: { id: true, nombre: true },
                },
              },
            },
          },
          orderBy: {
            pedido: {
              createdAt: "desc",
            },
          },
        })
      : [];

    const asignacionPorMaquina = new Map();
    for (const asignacion of asignacionesActivas) {
      if (!asignacionPorMaquina.has(asignacion.maquinaId)) {
        asignacionPorMaquina.set(asignacion.maquinaId, asignacion.pedido);
      }
    }

    const rows = [[
      "Codigo",
      "Tipo",
      "Modelo",
      "Serie",
      "Estado",
      "Servicio Original",
      "Fecha compra",
      "Proveedor/N factura",
      "Empresa",
      "Año",
      "Amortización",
      "Estado amortización",
      "Antigüedad",
      "Valor usada USD",
      "Valor usada ARS",
      "Valor nueva USD",
      "Valor nueva ARS",
      "Origen info",
      "Servicio amortización",
      "Comentarios",
      "Pedido Activo",
      "Estado Pedido Activo",
      "Destino Pedido Activo",
      "Servicio Prestamo",
    ]];

    for (const maquina of maquinas) {
      const asignacion = asignacionPorMaquina.get(maquina.id);

      rows.push([
        maquina.id,
        maquina.tipo,
        maquina.modelo,
        maquina.serie,
        maquina.estado,
        maquina.servicio?.nombre ?? "",
        maquina.fechaCompra ? maquina.fechaCompra.toISOString().slice(0, 10) : "",
        maquina.proveedorFactura ?? "",
        maquina.empresa ?? "",
        maquina.anio ?? "",
        maquina.amortizacion ?? "",
        toEstadoAmortizacionLabel(maquina.estadoAmortizacion),
        maquina.antiguedad ?? "",
        maquina.valorUsadaDolares ?? "",
        maquina.valorUsadaPesos ?? "",
        maquina.valorNuevaDolares ?? "",
        maquina.valorNuevaPesos ?? "",
        maquina.origenInfo ?? "",
        maquina.servicioAmortizacion?.nombre ?? "",
        maquina.comentarios ?? "",
        asignacion?.id ?? "",
        asignacion?.estado ?? "",
        asignacion?.destino ?? "",
        asignacion?.servicio?.nombre ?? "",
      ]);
    }

    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.aoa_to_sheet(rows);
    xlsx.utils.book_append_sheet(workbook, worksheet, "Maquinas");

    const buffer = xlsx.write(workbook, { bookType: "xlsx", type: "buffer" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=maquinas_${new Date().toISOString().slice(0, 10)}.xlsx`
    );

    res.send(buffer);
  } catch (e) {
    console.error("adminExportMaquinas:", e);
    res.status(500).json({ error: "Error exportando máquinas" });
  }
}

/* ========================================================
   GET /admin/maquinas/import/template
======================================================== */
export async function adminDownloadMaquinasTemplate(req, res) {
  const actor = await requireActor(req, res, ["admin"]);
  if (!actor) return;

  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Maquinas");

    const columns = [
      { header: "* CODIGO", required: true, width: 18 },
      { header: "* TIPO", required: true, width: 22 },
      { header: "* MODELO", required: true, width: 28 },
      { header: "SERIE", required: false, width: 22 },
      { header: "* ESTADO", required: true, width: 18 },
      { header: "* SERVICIO_ORIGINAL", required: true, width: 26 },
      { header: "FECHA_COMPRA", required: false, width: 16 },
      { header: "PROVEEDOR_N_FACTURA", required: false, width: 28 },
      { header: "EMPRESA", required: false, width: 16 },
      { header: "ANIO", required: false, width: 12 },
      { header: "AMORTIZACION", required: false, width: 16 },
      { header: "VALOR_USADA_USD", required: false, width: 18 },
      { header: "VALOR_USADA_ARS", required: false, width: 18 },
      { header: "VALOR_NUEVA_USD", required: false, width: 18 },
      { header: "VALOR_NUEVA_ARS", required: false, width: 18 },
      { header: "ORIGEN_INFO", required: false, width: 22 },
      { header: "SERVICIO_AMORTIZACION", required: false, width: 28 },
      { header: "COMENTARIOS", required: false, width: 28 },
    ];

    worksheet.addRow(columns.map((column) => column.header));

    columns.forEach((column, index) => {
      const cell = worksheet.getRow(1).getCell(index + 1);
      cell.font = {
        bold: Boolean(column.required),
        color: { argb: column.required ? "FF9F1239" : "FF111827" },
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: column.required ? "FFFDE68A" : "FFF3F4F6" },
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FFD1D5DB" } },
        left: { style: "thin", color: { argb: "FFD1D5DB" } },
        bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
        right: { style: "thin", color: { argb: "FFD1D5DB" } },
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      worksheet.getColumn(index + 1).width = column.width;
    });

    worksheet.views = [{ state: "frozen", ySplit: 1 }];

    const instructionsSheet = workbook.addWorksheet("Instrucciones");
    instructionsSheet.getColumn(1).width = 120;
    instructionsSheet.addRow([
      "Los encabezados con * son obligatorios. Estado válido: disponible, asignada, no_devuelta, fuera_servicio, taller, baja. Empresa válida: Pulizia o Pazar.",
    ]);
    instructionsSheet.addRow([
      "Servicios y servicio de amortización deben coincidir exactamente con nombres existentes en el sistema.",
    ]);
    instructionsSheet.addRow([
      "Año debe ser entero. La amortización se hereda del tipo de máquina configurado en Plazos de amortización. Los valores monetarios deben ser numéricos y no negativos.",
    ]);
    instructionsSheet.eachRow((row) => {
      row.getCell(1).alignment = { wrapText: true, vertical: "top" };
      row.getCell(1).font = { color: { argb: "FF374151" } };
    });

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="plantilla_maquinas.xlsx"'
    );
    res.send(buffer);
  } catch (e) {
    console.error("adminDownloadMaquinasTemplate:", e);
    res.status(500).json({ error: "Error generando plantilla de máquinas" });
  }
}

/* ========================================================
   POST /admin/maquinas/import/preview
======================================================== */
export async function adminPreviewImportMaquinas(req, res) {
  const actor = await requireActor(req, res, ["admin"]);
  if (!actor) return;

  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ error: "Debe adjuntar un archivo Excel" });
    }

    if (!req.file.mimetype.includes("sheet") && !String(req.file.originalname || "").toLowerCase().endsWith(".xlsx")) {
      return res.status(400).json({ error: "Archivo inválido. Debe ser .xlsx" });
    }

    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ error: "El archivo supera el máximo permitido de 5 MB" });
    }

    const { resumen } = await parseAndValidateMaquinasImport(req.file.buffer);

    res.json({
      message: `Detectadas ${resumen.detectadas} máquinas`,
      resumen,
      readyToImport: true,
    });
  } catch (e) {
    console.error("adminPreviewImportMaquinas:", e);
    const status = Number(e.status) || 500;
    if (status >= 400 && status < 500) {
      return res.status(status).json({ error: e.message, detalles: e.detalles || [] });
    }
    res.status(500).json({ error: "Error validando importación de máquinas" });
  }
}

/* ========================================================
   POST /admin/maquinas/import/confirm
======================================================== */
export async function adminConfirmImportMaquinas(req, res) {
  const actor = await requireActor(req, res, ["admin"]);
  if (!actor) return;

  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ error: "Debe adjuntar un archivo Excel" });
    }

    if (!req.file.mimetype.includes("sheet") && !String(req.file.originalname || "").toLowerCase().endsWith(".xlsx")) {
      return res.status(400).json({ error: "Archivo inválido. Debe ser .xlsx" });
    }

    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ error: "El archivo supera el máximo permitido de 5 MB" });
    }

    const { normalizedRows, existentesById, resumen } = await parseAndValidateMaquinasImport(req.file.buffer);

    await prisma.$transaction(async (tx) => {
      for (const item of normalizedRows) {
        const exists = existentesById.has(item.id);

        if (!exists) {
          const creada = await tx.maquina.create({
            data: {
              id: item.id,
              tipo: item.tipo,
              tipoMaquinaId: item.tipoMaquinaId,
              modelo: item.modelo,
              serie: item.serie,
              estado: item.estado,
              servicioId: item.servicioId,
              fechaCompra: item.fechaCompra,
              proveedorFactura: item.proveedorFactura,
              empresa: item.empresa,
              anio: item.anio,
              amortizacion: item.amortizacion,
              antiguedad: item.antiguedad,
              valorUsadaDolares: item.valorUsadaDolares,
              valorUsadaPesos: item.valorUsadaPesos,
              valorNuevaDolares: item.valorNuevaDolares,
              valorNuevaPesos: item.valorNuevaPesos,
              origenInfo: item.origenInfo,
              servicioAmortizacionId: item.servicioAmortizacionId,
              comentarios: item.comentarios,
            },
          });

          await insertMaquinaServicioHistorial(tx, {
            maquinaId: creada.id,
            servicioId: creada.servicioId,
            fechaAsignacion: creada.createdAt,
            tipoMovimiento: "individual",
          });

          continue;
        }

        const anterior = await tx.maquina.findUnique({
          where: { id: item.id },
          select: { servicioId: true },
        });

        const actualizada = await tx.maquina.update({
          where: { id: item.id },
          data: {
            tipo: item.tipo,
            tipoMaquinaId: item.tipoMaquinaId,
            modelo: item.modelo,
            serie: item.serie,
            estado: item.estado,
            servicioId: item.servicioId,
            fechaCompra: item.fechaCompra,
            proveedorFactura: item.proveedorFactura,
            empresa: item.empresa,
            anio: item.anio,
            amortizacion: item.amortizacion,
            antiguedad: item.antiguedad,
            valorUsadaDolares: item.valorUsadaDolares,
            valorUsadaPesos: item.valorUsadaPesos,
            valorNuevaDolares: item.valorNuevaDolares,
            valorNuevaPesos: item.valorNuevaPesos,
            origenInfo: item.origenInfo,
            servicioAmortizacionId: item.servicioAmortizacionId,
            comentarios: item.comentarios,
          },
        });

        if (anterior && anterior.servicioId !== item.servicioId) {
          await insertMaquinaServicioHistorial(tx, {
            maquinaId: actualizada.id,
            servicioId: item.servicioId,
            tipoMovimiento: "individual",
          });
        }
      }
    });

    res.status(201).json({
      message: "Importación de máquinas completada",
      resumen,
    });
  } catch (e) {
    console.error("adminConfirmImportMaquinas:", e);
    const status = Number(e.status) || 500;
    if (status >= 400 && status < 500) {
      return res.status(status).json({ error: e.message, detalles: e.detalles || [] });
    }
    res.status(500).json({ error: "Error importando máquinas" });
  }
}
