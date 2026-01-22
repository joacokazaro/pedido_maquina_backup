import prisma from "../db/prisma.js";

/* ========================================================
   GET /notificaciones?username=&soloNoLeidas=1
======================================================== */
export async function getNotificaciones(req, res) {
  try {
    const { username, soloNoLeidas } = req.query || {};

    if (!username) {
      return res.status(400).json({ error: "username requerido" });
    }

    const user = await prisma.usuario.findUnique({
      where: { username: String(username) },
      select: { id: true, username: true },
    });

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const where = {
      usuarioId: user.id,
    };

    if (soloNoLeidas === "1") {
      where.leida = false;
    }

    const notificaciones = await prisma.notificacion.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    res.json(notificaciones);
  } catch (e) {
    console.error("getNotificaciones:", e);
    res.status(500).json({ error: "Error obteniendo notificaciones" });
  }
}

/* ========================================================
   PUT /notificaciones/:id/leida
======================================================== */
export async function marcarNotificacionLeida(req, res) {
  try {
    const id = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const result = await prisma.notificacion.updateMany({
      where: { id },
      data: { leida: true },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: "Notificación no encontrada" });
    }

    const notificacion = await prisma.notificacion.findUnique({
      where: { id },
    });

    res.json({ message: "Notificación marcada como leída", notificacion });
  } catch (e) {
    console.error("marcarNotificacionLeida:", e?.message || e);
    res.status(500).json({ error: "Error marcando notificación" });
  }
}
