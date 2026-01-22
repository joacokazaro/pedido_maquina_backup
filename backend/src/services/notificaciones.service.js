import prisma from "../db/prisma.js";

/* ========================================================
   HELPERS
======================================================== */
function getIo(req) {
  try {
    return req?.app?.get?.("io");
  } catch {
    return null;
  }
}

export async function crearNotificacionesParaUsuarios({
  req,
  usuarioIds,
  pedidoId = null,
  tipo,
  estado = null,
  mensaje,
}) {
  if (!Array.isArray(usuarioIds) || usuarioIds.length === 0) return [];

  const uniqueIds = [...new Set(usuarioIds)].filter(Boolean);
  if (uniqueIds.length === 0) return [];

  const usuarios = await prisma.usuario.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, username: true },
  });

  const userMap = new Map(usuarios.map((u) => [u.id, u.username]));

  const notificaciones = await prisma.$transaction(
    uniqueIds.map((usuarioId) =>
      prisma.notificacion.create({
        data: {
          usuarioId,
          pedidoId,
          tipo,
          estado,
          mensaje,
        },
      })
    )
  );

  const io = getIo(req);
  if (io) {
    notificaciones.forEach((n) => {
      const username = userMap.get(n.usuarioId);
      if (!username) return;

      io.to(`USER:${username}`).emit("notificacion:created", {
        id: n.id,
        usuarioId: n.usuarioId,
        username,
        pedidoId: n.pedidoId,
        tipo: n.tipo,
        estado: n.estado,
        mensaje: n.mensaje,
        leida: n.leida,
        createdAt: n.createdAt,
      });
    });
  }

  return notificaciones;
}

export async function getUsuariosDepositoIds() {
  const depositos = await prisma.usuario.findMany({
    where: { rol: "deposito", activo: true },
    select: { id: true },
  });
  return depositos.map((u) => u.id);
}

export async function getUsuariosAdminIds() {
  const admins = await prisma.usuario.findMany({
    where: { rol: "admin", activo: true },
    select: { id: true },
  });
  return admins.map((u) => u.id);
}
