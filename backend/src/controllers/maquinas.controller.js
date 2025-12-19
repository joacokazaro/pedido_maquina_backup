// backend/src/controllers/maquinas.controller.js
import prisma from "../db/prisma.js";
import { EstadoMaquina } from "@prisma/client";

/* ========================================================
   LISTAR TODAS
======================================================== */
export async function getMaquinas(req, res) {
  try {
    const maquinas = await prisma.maquina.findMany({
      include: { servicio: true },
      orderBy: { id: "asc" },
    });

    const out = maquinas.map(m => ({
      id: m.id,
      tipo: m.tipo,
      modelo: m.modelo,
      serie: m.serie,
      estado: m.estado,
      servicio: m.servicio?.nombre,
    }));

    res.json(out);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error obteniendo máquinas" });
  }
}

/* ========================================================
   OBTENER POR ID
======================================================== */
export async function getMaquinaById(req, res) {
  try {
    const maquina = await prisma.maquina.findUnique({
      where: { id: req.params.id },
      include: { servicio: true },
    });

    if (!maquina) {
      return res.status(404).json({ error: "Máquina no encontrada" });
    }

    res.json({
      id: maquina.id,
      tipo: maquina.tipo,
      modelo: maquina.modelo,
      serie: maquina.serie,
      estado: maquina.estado,
      servicio: maquina.servicio?.nombre,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error obteniendo máquina" });
  }
}

/* ========================================================
   LISTAR POR TIPO
======================================================== */
export async function getMaquinasPorTipo(req, res) {
  try {
    const tipo = String(req.params.tipo).toLowerCase();

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

    const out = maquinas.map(m => ({
      id: m.id,
      tipo: m.tipo,
      modelo: m.modelo,
      serie: m.serie,
      estado: m.estado,
      servicio: m.servicio?.nombre,
    }));

    res.json(out);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error filtrando máquinas" });
  }
}

/* ========================================================
   ACTUALIZAR ESTADO
======================================================== */
export async function actualizarEstado(req, res) {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!estado) {
      return res.status(400).json({ error: "Estado es obligatorio" });
    }

    if (!Object.values(EstadoMaquina).includes(estado)) {
      return res.status(400).json({
        error: `Estado inválido. Debe ser uno de: ${Object.values(EstadoMaquina).join(", ")}`,
      });
    }

    const maquina = await prisma.maquina.update({
      where: { id },
      data: { estado },
      include: { servicio: true },
    });

    res.json({
      message: "Estado actualizado",
      maquina: {
        id: maquina.id,
        tipo: maquina.tipo,
        modelo: maquina.modelo,
        serie: maquina.serie,
        estado: maquina.estado,
        servicio: maquina.servicio?.nombre,
      },
    });
  } catch (e) {
    if (e.code === "P2025") {
      return res.status(404).json({ error: "Máquina no encontrada" });
    }
    console.error(e);
    res.status(500).json({ error: "Error actualizando estado" });
  }
}
