import prisma from "../db/prisma.js";

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
      },
      orderBy: [{ tipo: "asc" }, { id: "asc" }],
    });

    res.json(maquinas);
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
      },
    });

    if (!maquina) {
      return res.status(404).json({ error: "Máquina no encontrada" });
    }

    // 🔑 Pedido actual (no cerrado) más reciente
    const pedidoActual = await prisma.pedido.findFirst({
      where: {
        estado: { not: ESTADO_PEDIDO_CERRADO },
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
   POST /admin/maquinas
======================================================== */
export async function adminCreateMaquina(req, res) {
  try {
    const { id, tipo, modelo, serie, estado, servicioId } = req.body || {};

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

    const nueva = await prisma.maquina.create({
      data: {
        id: String(id),
        tipo: String(tipo),
        modelo: String(modelo),
        serie:
          serie !== undefined && String(serie).trim() !== ""
            ? String(serie)
            : null,
        estado: normalizeEstado(estado),
        servicioId: Number(servicioId),
      },
    });

    res.status(201).json({
      message: "Máquina creada correctamente",
      maquina: nueva,
    });
  } catch (e) {
    console.error("adminCreateMaquina:", e);
    res.status(500).json({ error: "Error creando máquina" });
  }
}

/* ========================================================
   PUT /admin/maquinas/:id
======================================================== */
export async function adminUpdateMaquina(req, res) {
  try {
    const { id } = req.params;
    const { tipo, modelo, serie, estado, servicioId } = req.body || {};

    const existe = await prisma.maquina.findUnique({ where: { id } });
    if (!existe) {
      return res.status(404).json({ error: "Máquina no encontrada" });
    }

    const actualizada = await prisma.maquina.update({
      where: { id },
      data: {
        tipo:
          tipo !== undefined && String(tipo).trim() !== ""
            ? String(tipo)
            : existe.tipo,

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

        servicioId:
          servicioId !== undefined
            ? Number(servicioId)
            : existe.servicioId,
      },
    });

    res.json({
      message: "Máquina actualizada correctamente",
      maquina: actualizada,
    });
  } catch (e) {
    console.error("adminUpdateMaquina:", e);
    res.status(500).json({ error: "Error actualizando máquina" });
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
