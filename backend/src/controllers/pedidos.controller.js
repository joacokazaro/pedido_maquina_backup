// backend/src/controllers/pedidos.controller.js
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
  return prisma.usuario.findUnique({ where: { username } });
}

async function getOrCreateServicioByNombre(nombre) {
  const clean = (nombre || "").trim();
  if (!clean) return null;

  return prisma.servicio.upsert({
    where: { nombre: clean },
    update: {},
    create: { nombre: clean },
  });
}

async function generarIdPedido() {
  const count = await prisma.pedido.count();
  return `P-${String(count + 1).padStart(4, "0")}`;
}

function mapPedidoParaFront(p) {
  return {
    ...p,
    supervisor: p.supervisor?.username ?? null,
    servicio: p.servicio?.nombre ?? null,
    itemsAsignados: p.asignadas.map(a => ({
      id: a.maquina.id,
      tipo: a.maquina.tipo,
      modelo: a.maquina.modelo,
      serie: a.maquina.serie,
    })),
    historial: p.historial.map(h => ({
      accion: h.accion,
      fecha: h.fecha,
      detalle: h.detalle,
      usuario: h.usuario?.username ?? "—",
    })),
  };
}

/* ========================================================
   CREAR PEDIDO
======================================================== */
export async function crearPedido(req, res) {
  try {
    const { supervisorUsername, itemsSolicitados, observacion, servicio } = req.body;

    if (!supervisorUsername || !servicio || !Array.isArray(itemsSolicitados)) {
      return res.status(400).json({ error: "Datos incompletos" });
    }

    const supervisor = await getUsuarioByUsername(supervisorUsername);
    if (!supervisor) {
      return res.status(404).json({ error: "Supervisor no encontrado" });
    }

    const serv = await getOrCreateServicioByNombre(servicio);
    const id = await generarIdPedido();

    const pedido = await prisma.pedido.create({
      data: {
        id,
        estado: ESTADOS_PEDIDO.PENDIENTE_PREPARACION,
        observacion: observacion || null,
        itemsSolicitados,
        supervisorId: supervisor.id,
        servicioId: serv.id,
        historial: {
          create: {
            accion: "CREADO",
            usuarioId: supervisor.id,
            detalle: observacion ? { observacion } : {},
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

    res.json({ message: "Pedido creado", pedido: mapPedidoParaFront(pedido) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error creando pedido" });
  }
}

/* ========================================================
   LISTAR PEDIDOS POR SUPERVISOR
======================================================== */
export async function getPedidosSupervisor(req, res) {
  try {
    const username = String(req.params.supervisorId || "").trim();
    const supervisor = await getUsuarioByUsername(username);
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
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error listando pedidos" });
  }
}

/* ========================================================
   OBTENER POR ID
======================================================== */
export async function getPedidoById(req, res) {
  try {
    const pedido = await prisma.pedido.findUnique({
      where: { id: req.params.id },
      include: {
        supervisor: true,
        servicio: true,
        asignadas: { include: { maquina: true } },
        historial: { include: { usuario: true }, orderBy: { fecha: "asc" } },
      },
    });

    if (!pedido) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    res.json(mapPedidoParaFront(pedido));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error obteniendo pedido" });
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

    const pedido = await prisma.pedido.findUnique({ where: { id } });
    if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });

    if (pedido.estado !== ESTADOS_PEDIDO.PREPARADO) {
      return res.status(400).json({ error: "Debe estar PREPARADO" });
    }

    const actualizado = await prisma.pedido.update({
      where: { id },
      data: {
        estado: ESTADOS_PEDIDO.ENTREGADO,
        historial: {
          create: {
            accion: "ENTREGADO",
            usuarioId: u.id,
            detalle: observacion ? { observacion } : {},
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
      pedido: mapPedidoParaFront(actualizado),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error marcando entregado" });
  }
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
    if (!ESTADOS_PEDIDO_VALIDOS.includes(estadoNorm)) {
      return res.status(400).json({ error: "Estado inválido" });
    }

    const pedido = await prisma.pedido.update({
      where: { id },
      data: {
        estado: estadoNorm,
        historial: {
          create: {
            accion: "ESTADO_ACTUALIZADO",
            usuarioId: u.id,
            detalle: {
              nuevoEstado: estadoNorm,
              ...(observacion ? { observacion } : {}),
            },
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
   ASIGNAR MÁQUINAS
======================================================== */
export async function asignarMaquinas(req, res) {
  try {
    const { id } = req.params;
    const { asignadas, justificacion, usuario } = req.body;

    const u = await getUsuarioByUsername(usuario);
    if (!u) return res.status(404).json({ error: "Usuario no encontrado" });

    if (!Array.isArray(asignadas) || asignadas.length === 0) {
      return res.status(400).json({ error: "Debe enviar máquinas" });
    }

    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: { asignadas: true },
    });
    if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });

    const maquinas = await prisma.maquina.findMany({
      where: { id: { in: asignadas } },
    });

    const inexistentes = asignadas.filter(
      idm => !maquinas.some(m => m.id === idm)
    );
    if (inexistentes.length > 0) {
      return res.status(400).json({ error: "Máquinas inexistentes", inexistentes });
    }

    const noDisponibles = maquinas.filter(m => m.estado !== "disponible");
    if (noDisponibles.length > 0) {
      return res.status(400).json({ error: "Máquinas no disponibles", noDisponibles });
    }

    const solicitado = {};
    (pedido.itemsSolicitados || []).forEach(i => {
      solicitado[i.tipo] = i.cantidad;
    });

    const asignadoPorTipo = {};
    maquinas.forEach(m => {
      asignadoPorTipo[m.tipo] = (asignadoPorTipo[m.tipo] || 0) + 1;
    });

    const requiereJustificacion = Object.keys(solicitado).some(
      t => (asignadoPorTipo[t] || 0) !== solicitado[t]
    );

    if (requiereJustificacion && !justificacion) {
      return res.status(400).json({ error: "Requiere justificación" });
    }

    const actualizado = await prisma.$transaction(async tx => {
      await tx.pedidoMaquina.deleteMany({ where: { pedidoId: id } });

      await tx.pedidoMaquina.createMany({
        data: asignadas.map(mid => ({ pedidoId: id, maquinaId: mid })),
      });

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
              detalle: {
                solicitado,
                asignadoPorTipo,
                ...(requiereJustificacion ? { justificacion } : {}),
              },
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
      pedido: mapPedidoParaFront(actualizado),
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
    const { devueltas, justificacion, usuario } = req.body;

    const u = await getUsuarioByUsername(usuario);
    if (!u) return res.status(404).json({ error: "Usuario no encontrado" });

    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: { asignadas: true },
    });
    if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });

    const asignadasIds = pedido.asignadas.map(a => a.maquinaId);
    const faltantes = asignadasIds.filter(idm => !devueltas.includes(idm));

    if (faltantes.length > 0 && !justificacion) {
      return res.status(400).json({ error: "Debe justificar faltantes" });
    }

    const actualizado = await prisma.pedido.update({
      where: { id },
      data: {
        estado: ESTADOS_PEDIDO.PENDIENTE_CONFIRMACION,
        itemsDevueltos: devueltas,
        historial: {
          create: {
            accion: "DEVOLUCION_REGISTRADA",
            usuarioId: u.id,
            detalle: { devueltas, faltantes, ...(justificacion ? { justificacion } : {}) },
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
      if (devueltas.length) {
        await tx.maquina.updateMany({
          where: { id: { in: devueltas } },
          data: { estado: "disponible" },
        });
      }
      if (faltantes.length) {
        await tx.maquina.updateMany({
          where: { id: { in: faltantes } },
          data: { estado: "no_devuelta" },
        });
      }
    });

    const pedido = await prisma.pedido.update({
      where: { id },
      data: {
        estado: ESTADOS_PEDIDO.CERRADO,
        historial: {
          create: {
            accion: "DEVOLUCION_CONFIRMADA",
            usuarioId: u.id,
            detalle: {
              devueltasConfirmadas: devueltas,
              faltantesConfirmados: faltantes,
              ...(observacion ? { observacion } : {}),
            },
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
   LISTAR TODOS
======================================================== */
export async function getPedidos(req, res) {
  try {
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
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error listando pedidos" });
  }
}

/* ========================================================
   COMPLETAR FALTANTES (SUPERVISOR)
======================================================== */
export async function completarFaltantes(req, res) {
  try {
    const { id } = req.params;
    const { usuario, devueltas, observacion } = req.body || {};

    if (!Array.isArray(devueltas) || devueltas.length === 0) {
      return res.status(400).json({
        error: "Debe indicar al menos una máquina devuelta",
      });
    }

    const u = await getUsuarioByUsername(usuario);
    if (!u) return res.status(404).json({ error: "Usuario no encontrado" });

    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: { asignadas: true },
    });
    if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });

    // Las máquinas que declara devueltas tienen que estar dentro de las asignadas del pedido
    const asignadasIds = new Set(pedido.asignadas.map(a => a.maquinaId));
    const invalidas = devueltas.filter(mid => !asignadasIds.has(mid));
    if (invalidas.length > 0) {
      return res.status(400).json({
        error: "Hay máquinas que no pertenecen a este pedido",
        invalidas,
      });
    }

    // ✅ Transacción:
    // - marcar esas máquinas como disponible
    // - registrar historial
    // - setear estado del pedido a PENDIENTE_CONFIRMACION_FALTANTES
    const actualizado = await prisma.$transaction(async (tx) => {
      await tx.maquina.updateMany({
        where: { id: { in: devueltas } },
        data: { estado: "disponible" },
      });

      const p = await tx.pedido.update({
        where: { id },
        data: {
          estado: ESTADOS_PEDIDO.PENDIENTE_CONFIRMACION_FALTANTES,
          historial: {
            create: {
              accion: "FALTANTES_DECLARADOS",
              usuarioId: u.id,
              detalle: {
                devueltasDeclaradas: devueltas,
                ...(observacion ? { observacion } : {}),
              },
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

      return p;
    });

    res.json({
      message: "Faltantes declarados",
      pedido: mapPedidoParaFront(actualizado),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error declarando faltantes" });
  }
}

