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
  return {
    id: m.id,
    tipo: m.tipo,
    modelo: m.modelo,
    serie: m.serie,
    estado: m.estado,
    servicio: m.servicio?.nombre ?? null,
  };
}

/* ========================================================
   GET /maquinas
   LISTAR TODAS
======================================================== */
export async function getMaquinas(req, res) {
  try {
    const maquinas = await prisma.maquina.findMany({
      include: { servicio: true },
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
      include: { servicio: true },
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
      include: { servicio: true },
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
