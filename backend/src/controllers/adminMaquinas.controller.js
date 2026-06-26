import prisma from "../db/prisma.js";
import xlsx from "xlsx";
import ExcelJS from "exceljs";
import { requireActor } from "../services/requestActor.service.js";
import {
  ESTADOS_MAQUINA_VALIDOS,
  canonicalEstadoMaquina,
  normalizeEstadoMaquina,
} from "../services/inventarioEstados.service.js";

/* ========================================================
   CONSTANTES
======================================================== */
const ESTADO_PEDIDO_CERRADO = "CERRADO";

const EMPRESAS_VALIDAS = ["Pulizia", "Pazar"];

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
    prisma.tipoMaquina.findMany({ select: { nombre: true } }),
    prisma.maquina.findMany({
      where: { id: { in: parsedRows.map((item) => item.id).filter(Boolean) } },
      select: { id: true, servicioId: true },
    }),
  ]);

  const servicioByName = new Map(
    servicios.map((s) => [String(s.nombre || "").trim().toLowerCase(), s])
  );
  const tipoSet = new Set(
    tipos.map((t) => String(t.nombre || "").trim().toLowerCase())
  );
  const existentesById = new Map(existentes.map((m) => [m.id, m]));

  const normalizedRows = [];

  for (const item of parsedRows) {
    try {
      const tipoNorm = normalizeTipoMaquina(item.tipo);
      if (!tipoSet.has(tipoNorm.toLowerCase())) {
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
        modelo: item.modelo,
        serie: parseNullableString(item.serie),
        estado,
        servicioId: servicio.id,
        fechaCompra,
        proveedorFactura: parseNullableString(item.proveedorFactura),
        empresa,
        anio,
        amortizacion,
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

async function findTipoMaquinaByNombre(nombre) {
  const tipos = await prisma.tipoMaquina.findMany();
  return tipos.find((tipo) => tipo.nombre.toLowerCase() === nombre.toLowerCase()) || null;
}

async function assertTipoMaquinaExists(nombre) {
  const normalized = normalizeTipoMaquina(nombre);
  if (!normalized) {
    throw new Error("Tipo de máquina obligatorio");
  }

  const tipo = await findTipoMaquinaByNombre(normalized);
  if (!tipo) {
    throw new Error("Tipo de máquina inválido. Crealo desde Tipos de máquinas.");
  }

  return tipo.nombre;
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
    const [tipos, usados] = await Promise.all([
      prisma.tipoMaquina.findMany({
        orderBy: { nombre: "asc" },
      }),
      prisma.maquina.groupBy({
        by: ["tipo"],
        _count: { tipo: true },
      }),
    ]);

    const countByTipo = new Map(
      usados.map((item) => [item.tipo, item._count.tipo])
    );

    res.json(
      tipos.map((tipo) => ({
        id: tipo.id,
        nombre: tipo.nombre,
        maquinasCount: countByTipo.get(tipo.nombre) || 0,
      }))
    );
  } catch (e) {
    console.error("adminGetTiposMaquina:", e);
    res.status(500).json({ error: "Error listando tipos de máquinas" });
  }
}

export async function adminCreateTipoMaquina(req, res) {
  try {
    const nombre = normalizeTipoMaquina(req.body?.nombre);
    if (!nombre) {
      return res.status(400).json({ error: "Nombre obligatorio" });
    }

    const existente = await findTipoMaquinaByNombre(nombre);
    if (existente) {
      return res.status(409).json({ error: "Ya existe un tipo con ese nombre" });
    }

    const tipo = await prisma.tipoMaquina.create({ data: { nombre } });
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

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "ID inválido" });
    }

    if (!nombre) {
      return res.status(400).json({ error: "Nombre obligatorio" });
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
        data: { nombre },
      });

      if (tipo.nombre !== nombre) {
        await tx.maquina.updateMany({
          where: { tipo: tipo.nombre },
          data: { tipo: nombre },
        });
      }

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

    const maquinasCount = await prisma.maquina.count({
      where: { tipo: tipo.nombre },
    });

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

/* ========================================================
   GET /admin/maquinas
======================================================== */
export async function adminGetMaquinas(req, res) {
  try {
    const { tipo, estado, search } = req.query;
    const where = {};

    if (tipo && String(tipo).trim() !== "") {
      where.tipo = String(tipo);
    }

    if (estado) {
      where.estado = normalizeEstado(estado);
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

    const result = maquinas.map((m) => ({
      ...m,
      estado: canonicalEstadoMaquina(m.estado),
      asignacion: asignacionPorMaquina.get(m.id) || null,
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
      },
    });

    if (!maquina) {
      return res.status(404).json({ error: "Máquina no encontrada" });
    }

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

    res.json({
      ...maquina,
      estado: canonicalEstadoMaquina(maquina.estado),
      asignacion: pedidoActual
        ? {
            pedidoId: pedidoActual.id,
            servicio: pedidoActual.servicio?.nombre ?? null,
            estadoPedido: pedidoActual.estado,
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
      },
    });

    if (!maquina) {
      return res.status(404).json({ error: "Máquina no encontrada" });
    }

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
          contains: `\"tipo\":\"${maquina.tipo}\"`,
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
        tipo: maquina.tipo,
        modelo: maquina.modelo,
        serie: maquina.serie,
        estado: canonicalEstadoMaquina(maquina.estado),
        fechaCompra: maquina.fechaCompra,
        proveedorFactura: maquina.proveedorFactura,
        empresa: maquina.empresa,
        anio: maquina.anio,
        amortizacion: maquina.amortizacion,
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
      amortizacion,
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
    const amortizacionParsed = parseNullableInt(amortizacion, "Amortización");
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

    const tipoNormalizado = await assertTipoMaquinaExists(tipo);

    const nueva = await prisma.maquina.create({
      data: {
        id: String(id),
        tipo: tipoNormalizado,
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
        amortizacion: amortizacionParsed,
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
      amortizacion,
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

    const tipoNormalizado =
      tipo !== undefined && String(tipo).trim() !== ""
        ? await assertTipoMaquinaExists(tipo)
        : existe.tipo;

    const actualizada = await prisma.maquina.update({
      where: { id },
      data: {
        tipo: tipoNormalizado,

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

        amortizacion:
          amortizacion !== undefined
            ? parseNullableInt(amortizacion, "Amortización")
            : existe.amortizacion,

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
      "Año y amortización deben ser enteros. Los valores monetarios deben ser numéricos y no negativos.",
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
