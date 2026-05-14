import prisma from "../db/prisma.js";
import { ESTADOS_PEDIDO } from "../constants/estadosPedidos.js";

const TIPO_NOTIFICACION_PRESTAMO_PROLONGADO = "PRESTAMO_PROLONGADO";

// Cambiando solo este valor definis cada cuánto se vuelve a avisar.
const INTERVALO_ALERTA_PRESTAMO_MINUTOS = 15 * 24 * 60;
// Para probar cada 15 minutos: const INTERVALO_ALERTA_PRESTAMO_MINUTOS = 15;
// Para producción cada 15 días: const INTERVALO_ALERTA_PRESTAMO_MINUTOS = 15 * 24 * 60;

const INTERVALO_ALERTA_PRESTAMO_MS =
  INTERVALO_ALERTA_PRESTAMO_MINUTOS * 60 * 1000;

let monitorPrestamosInterval = null;

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

function emitirNotificaciones(io, notificaciones, userMap) {
  if (!io) return;

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

function formatDuracionPrestamo(elapsedMs) {
  const totalMinutes = Math.max(1, Math.floor(elapsedMs / (60 * 1000)));

  if (totalMinutes < 60) {
    return `${totalMinutes} minuto${totalMinutes === 1 ? "" : "s"}`;
  }

  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours < 48) {
    return `${totalHours} hora${totalHours === 1 ? "" : "s"}`;
  }

  const totalDays = Math.floor(totalHours / 24);
  return `${totalDays} dia${totalDays === 1 ? "" : "s"}`;
}

async function crearAlertasPrestamoProlongado({ io, now = new Date() } = {}) {
  const depositoIds = await getUsuariosDepositoIds();
  if (depositoIds.length === 0) return 0;

  const pedidosEntregados = await prisma.pedido.findMany({
    where: {
      estado: ESTADOS_PEDIDO.ENTREGADO,
      destino: "DEPOSITO",
    },
    select: {
      id: true,
      estado: true,
      supervisor: {
        select: {
          username: true,
          nombre: true,
        },
      },
      asignadas: { select: { id: true } },
      historial: {
        where: { accion: "ENTREGADO" },
        orderBy: { fecha: "desc" },
        take: 1,
      },
    },
  });

  let creadas = 0;

  for (const pedido of pedidosEntregados) {
    const fechaEntrega = pedido.historial[0]?.fecha;
    if (!fechaEntrega) continue;

    const elapsedMs = now.getTime() - fechaEntrega.getTime();
    if (elapsedMs < INTERVALO_ALERTA_PRESTAMO_MS) continue;

    const existentes = await prisma.notificacion.findMany({
      where: {
        usuarioId: { in: depositoIds },
        pedidoId: pedido.id,
        tipo: TIPO_NOTIFICACION_PRESTAMO_PROLONGADO,
      },
      select: { usuarioId: true },
    });

    if (existentes.length > 0) continue;

    const cantidadMaquinas = pedido.asignadas.length;
    const supervisorDestino =
      pedido.supervisor?.nombre || pedido.supervisor?.username || "supervisor";
    const mensaje = `Pedido ${pedido.id}: ${cantidadMaquinas} maquina${cantidadMaquinas === 1 ? "" : "s"} entregada${cantidadMaquinas === 1 ? "" : "s"} a ${supervisorDestino} hace ${formatDuracionPrestamo(elapsedMs)}.`;

    const notificaciones = await crearNotificacionesParaUsuarios({
      io,
      usuarioIds: depositoIds,
      pedidoId: pedido.id,
      tipo: TIPO_NOTIFICACION_PRESTAMO_PROLONGADO,
      estado: pedido.estado,
      mensaje,
    });

    creadas += notificaciones.length;
  }

  return creadas;
}

export function iniciarMonitorPrestamosProlongados({ io }) {
  if (monitorPrestamosInterval) return monitorPrestamosInterval;

  const frecuenciaChequeoMs = Math.min(INTERVALO_ALERTA_PRESTAMO_MS, 60 * 1000);

  const ejecutar = async () => {
    try {
      await crearAlertasPrestamoProlongado({ io });
    } catch (error) {
      console.error("Error creando alertas de préstamos prolongados:", error);
    }
  };

  ejecutar();
  monitorPrestamosInterval = setInterval(ejecutar, frecuenciaChequeoMs);

  return monitorPrestamosInterval;
}

export async function crearNotificacionesParaUsuarios({
  req,
  io: ioParam = null,
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

  const io = ioParam ?? getIo(req);
  emitirNotificaciones(io, notificaciones, userMap);

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
