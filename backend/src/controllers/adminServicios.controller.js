import prisma from "../db/prisma.js";
import ExcelJS from "exceljs";

/* ========================================================
   HELPERS
======================================================== */
function parseId(raw) {
  const id = Number(raw);
  return Number.isNaN(id) ? null : id;
}

function normalizeNombre(nombre) {
  return String(nombre || "").trim();
}

function normalizeIdBrowix(idBrowix) {
  const normalizado = String(idBrowix || "").trim().toUpperCase();
  return normalizado === "" ? null : normalizado;
}

function normalizeImportHeader(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[.]/g, "")
    .replace(/\s+/g, "_");
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
// actualización) de "celda con contenido" (aplicar el valor).
function hasImportValue(raw) {
  if (raw === undefined || raw === null) return false;
  if (typeof raw === "string") return raw.trim() !== "";
  return true;
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;

  const normalized = String(value || "").trim().toLowerCase();
  if (["1", "si", "sí", "true", "x", "activo"].includes(normalized)) return true;
  if (["0", "no", "false", "inactivo"].includes(normalized)) return false;

  return fallback;
}

/* ========================================================
   GET /admin/servicios
   Lista servicios + cantidad de máquinas
======================================================== */
export async function adminGetServicios(req, res) {
  try {
    const servicios = await prisma.servicio.findMany({
      include: {
        _count: {
          select: { maquinas: true },
        },
      },
      orderBy: { nombre: "asc" },
    });

    res.json(
      servicios.map((s) => ({
        id: s.id,
        nombre: s.nombre,
        idBrowix: s.idBrowix,
        activo: s.activo,
        maquinas: s._count.maquinas,
      }))
    );
  } catch (e) {
    console.error("adminGetServicios:", e);
    res.status(500).json({ error: "Error listando servicios" });
  }
}

/* ========================================================
   GET /admin/servicios/:id
======================================================== */
export async function adminGetServicioById(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "ID de servicio inválido" });
    }

    const servicio = await prisma.servicio.findUnique({
      where: { id },
      include: {
        maquinas: {
          orderBy: [{ tipo: "asc" }, { id: "asc" }],
        },
      },
    });

    if (!servicio || !servicio.activo) {
      return res.status(404).json({ error: "Servicio no encontrado" });
    }

    const maquinasIds = servicio.maquinas.map((m) => m.id);

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
    for (const asignacion of asignacionesActivas) {
      if (!asignacionPorMaquina.has(asignacion.maquinaId)) {
        asignacionPorMaquina.set(asignacion.maquinaId, {
          pedidoId: asignacion.pedido.id,
          estadoPedido: asignacion.pedido.estado,
          destino: asignacion.pedido.destino,
          servicio: asignacion.pedido.servicio,
        });
      }
    }

    res.json({
      ...servicio,
      maquinas: servicio.maquinas.map((maquina) => ({
        ...maquina,
        asignacion: asignacionPorMaquina.get(maquina.id) || null,
      })),
    });
  } catch (e) {
    console.error("adminGetServicioById:", e);
    res.status(500).json({ error: "Error obteniendo servicio" });
  }
}

/* ========================================================
   POST /admin/servicios
======================================================== */
export async function adminCreateServicio(req, res) {
  try {
    const nombre = normalizeNombre(req.body?.nombre);
    const idBrowix = normalizeIdBrowix(req.body?.idBrowix);

    if (!nombre) {
      return res.status(400).json({ error: "Nombre obligatorio" });
    }

    const existe = await prisma.servicio.findUnique({
      where: { nombre },
    });

    if (existe) {
      if (existe.activo) {
        return res.status(409).json({ error: "El servicio ya existe" });
      }

      const reactivado = await prisma.servicio.update({
        where: { id: existe.id },
        data: { activo: true, idBrowix: idBrowix ?? existe.idBrowix },
      });

      return res.status(200).json({
        message: "Servicio reactivado correctamente",
        servicio: reactivado,
      });
    }

    const nuevo = await prisma.servicio.create({
      data: { nombre, idBrowix },
    });

    res.status(201).json({
      message: "Servicio creado correctamente",
      servicio: nuevo,
    });
  } catch (e) {
    console.error("adminCreateServicio:", e);
    res.status(500).json({ error: "Error creando servicio" });
  }
}

/* ========================================================
   PUT /admin/servicios/:id
======================================================== */
export async function adminUpdateServicio(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "ID de servicio inválido" });
    }

    const nombre = normalizeNombre(req.body?.nombre);
    if (!nombre) {
      return res.status(400).json({ error: "Nombre obligatorio" });
    }

    const existe = await prisma.servicio.findUnique({
      where: { id },
    });

    if (!existe || !existe.activo) {
      return res.status(404).json({ error: "Servicio no encontrado" });
    }

    const idBrowixProvided = req.body?.idBrowix !== undefined;
    const data = { nombre };
    if (idBrowixProvided) data.idBrowix = normalizeIdBrowix(req.body.idBrowix);

    const actualizado = await prisma.servicio.update({
      where: { id },
      data,
    });

    res.json({
      message: "Servicio actualizado correctamente",
      servicio: actualizado,
    });
  } catch (e) {
    console.error("adminUpdateServicio:", e);
    res.status(500).json({ error: "Error actualizando servicio" });
  }
}
/* ========================================================
   DELETE /admin/servicios/:id
======================================================== */
export async function adminDeleteServicio(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const servicio = await prisma.servicio.findUnique({
      where: { id },
    });

    if (!servicio) {
      return res.status(404).json({ error: "Servicio no encontrado" });
    }

    if (!servicio.activo) {
      return res.json({ message: "El servicio ya estaba dado de baja" });
    }

    const maquinasAsignadas = await prisma.maquina.count({
      where: { servicioId: id },
    });

    if (maquinasAsignadas > 0) {
      return res.status(409).json({
        error: "No se puede dar de baja un servicio con máquinas asignadas",
      });
    }

    const servicioActualizado = await prisma.servicio.update({
      where: { id },
      data: { activo: false },
    });

    res.json({
      message: "Servicio dado de baja correctamente",
      servicio: {
        id: servicioActualizado.id,
        nombre: servicioActualizado.nombre,
        activo: servicioActualizado.activo,
      },
    });
  } catch (e) {
    console.error("adminDeleteServicio:", e);

    res.status(500).json({ error: "Error dando de baja el servicio" });
  }
}

/* ========================================================
   GET /admin/servicios/export
   Listado general de servicios con su info asociada (conteos)
======================================================== */
export async function adminExportServicios(req, res) {
  try {
    const servicios = await prisma.servicio.findMany({
      include: {
        _count: {
          select: { maquinas: true, supervisores: true, pedidos: true },
        },
      },
      orderBy: { nombre: "asc" },
    });

    const headers = [
      "ID",
      "NOMBRE",
      "ID_BROWIX",
      "ACTIVO",
      "CANTIDAD_MAQUINAS",
      "CANTIDAD_SUPERVISORES",
      "CANTIDAD_PEDIDOS",
    ];

    const rows = servicios.map((s) => [
      s.id,
      s.nombre,
      s.idBrowix || "",
      s.activo ? "SI" : "NO",
      s._count.maquinas,
      s._count.supervisores,
      s._count.pedidos,
    ]);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Servicios");
    worksheet.addRow(headers);
    rows.forEach((row) => worksheet.addRow(row));

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="servicios-${Date.now()}.xlsx"`
    );
    res.send(buffer);
  } catch (e) {
    console.error("adminExportServicios:", e);
    res.status(500).json({ error: "Error exportando servicios" });
  }
}

/* ========================================================
   GET /admin/servicios/import/template
======================================================== */
export async function adminDownloadServiciosTemplate(req, res) {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Servicios");
    worksheet.addRow(["ID", "NOMBRE", "ID_BROWIX", "ACTIVO"]);

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="plantilla_servicios.xlsx"'
    );
    res.send(buffer);
  } catch (e) {
    console.error("adminDownloadServiciosTemplate:", e);
    res.status(500).json({ error: "Error generando plantilla de servicios" });
  }
}

/* ========================================================
   POST /admin/servicios/import
   Actualización masiva por ID. El ID es obligatorio y debe existir
   (los servicios no se crean por esta vía, su ID es autoincremental).
   Cada columna es opcional: celda vacía o columna ausente = no tocar
   ese dato, igual que la importación de vehículos/máquinas.
======================================================== */
export async function adminImportServicios(req, res) {
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

    const preparedRows = rows.map((row, index) => {
      const idRaw = getImportValue(row, "ID");
      const nombreRaw = getImportValue(row, "NOMBRE");
      const idBrowixRaw = getImportValue(row, "ID_BROWIX", "IDBROWIX", "BROWIX");
      const activoRaw = getImportValue(row, "ACTIVO");

      return {
        rowNumber: index + 2,
        id: parseId(idRaw),
        nombre: normalizeNombre(nombreRaw),
        nombreProvided: hasImportValue(nombreRaw),
        idBrowix: normalizeIdBrowix(idBrowixRaw),
        idBrowixProvided: hasImportValue(idBrowixRaw),
        activo: normalizeBoolean(activoRaw, true),
        activoProvided: hasImportValue(activoRaw),
      };
    });

    // Duplicados dentro del propio archivo.
    const erroresArchivo = [];
    const idsSeen = new Set();
    const nombresSeen = new Set();

    for (const item of preparedRows) {
      if (!item.id) erroresArchivo.push(`Fila ${item.rowNumber}: ID obligatorio y numérico`);

      if (item.id) {
        if (idsSeen.has(item.id)) erroresArchivo.push(`ID duplicado en archivo: ${item.id}`);
        idsSeen.add(item.id);
      }

      if (item.nombreProvided) {
        const nombreUpper = item.nombre.toUpperCase();
        if (nombresSeen.has(nombreUpper)) erroresArchivo.push(`NOMBRE duplicado en archivo: ${item.nombre}`);
        nombresSeen.add(nombreUpper);
      }
    }

    if (erroresArchivo.length > 0) {
      return res.status(400).json({ error: "El archivo tiene errores de validación", detalles: erroresArchivo });
    }

    const [existentes, nombresExistentes] = await Promise.all([
      prisma.servicio.findMany({
        where: { id: { in: preparedRows.map((item) => item.id).filter(Boolean) } },
      }),
      prisma.servicio.findMany({
        where: { nombre: { in: preparedRows.filter((item) => item.nombreProvided).map((item) => item.nombre) } },
        select: { id: true, nombre: true },
      }),
    ]);

    const existingById = new Map(existentes.map((item) => [item.id, item]));
    const existingByNombre = new Map(nombresExistentes.map((item) => [item.nombre.toUpperCase(), item]));

    const errores = [];
    for (const item of preparedRows) {
      const existente = existingById.get(item.id) || null;
      item.existente = existente;

      if (!existente) {
        errores.push(`Fila ${item.rowNumber}: no existe un servicio con ID ${item.id}`);
        continue;
      }

      if (item.nombreProvided) {
        const colision = existingByNombre.get(item.nombre.toUpperCase());
        if (colision && colision.id !== item.id) {
          errores.push(`Fila ${item.rowNumber}: el nombre "${item.nombre}" ya pertenece al servicio ${colision.id}`);
        }
      }

      if (item.activoProvided && item.activo === false) {
        const maquinasAsignadas = existente ? await prisma.maquina.count({ where: { servicioId: item.id } }) : 0;
        if (maquinasAsignadas > 0) {
          errores.push(`Fila ${item.rowNumber}: no se puede dar de baja el servicio ${item.id}, tiene máquinas asignadas`);
        }
      }
    }

    if (errores.length > 0) {
      return res.status(409).json({ error: "La importación fue rechazada", detalles: errores });
    }

    let actualizados = 0;

    await prisma.$transaction(async (tx) => {
      for (const item of preparedRows) {
        const data = {};
        if (item.nombreProvided) data.nombre = item.nombre;
        if (item.idBrowixProvided) data.idBrowix = item.idBrowix;
        if (item.activoProvided) data.activo = item.activo;

        if (Object.keys(data).length === 0) continue;

        await tx.servicio.update({ where: { id: item.id }, data });
        actualizados += 1;
      }
    });

    res.status(200).json({
      message: "Servicios importados correctamente",
      total: preparedRows.length,
      actualizados,
    });
  } catch (e) {
    console.error("adminImportServicios:", e);
    res.status(500).json({ error: "Error importando servicios" });
  }
}
