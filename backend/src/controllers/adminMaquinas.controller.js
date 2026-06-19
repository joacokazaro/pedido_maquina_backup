import prisma from "../db/prisma.js";
import xlsx from "xlsx";

/* ========================================================
   CONSTANTES
======================================================== */
const ESTADO_PEDIDO_CERRADO = "CERRADO";

const ESTADOS_MAQUINA_VALIDOS = [
  "disponible",
  "asignada",
  "no_devuelta",
  "fuera_servicio",
  "reparacion",
  "baja",
];

const EMPRESAS_VALIDAS = ["Pulizia", "Pazar"];

/* ========================================================
   NORMALIZAR ESTADO DE MÁQUINA
   (FUENTE ÚNICA DE VERDAD)
======================================================== */
function normalizeEstado(raw) {
  const v = String(raw || "").trim().toLowerCase();

  if (ESTADOS_MAQUINA_VALIDOS.includes(v)) return v;

  if (v === "no devuelta" || v === "nodevuelta") return "no_devuelta";
  if (v === "fuera de servicio") return "fuera_servicio";
  if (
    v === "en reparacion" ||
    v === "en reparación" ||
    v === "reparación"
  )
    return "reparacion";

  return "disponible";
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
        kit: {
          maquinas: {
            some: {
              maquinaId: id,
            },
          },
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
        kit: {
          select: {
            id: true,
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
        estado: maquina.estado,
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
      select: { id: true, nombre: true },
    });

    if (!servicioDestino) {
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
          reparacion: 0,
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
