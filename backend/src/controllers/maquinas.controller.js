import prisma from "../db/prisma.js";

/* ========================================================
   CONSTANTES (FUENTE DE VERDAD)
======================================================== */
const ESTADOS_MAQUINA_VALIDOS = [
  "disponible",
  "asignada",
  "no_devuelta",
  "fuera_servicio",
  "reparacion",
  "baja",
];

const ESTADOS_PEDIDO_INACTIVOS = ["CERRADO", "CANCELADO"];

const MAQUINA_RELATIONS = {
  servicio: true,
  asignaciones: {
    where: {
      pedido: {
        estado: {
          notIn: ESTADOS_PEDIDO_INACTIVOS,
        },
      },
    },
    orderBy: { id: "desc" },
    take: 1,
    include: {
      pedido: {
        include: {
          supervisor: {
            select: {
              username: true,
              nombre: true,
            },
          },
        },
      },
    },
  },
};

/* ========================================================
   HELPERS
======================================================== */
function normalizeEstado(raw) {
  const v = String(raw || "").trim().toLowerCase();

  if (ESTADOS_MAQUINA_VALIDOS.includes(v)) return v;

  if (v === "no devuelta" || v === "nodevuelta") return "no_devuelta";
  if (v === "fuera de servicio") return "fuera_servicio";
  if (v === "en reparacion" || v === "en reparación" || v === "reparación")
    return "reparacion";

  return null;
}

function mapMaquinaResponse(m) {
  const asignacionActiva = m.asignaciones?.[0] ?? null;
  const pedidoActivo = asignacionActiva?.pedido
    ? {
        id: asignacionActiva.pedido.id,
        estado: asignacionActiva.pedido.estado,
        destino: asignacionActiva.pedido.destino,
        supervisor: asignacionActiva.pedido.supervisor?.username ?? null,
        supervisorNombre:
          asignacionActiva.pedido.supervisor?.nombre ??
          asignacionActiva.pedido.supervisor?.username ??
          null,
        titular: asignacionActiva.pedido.supervisorDestinoUsername ?? null,
      }
    : null;

  return {
    id: m.id,
    tipo: m.tipo,
    modelo: m.modelo,
    serie: m.serie,
    estado: m.estado,
    servicioId: m.servicioId,
    servicio: m.servicio?.nombre ?? null,
    pedidoActivo,
  };
}


/* ========================================================
   GET /maquinas
   LISTAR TODAS
======================================================== */
export async function getMaquinas(req, res) {
  try {
    const maquinas = await prisma.maquina.findMany({
      include: MAQUINA_RELATIONS,
      orderBy: { id: "asc" },
    });

    res.json(maquinas.map(mapMaquinaResponse));
  } catch (e) {
    console.error("getMaquinas:", e);
    res.status(500).json({ error: "Error obteniendo máquinas" });
  }
}

/* ========================================================
   GET /maquinas/:id
   OBTENER POR ID
======================================================== */
export async function getMaquinaById(req, res) {
  try {
    const { id } = req.params;

    const maquina = await prisma.maquina.findUnique({
      where: { id },
      include: MAQUINA_RELATIONS,
    });

    if (!maquina) {
      return res.status(404).json({ error: "Máquina no encontrada" });
    }

    res.json(mapMaquinaResponse(maquina));
  } catch (e) {
    console.error("getMaquinaById:", e);
    res.status(500).json({ error: "Error obteniendo máquina" });
  }
}

/* ========================================================
   GET /maquinas/tipo/:tipo
   LISTAR POR TIPO
======================================================== */
export async function getMaquinasPorTipo(req, res) {
  try {
    const tipo = String(req.params.tipo || "").trim();

    if (!tipo) {
      return res.status(400).json({ error: "Tipo requerido" });
    }

    const maquinas = await prisma.maquina.findMany({
      where: {
        tipo: {
          equals: tipo,
          mode: "insensitive",
        },
      },
      include: MAQUINA_RELATIONS,
      orderBy: { id: "asc" },
    });

    res.json(maquinas.map(mapMaquinaResponse));
  } catch (e) {
    console.error("getMaquinasPorTipo:", e);
    res.status(500).json({ error: "Error filtrando máquinas" });
  }
}

/* ========================================================
   PUT /maquinas/:id/estado
   ACTUALIZAR ESTADO
======================================================== */
export async function actualizarEstado(req, res) {
  try {
    const { id } = req.params;
    const { estado } = req.body || {};

    if (!estado) {
      return res.status(400).json({ error: "Estado es obligatorio" });
    }

    const estadoNorm = normalizeEstado(estado);
    if (!estadoNorm) {
      return res.status(400).json({
        error: `Estado inválido. Debe ser uno de: ${ESTADOS_MAQUINA_VALIDOS.join(
          ", "
        )}`,
      });
    }

    const maquina = await prisma.maquina.update({
      where: { id },
      data: { estado: estadoNorm },
      include: { servicio: true },
    });

    res.json({
      message: "Estado actualizado",
      maquina: mapMaquinaResponse(maquina),
    });
  } catch (e) {
    if (e.code === "P2025") {
      return res.status(404).json({ error: "Máquina no encontrada" });
    }
    console.error("actualizarEstado:", e);
    res.status(500).json({ error: "Error actualizando estado" });
  }
}
