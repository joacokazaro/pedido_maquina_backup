import prisma from "../db/prisma.js";
import {
  ESTADOS_PEDIDO,
  ESTADOS_PEDIDO_VALIDOS,
  normalizeEstadoPedido,
} from "../constants/estadosPedidos.js";

/* ========================================================
   HELPERS
======================================================== */
async function getUsuarioByUsername(username) {
  if (!username) return null;
  return prisma.usuario.findUnique({ where: { username } });
}

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function mapPedidoParaFront(p) {
  return {
    ...p,

    // =========================
    // DESTINO / TITULAR
    // =========================
    destino: p.destino,

    titular:
      p.destino === "SUPERVISOR"
        ? p.supervisorDestinoUsername
        : "DEPÓSITO",

    // =========================
    // SOLICITANTE
    // =========================
    supervisor: p.supervisor?.username ?? null,

    servicio: p.servicio?.nombre ?? null,
    itemsSolicitados: safeParse(p.itemsSolicitados, []),
    itemsDevueltos: safeParse(p.itemsDevueltos, []),

    itemsAsignados: (p.asignadas || []).map(a => ({
      id: a.maquina.id,
      tipo: a.maquina.tipo,
      modelo: a.maquina.modelo,
      serie: a.maquina.serie,
    })),

    historial: (p.historial || []).map(h => ({
      accion: h.accion,
      fecha: h.fecha,
      detalle: safeParse(h.detalle, null),
      usuario: h.usuario?.username ?? "—",
    })),
  };
}

/* ========================================================
   CREAR PEDIDO
======================================================== */
export async function crearPedido(req, res) {
  try {
    const {
      supervisorUsername,
      itemsSolicitados,
      observacion,
      servicioId,

      // NUEVO
      destino = "DEPOSITO",
      supervisorDestinoUsername,
    } = req.body || {};


    if (!supervisorUsername)
      return res.status(400).json({ error: "Falta supervisorUsername" });

    if (!Array.isArray(itemsSolicitados) || itemsSolicitados.length === 0)
      return res.status(400).json({ error: "Faltan itemsSolicitados" });

    if (!servicioId)
      return res.status(400).json({ error: "Falta servicioId" });

    const supervisor = await prisma.usuario.findUnique({
      where: { username: supervisorUsername },
    });
    if (!supervisor)
      return res.status(404).json({ error: "Supervisor no encontrado" });

    const servicio = await prisma.servicio.findUnique({
      where: { id: Number(servicioId) },
    });
    if (!servicio)
      return res.status(404).json({ error: "Servicio no encontrado" });

    if (!["DEPOSITO", "SUPERVISOR"].includes(destino)) {
  return res.status(400).json({ error: "Destino inválido" });
}

if (destino === "SUPERVISOR" && !supervisorDestinoUsername) {
  return res
    .status(400)
    .json({ error: "Falta supervisor destino" });
}


    // ✅ Validar que el supervisor tenga asignado ese servicio
const asignacion = await prisma.usuarioServicio.findUnique({
  where: {
    usuarioId_servicioId: {
      usuarioId: supervisor.id,
      servicioId: servicio.id,
    },
  },
});

if (!asignacion) {
  return res.status(403).json({
    error: "No tenés permisos para crear pedidos para ese servicio",
  });
}


    const count = await prisma.pedido.count();
    const id = `P-${String(count + 1).padStart(4, "0")}`;

    const pedido = await prisma.pedido.create({
  data: {
    id,
    estado: ESTADOS_PEDIDO.PENDIENTE_PREPARACION,
    observacion: observacion || null,
    itemsSolicitados: JSON.stringify(itemsSolicitados),
    itemsDevueltos: null,

    supervisorId: supervisor.id,
    servicioId: servicio.id,

    // 🔽 NUEVO
    destino,
    supervisorDestinoUsername:
      destino === "SUPERVISOR" ? supervisorDestinoUsername : null,

    historial: {
      create: {
        accion: "CREADO",
        usuarioId: supervisor.id,
        detalle: observacion
          ? JSON.stringify({ observacion })
          : null,
      },
    },
  },
  include: {
    supervisor: true,
    servicio: true,
    asignadas: { include: { maquina: true } },
    historial: { include: { usuario: true }, orderBy: { fecha: "asc" } },
  },
});


    res.status(201).json({
      message: "Pedido creado correctamente",
      pedido: mapPedidoParaFront(pedido),
    });
  } catch (e) {
    console.error("❌ crearPedido:", e);
    res.status(500).json({ error: "Error creando pedido" });
  }
}

/* ========================================================
   LISTAR TODOS
======================================================== */
export async function getPedidos(req, res) {
  const pedidos = await prisma.pedido.findMany({
    include: {
      supervisor: true,
      servicio: true,
      asignadas: { include: { maquina: true } },
      historial: { include: { usuario: true }, orderBy: { fecha: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json(pedidos.map(mapPedidoParaFront));
}

/* ========================================================
   LISTAR POR SUPERVISOR
======================================================== */
export async function getPedidosSupervisor(req, res) {
  const supervisor = await getUsuarioByUsername(req.params.supervisorId);
  if (!supervisor) return res.json([]);

  const pedidos = await prisma.pedido.findMany({
    where: { supervisorId: supervisor.id },
    include: {
      supervisor: true,
      servicio: true,
      asignadas: { include: { maquina: true } },
      historial: { include: { usuario: true }, orderBy: { fecha: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json(pedidos.map(mapPedidoParaFront));
}

/* ========================================================
   OBTENER POR ID
======================================================== */
export async function getPedidoById(req, res) {
  const pedido = await prisma.pedido.findUnique({
    where: { id: req.params.id },
    include: {
      supervisor: true,
      servicio: true,
      asignadas: { include: { maquina: true } },
      historial: { include: { usuario: true }, orderBy: { fecha: "asc" } },
    },
  });

  if (!pedido)
    return res.status(404).json({ error: "Pedido no encontrado" });

  res.json(mapPedidoParaFront(pedido));
}

/* ========================================================
   ACTUALIZAR ESTADO (GENÉRICO)
======================================================== */
export async function actualizarEstadoPedido(req, res) {
  try {
    const { id } = req.params;
    const { estado, usuario, observacion } = req.body;

    const u = await getUsuarioByUsername(usuario);
    if (!u) return res.status(404).json({ error: "Usuario no encontrado" });

    const estadoNorm = normalizeEstadoPedido(estado);
    if (!ESTADOS_PEDIDO_VALIDOS.includes(estadoNorm))
      return res.status(400).json({ error: "Estado inválido" });

    const pedido = await prisma.pedido.update({
      where: { id },
      data: {
        estado: estadoNorm,
        historial: {
          create: {
            accion: "ESTADO_ACTUALIZADO",
            usuarioId: u.id,
            detalle: JSON.stringify({
              nuevoEstado: estadoNorm,
              ...(observacion ? { observacion } : {}),
            }),
          },
        },
      },
      include: {
        supervisor: true,
        servicio: true,
        asignadas: { include: { maquina: true } },
        historial: { include: { usuario: true }, orderBy: { fecha: "asc" } },
      },
    });

    res.json({
      message: "Estado actualizado",
      pedido: mapPedidoParaFront(pedido),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error actualizando estado" });
  }
}

/* ========================================================
   MARCAR ENTREGADO
======================================================== */
export async function marcarEntregado(req, res) {
  try {
    const { id } = req.params;
    const { usuario, observacion } = req.body;

    const u = await getUsuarioByUsername(usuario);
    if (!u) return res.status(404).json({ error: "Usuario no encontrado" });

    const pedidoActual = await prisma.pedido.findUnique({ where: { id } });
    if (!pedidoActual)
      return res.status(404).json({ error: "Pedido no encontrado" });

    if (pedidoActual.estado !== ESTADOS_PEDIDO.PREPARADO)
      return res.status(400).json({ error: "Debe estar PREPARADO" });

    const pedido = await prisma.pedido.update({
      where: { id },
      data: {
        estado: ESTADOS_PEDIDO.ENTREGADO,
        historial: {
          create: {
            accion: "ENTREGADO",
            usuarioId: u.id,
            detalle: observacion ? JSON.stringify({ observacion }) : null,
          },
        },
      },
      include: {
        supervisor: true,
        servicio: true,
        asignadas: { include: { maquina: true } },
        historial: { include: { usuario: true }, orderBy: { fecha: "asc" } },
      },
    });

    res.json({
      message: "Pedido marcado como ENTREGADO",
      pedido: mapPedidoParaFront(pedido),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error marcando entregado" });
  }
}

/* ========================================================
   ASIGNAR MÁQUINAS
======================================================== */
export async function asignarMaquinas(req, res) {
  try {
    const { id } = req.params;
    const { asignadas, justificacion, usuario } = req.body;

    const u = await getUsuarioByUsername(usuario);
    if (!u) return res.status(404).json({ error: "Usuario no encontrado" });

    if (!Array.isArray(asignadas) || asignadas.length === 0)
      return res.status(400).json({ error: "Debe enviar máquinas" });

    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: { asignadas: true },
    });
    if (!pedido)
      return res.status(404).json({ error: "Pedido no encontrado" });

    const solicitado = safeParse(pedido.itemsSolicitados, []);
    const solicitadoMap = {};
    solicitado.forEach(i => {
      solicitadoMap[i.tipo] = i.cantidad;
    });

    const maquinas = await prisma.maquina.findMany({
      where: { id: { in: asignadas } },
    });

    const asignadoPorTipo = {};
    maquinas.forEach(m => {
      asignadoPorTipo[m.tipo] = (asignadoPorTipo[m.tipo] || 0) + 1;
    });

    const requiereJustificacion = Object.keys(solicitadoMap).some(
      t => (asignadoPorTipo[t] || 0) !== solicitadoMap[t]
    );

    if (requiereJustificacion && !justificacion)
      return res.status(400).json({ error: "Requiere justificación" });

    const pedidoActualizado = await prisma.$transaction(async tx => {
      await tx.pedidoMaquina.deleteMany({ where: { pedidoId: id } });

     for (const mid of asignadas) {
  await tx.pedidoMaquina.create({
    data: {
      pedidoId: id,
      maquinaId: mid,
    },
  });
}

      await tx.maquina.updateMany({
        where: { id: { in: asignadas } },
        data: { estado: "asignada" },
      });

      return tx.pedido.update({
        where: { id },
        data: {
          estado: ESTADOS_PEDIDO.PREPARADO,
          historial: {
            create: {
              accion: "MAQUINAS_ASIGNADAS",
              usuarioId: u.id,
              detalle: JSON.stringify({
                solicitado: solicitadoMap,
                asignadoPorTipo,
                ...(requiereJustificacion ? { justificacion } : {}),
              }),
            },
          },
        },
        include: {
          supervisor: true,
          servicio: true,
          asignadas: { include: { maquina: true } },
          historial: { include: { usuario: true }, orderBy: { fecha: "asc" } },
        },
      });
    });

    res.json({
      message: "Máquinas asignadas",
      pedido: mapPedidoParaFront(pedidoActualizado),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error asignando máquinas" });
  }
}

/* ========================================================
   DEVOLUCIÓN SUPERVISOR
======================================================== */
export async function registrarDevolucion(req, res) {
  try {
    const { id } = req.params;
    const { devueltas = [], justificacion, usuario } = req.body;

    const u = await getUsuarioByUsername(usuario);
    if (!u) return res.status(404).json({ error: "Usuario no encontrado" });

    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: { asignadas: true },
    });
    if (!pedido)
      return res.status(404).json({ error: "Pedido no encontrado" });

    const asignadasIds = pedido.asignadas.map(a => a.maquinaId);
    const faltantes = asignadasIds.filter(idm => !devueltas.includes(idm));

    if (faltantes.length > 0 && !justificacion)
      return res.status(400).json({ error: "Debe justificar faltantes" });

    const actualizado = await prisma.pedido.update({
      where: { id },
      data: {
        estado: ESTADOS_PEDIDO.PENDIENTE_CONFIRMACION,
        itemsDevueltos: JSON.stringify(devueltas),
        historial: {
          create: {
            accion: "DEVOLUCION_REGISTRADA",
            usuarioId: u.id,
            detalle: JSON.stringify({
              devueltas,
              faltantes,
              ...(justificacion ? { justificacion } : {}),
            }),
          },
        },
      },
      include: {
        supervisor: true,
        servicio: true,
        asignadas: { include: { maquina: true } },
        historial: { include: { usuario: true }, orderBy: { fecha: "asc" } },
      },
    });

    res.json({
      message: "Devolución registrada",
      pedido: mapPedidoParaFront(actualizado),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error registrando devolución" });
  }
}

/* ========================================================
   CONFIRMAR DEVOLUCIÓN (DEPÓSITO)
======================================================== */
export async function confirmarDevolucion(req, res) {
  try {
    const { id } = req.params;
    const { usuario, devueltas = [], faltantes = [], observacion } = req.body;

    const u = await getUsuarioByUsername(usuario);
    if (!u) return res.status(404).json({ error: "Usuario no encontrado" });

    await prisma.$transaction(async tx => {
      if (devueltas.length)
        await tx.maquina.updateMany({
          where: { id: { in: devueltas } },
          data: { estado: "disponible" },
        });

      if (faltantes.length)
        await tx.maquina.updateMany({
          where: { id: { in: faltantes } },
          data: { estado: "no_devuelta" },
        });
    });

    const pedido = await prisma.pedido.update({
      where: { id },
      data: {
        estado: ESTADOS_PEDIDO.CERRADO,
        historial: {
          create: {
            accion: "DEVOLUCION_CONFIRMADA",
            usuarioId: u.id,
            detalle: JSON.stringify({
              devueltasConfirmadas: devueltas,
              faltantesConfirmados: faltantes,
              ...(observacion ? { observacion } : {}),
            }),
          },
        },
      },
      include: {
        supervisor: true,
        servicio: true,
        asignadas: { include: { maquina: true } },
        historial: { include: { usuario: true }, orderBy: { fecha: "asc" } },
      },
    });

    res.json({
      message: "Devolución confirmada",
      pedido: mapPedidoParaFront(pedido),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error confirmando devolución" });
  }
}

/* ========================================================
   COMPLETAR FALTANTES
======================================================== */
export async function completarFaltantes(req, res) {
  try {
    const { id } = req.params;
    const { usuario, devueltas = [], observacion } = req.body;

    const u = await getUsuarioByUsername(usuario);
    if (!u) return res.status(404).json({ error: "Usuario no encontrado" });

    const pedido = await prisma.pedido.update({
      where: { id },
      data: {
        estado: ESTADOS_PEDIDO.PENDIENTE_CONFIRMACION_FALTANTES,
        historial: {
          create: {
            accion: "FALTANTES_DECLARADOS",
            usuarioId: u.id,
            detalle: JSON.stringify({
              devueltasDeclaradas: devueltas,
              ...(observacion ? { observacion } : {}),
            }),
          },
        },
      },
      include: {
        supervisor: true,
        servicio: true,
        asignadas: { include: { maquina: true } },
        historial: { include: { usuario: true }, orderBy: { fecha: "asc" } },
      },
    });

    res.json({
      message: "Faltantes declarados",
      pedido: mapPedidoParaFront(pedido),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error declarando faltantes" });
  }
}

export async function getServiciosDeUsuario(req, res) {
  try {
    const { username } = req.params;

    const user = await prisma.usuario.findUnique({
      where: { username },
    });

    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    const asignados = await prisma.usuarioServicio.findMany({
      where: { usuarioId: user.id },
      include: { servicio: true },
      orderBy: { createdAt: "desc" },
    });

    // devolvemos el mismo formato que /servicios: [{id, nombre}]
    const servicios = asignados.map((x) => x.servicio);

    res.json(servicios);
  } catch (e) {
    console.error("❌ getServiciosDeUsuario:", e);
    res.status(500).json({ error: "Error obteniendo servicios del usuario" });
  }
}

/* ========================================================
   LISTAR PRÉSTAMOS (PEDIDOS A MÍ)
======================================================== */
export async function getPrestamosSupervisor(req, res) {
  const { username } = req.params;

  try {
    const pedidos = await prisma.pedido.findMany({
      where: {
        destino: "SUPERVISOR",
        supervisorDestinoUsername: username,
      },
      include: {
        supervisor: true, // quien pidió
        servicio: true,
        asignadas: { include: { maquina: true } },
        historial: { include: { usuario: true }, orderBy: { fecha: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(pedidos.map(mapPedidoParaFront));
  } catch (e) {
    console.error("❌ getPrestamosSupervisor:", e);
    res.status(500).json({ error: "Error obteniendo préstamos" });
  }
}

