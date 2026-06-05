import prisma from "../db/prisma.js";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export async function adminGetSeguros(req, res) {
  try {
    const seguros = await prisma.seguro.findMany({
      include: {
        _count: {
          select: {
            vehiculos: true,
          },
        },
      },
      orderBy: { nombre: "asc" },
    });

    res.json(
      seguros.map((seguro) => ({
        id: seguro.id,
        nombre: seguro.nombre,
        vehiculosCount: seguro._count.vehiculos,
      }))
    );
  } catch (e) {
    console.error("adminGetSeguros:", e);
    res.status(500).json({ error: "Error listando seguros" });
  }
}

export async function adminCreateSeguro(req, res) {
  try {
    const nombre = normalizeString(req.body?.nombre);
    if (!nombre) {
      return res.status(400).json({ error: "El nombre es obligatorio" });
    }

    const existente = await prisma.seguro.findFirst({
      where: { nombre: { equals: nombre } },
    });

    if (existente) {
      return res.status(409).json({ error: "Ya existe un seguro con ese nombre" });
    }

    const seguro = await prisma.seguro.create({ data: { nombre } });
    res.status(201).json(seguro);
  } catch (e) {
    console.error("adminCreateSeguro:", e);
    res.status(500).json({ error: "Error creando seguro" });
  }
}

export async function adminUpdateSeguro(req, res) {
  try {
    const id = Number(req.params.id);
    const nombre = normalizeString(req.body?.nombre);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "ID inválido" });
    }

    if (!nombre) {
      return res.status(400).json({ error: "El nombre es obligatorio" });
    }

    const seguro = await prisma.seguro.findUnique({ where: { id } });
    if (!seguro) {
      return res.status(404).json({ error: "Seguro no encontrado" });
    }

    const duplicado = await prisma.seguro.findFirst({
      where: {
        nombre: { equals: nombre },
        id: { not: id },
      },
    });

    if (duplicado) {
      return res.status(409).json({ error: "Ya existe un seguro con ese nombre" });
    }

    const actualizado = await prisma.seguro.update({
      where: { id },
      data: { nombre },
    });

    res.json(actualizado);
  } catch (e) {
    console.error("adminUpdateSeguro:", e);
    res.status(500).json({ error: "Error actualizando seguro" });
  }
}

export async function adminDeleteSeguro(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const seguro = await prisma.seguro.findUnique({
      where: { id },
      include: {
        _count: {
          select: { vehiculos: true },
        },
      },
    });

    if (!seguro) {
      return res.status(404).json({ error: "Seguro no encontrado" });
    }

    if (seguro._count.vehiculos > 0) {
      return res.status(409).json({ error: "No se puede eliminar un seguro en uso" });
    }

    await prisma.seguro.delete({ where: { id } });
    res.json({ message: "Seguro eliminado" });
  } catch (e) {
    console.error("adminDeleteSeguro:", e);
    res.status(500).json({ error: "Error eliminando seguro" });
  }
}
