import prisma from "../db/prisma.js";
import { crearNotificacionesParaUsuarios } from "../services/notificaciones.service.js";
import { userHasRole } from "../services/roles.service.js";

/* ========================================================
   CONSTANTES Y HELPERS
======================================================== */
const ESTADOS_PEDIDO_VALIDOS = [
  "PENDIENTE_PREPARACION",
  "PREPARADO",
  "ENTREGADO",
  "PENDIENTE_CONFIRMACION",
  "PENDIENTE_CONFIRMACION_FALTANTES",
  "CERRADO",
];

const ESTADOS_PEDIDO_EDITABLES_ADMIN = [
  "PENDIENTE_PREPARACION",
  "PREPARADO",
  "ENTREGADO",
];

function normalizeEstadoPedido(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replaceAll(" ", "_");
}

function safeParse(detalle) {
  if (!detalle) return null;
  try {
    return JSON.parse(detalle);
  } catch {
    return null;
  }
}

function computeFaltantesFinalesFromHistorial(historial) {
  if (!Array.isArray(historial) || historial.length === 0) return [];

  const faltantes = new Set();
  const devueltas = new Set();

  for (const h of historial) {
    if (!h || !h.detalle) continue;
    const d = typeof h.detalle === "string" ? safeParse(h.detalle) : h.detalle;
    if (!d) continue;

    const faltantesDetalle = d?.faltantes || d?.faltantesConfirmados || [];
    const devueltasDetalle = [].concat(
      d?.devueltas || [],
      d?.devueltasConfirmadas || [],
      d?.devueltasDeclaradas || []
    );

    if (Array.isArray(faltantesDetalle)) {
      for (const id of faltantesDetalle) {
        if (id) faltantes.add(String(id));
      }
    }

    if (Array.isArray(devueltasDetalle)) {
      for (const id of devueltasDetalle) {
        if (id) devueltas.add(String(id));
      }
    }
  }

  for (const id of devueltas) {
    if (faltantes.has(id)) faltantes.delete(id);
  }

  return Array.from(faltantes);
}

/* ========================================================
   GET /admin/pedidos
======================================================== */
export async function adminListPedidos(req, res) {
  try {
    const { estado, faltantes } = req.query;

    /* =========================
       1) Filtro por estado
    ========================= */
    let where = {};

    if (estado && estado !== "TODOS") {
      const estadoNorm = normalizeEstadoPedido(estado);
      if (!ESTADOS_PEDIDO_VALIDOS.includes(estadoNorm)) {
        return res.status(400).json({
          error: `Estado inválido. Debe ser uno de: ${ESTADOS_PEDIDO_VALIDOS.join(
            ", "
          )}`,
        });
      }
      where.estado = estadoNorm;
    }

    /* =========================
       2) Traer pedidos
    ========================= */
    const pedidos = await prisma.pedido.findMany({
      where,
      include: {
        supervisor: { select: { username: true } },
        servicio: { select: { nombre: true } },
        historial: {
          where: {
            accion: {
              in: ["DEVOLUCION_CONFIRMADA", "DEVOLUCION_CONFIRMADA_DIRECTA"],
            },
          },
          orderBy: { fecha: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    /* =========================
       3) Mapear + detectar faltantes
    ========================= */
    let resultado = pedidos.map((p) => {
      const ultimaConfirm = p.historial?.[0];
      const detalle = safeParse(ultimaConfirm?.detalle);

      const faltantesConfirmados =
        detalle?.faltantesConfirmados || [];

      const conFaltantes =
        p.estado === "CERRADO" &&
        Array.isArray(faltantesConfirmados) &&
        faltantesConfirmados.length > 0;

      return {
        ...p,
        supervisorName: p.supervisor?.username ?? "—",
        servicioName: p.servicio?.nombre ?? null,
        conFaltantes,
        esEventual: Boolean(p.eventualId),
      };
    });

    /* =========================
       4) Filtro por faltantes
    ========================= */
    if (faltantes === "1") {
      resultado = resultado.filter((p) => p.conFaltantes);
    }

    if (faltantes === "0") {
      resultado = resultado.filter((p) => !p.conFaltantes);
    }

    res.json(resultado);
  } catch (err) {
    console.error("adminListPedidos:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

/* ========================================================
   GET /admin/pedidos/:id
======================================================== */
export async function adminGetPedido(req, res) {
  try {
    const { id } = req.params;

    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: {
        supervisor: { select: { username: true } },
        servicio: { select: { nombre: true } },
        asignadas: { include: { maquina: true } },
        vehiculosAsignadas: { include: { vehiculo: true } },
        historial: {
          include: { usuario: { select: { username: true } } },
          orderBy: { fecha: "asc" },
        },
      },
    });

    if (!pedido) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    res.json({
      ...pedido,
      supervisorName: pedido.supervisor?.username ?? "—",
      servicioName: pedido.servicio?.nombre ?? null,
    });
  } catch (err) {
    console.error("adminGetPedido:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

/* ========================================================
   PUT /admin/pedidos/:id/estado
======================================================== */
export async function adminUpdateEstado(req, res) {
  try {
    const { id } = req.params;
    const { estado, usuario } = req.body || {};

    if (!estado) {
      return res.status(400).json({ error: "Debe enviar un estado" });
    }

    const estadoNorm = normalizeEstadoPedido(estado);
    if (!ESTADOS_PEDIDO_VALIDOS.includes(estadoNorm)) {
      return res.status(400).json({
        error: `Estado inválido. Debe ser uno de: ${ESTADOS_PEDIDO_VALIDOS.join(
          ", "
        )}`,
      });
    }

    const pedido = await prisma.pedido.findUnique({ where: { id } });
    if (!pedido) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    const actualizado = await prisma.pedido.update({
      where: { id },
      data: {
        estado: estadoNorm,
        historial: {
          create: {
            accion: "ADMIN_CAMBIO_ESTADO",
            usuarioId: null,
            detalle: JSON.stringify({
              mensaje: "Cambio forzado por administrador",
              usuario: usuario || "admin",
              nuevoEstado: estadoNorm,
            }),
          },
        },
      },
      include: {
        historial: {
          include: { usuario: { select: { username: true } } },
          orderBy: { fecha: "asc" },
        },
      },
    });

    res.json({
      message: "Estado actualizado por el administrador",
      pedido: actualizado,
    });
  } catch (err) {
    console.error("adminUpdateEstado:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

/* ========================================================
   PUT /admin/pedidos/:id
   Admin edits pedido observation and assigned machines
======================================================== */
export async function adminUpdatePedido(req, res) {
  try {
    const { id } = req.params;
    const { usuario, observacion, asignadas, servicioId, vehiculos } = req.body || {};

    const admin = await prisma.usuario.findUnique({
      where: { username: usuario },
      select: { id: true, rol: true, roles: { select: { rol: true } }, username: true },
    });

    if (!admin || !userHasRole(admin, "admin")) {
      return res.status(403).json({ error: "No autorizado" });
    }

    const asignadasIds = Array.isArray(asignadas)
      ? [...new Set(asignadas.map((item) => String(item || "").trim()).filter(Boolean))]
      : [];

    const vehiculosIds = Array.isArray(vehiculos)
      ? [...new Set(vehiculos.map((item) => String(item || "").trim()).filter(Boolean))]
      : [];

    const servicioIdNum = Number(servicioId);
    if (!servicioIdNum) {
      return res.status(400).json({ error: "servicioId es obligatorio" });
    }

    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: {
        asignadas: true,
        vehiculosAsignadas: true,
      },
    });

    if (!pedido) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    if (!ESTADOS_PEDIDO_EDITABLES_ADMIN.includes(pedido.estado)) {
      return res.status(409).json({
        error: "Solo se pueden editar pedidos en preparación, preparados o entregados",
      });
    }

    const servicio = await prisma.servicio.findUnique({
      where: { id: servicioIdNum },
      select: { id: true, nombre: true, activo: true },
    });

    if (!servicio || !servicio.activo) {
      return res.status(404).json({ error: "Servicio no encontrado" });
    }

    const actualesIds = pedido.asignadas.map((item) => item.maquinaId);
    const actualesSet = new Set(actualesIds);
    const nuevasSet = new Set(asignadasIds);

    const maquinasAgregar = asignadasIds.filter((maquinaId) => !actualesSet.has(maquinaId));
    const maquinasQuitar = actualesIds.filter((maquinaId) => !nuevasSet.has(maquinaId));

    const actualesVehiculosIds = (pedido.vehiculosAsignadas || []).map((item) => item.vehiculoId);
    const actualesVehiculosSet = new Set(actualesVehiculosIds);
    const nuevasVehiculosSet = new Set(vehiculosIds);

    const vehiculosAgregar = vehiculosIds.filter((vehId) => !actualesVehiculosSet.has(vehId));
    const vehiculosQuitar = actualesVehiculosIds.filter((vehId) => !nuevasVehiculosSet.has(vehId));

      if (maquinasAgregar.length > 0) {
      const maquinasDisponibles = await prisma.maquina.findMany({
        where: { id: { in: maquinasAgregar } },
        select: { id: true, estado: true },
      });

      if (maquinasDisponibles.length !== maquinasAgregar.length) {
        return res.status(400).json({ error: "Hay máquinas inexistentes en la selección" });
      }

      if (vehiculosAgregar.length > 0) {
        const vehiculosExistentes = await prisma.vehiculo.findMany({
          where: { id: { in: vehiculosAgregar } },
          select: { id: true },
        });

        if (vehiculosExistentes.length !== vehiculosAgregar.length) {
          return res.status(400).json({ error: "Hay vehículos inexistentes en la selección" });
        }

        const asignacionesActivasVeh = await prisma.pedidoVehiculo.findMany({
          where: {
            vehiculoId: { in: vehiculosAgregar },
            pedidoId: { not: id },
            pedido: {
              estado: {
                notIn: ["CERRADO", "CANCELADO"],
              },
            },
          },
          select: { vehiculoId: true, pedidoId: true },
        });

        if (asignacionesActivasVeh.length > 0) {
          return res.status(409).json({
            error: `Los siguientes vehículos ya están asignados a otro pedido: ${asignacionesActivasVeh
              .map((item) => item.vehiculoId)
              .join(", ")}`,
          });
        }
      }

      const noDisponibles = maquinasDisponibles.filter((maquina) => maquina.estado !== "disponible");
      if (noDisponibles.length > 0) {
        return res.status(409).json({
          error: `Las siguientes máquinas no están libres: ${noDisponibles.map((maquina) => maquina.id).join(", ")}`,
        });
      }

      const asignacionesActivas = await prisma.pedidoMaquina.findMany({
        where: {
          maquinaId: { in: maquinasAgregar },
          pedidoId: { not: id },
          pedido: {
            estado: {
              notIn: ["CERRADO", "CANCELADO"],
            },
          },
        },
        select: { maquinaId: true, pedidoId: true },
      });

      if (asignacionesActivas.length > 0) {
        return res.status(409).json({
          error: `Las siguientes máquinas ya están asignadas a otro pedido: ${asignacionesActivas
            .map((item) => item.maquinaId)
            .join(", ")}`,
        });
      }
    }

    const detalle = {
      mensaje: "Pedido editado por administrador",
      maquinasQuitadas: maquinasQuitar,
      maquinasAgregadas: maquinasAgregar,
      vehiculosQuitadas: vehiculosQuitar,
      vehiculosAgregadas: vehiculosAgregar,
      servicioAnteriorId: pedido.servicioId,
      servicioNuevoId: servicio.id,
    };

    if (typeof observacion === "string") {
      detalle.observacion = observacion.trim() || null;
    }

    const estadoSiguiente =
      pedido.estado === "PREPARADO" && asignadasIds.length === 0
        ? "PENDIENTE_PREPARACION"
        : pedido.estado;

    const actualizado = await prisma.$transaction(async (tx) => {
      if (maquinasQuitar.length > 0) {
        await tx.pedidoMaquina.deleteMany({
          where: {
            pedidoId: id,
            maquinaId: { in: maquinasQuitar },
          },
        });

        await tx.maquina.updateMany({
          where: { id: { in: maquinasQuitar } },
          data: { estado: "disponible" },
        });
      }

      if (maquinasAgregar.length > 0) {
        await tx.pedidoMaquina.createMany({
          data: maquinasAgregar.map((maquinaId) => ({
            pedidoId: id,
            maquinaId,
          })),
        });

        await tx.maquina.updateMany({
          where: { id: { in: maquinasAgregar } },
          data: { estado: "asignada" },
        });
      }

      // Vehículos: quitar/crear relaciones en PedidoVehiculo
      if (vehiculosQuitar.length > 0) {
        await tx.pedidoVehiculo.deleteMany({
          where: { pedidoId: id, vehiculoId: { in: vehiculosQuitar } },
        });
      }

      if (vehiculosAgregar.length > 0) {
        await tx.pedidoVehiculo.createMany({
          data: vehiculosAgregar.map((vehId) => ({ pedidoId: id, vehiculoId: vehId })),
        });
      }

      return tx.pedido.update({
        where: { id },
        data: {
          observacion:
            typeof observacion === "string"
              ? observacion.trim() || null
              : pedido.observacion,
          servicioId: servicio.id,
          estado: estadoSiguiente,
          historial: {
            create: {
              accion: "ADMIN_EDICION_PEDIDO",
              usuarioId: admin.id,
              detalle: JSON.stringify(detalle),
            },
          },
        },
        include: {
          supervisor: { select: { username: true } },
          servicio: { select: { id: true, nombre: true } },
          asignadas: { include: { maquina: true } },
          historial: {
            include: { usuario: { select: { username: true } } },
            orderBy: { fecha: "asc" },
          },
        },
      });
    });

    res.json({
      message: "Pedido actualizado correctamente",
      pedido: {
        ...actualizado,
        supervisorName: actualizado.supervisor?.username ?? "—",
        servicioName: actualizado.servicio?.nombre ?? null,
      },
    });
  } catch (err) {
    console.error("adminUpdatePedido:", err);
    res.status(500).json({ error: "Error actualizando pedido" });
  }
}

/* ========================================================
   DELETE /admin/pedidos/:id
======================================================== */
export async function adminDeletePedido(req, res) {
  try {
    const { id } = req.params;

    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: { asignadas: true },
    });

    if (!pedido) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    await prisma.$transaction(async (tx) => {
      /* 1️⃣ Liberar máquinas */
      const maquinasIds = pedido.asignadas.map((a) => a.maquinaId);

      if (maquinasIds.length > 0) {
        await tx.maquina.updateMany({
          where: { id: { in: maquinasIds } },
          data: { estado: "disponible" },
        });
      }

      /* 2️⃣ Borrar relaciones */
      await tx.pedidoMaquina.deleteMany({ where: { pedidoId: id } });
      await tx.pedidoVehiculo.deleteMany({ where: { pedidoId: id } });
      await tx.historialPedido.deleteMany({ where: { pedidoId: id } });

      /* 3️⃣ Borrar pedido */
      await tx.pedido.delete({ where: { id } });
    });

    res.json({ message: `Pedido ${id} eliminado correctamente` });
  } catch (e) {
    console.error("adminDeletePedido:", e);
    res.status(500).json({ error: "Error eliminando pedido" });
  }
}

/* ========================================================
   POST /admin/pedidos/:id/aprobar-cancelacion
   Admin approves a cancellation request: cancel order, free machines
======================================================== */
export async function adminAprobarCancelacion(req, res) {
  try {
    const { id } = req.params;
    const { usuario } = req.body || {};

    // validar admin
    const admin = await prisma.usuario.findUnique({
      where: { username: usuario },
      include: { roles: { select: { rol: true } } },
    });
    if (!admin || !userHasRole(admin, "admin")) return res.status(403).json({ error: "No autorizado" });

    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: { asignadas: { include: { maquina: true } }, supervisor: true },
    });

    if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });

    if (pedido.estado === "CANCELADO")
      return res.status(400).json({ error: "Pedido ya está CANCELADO" });

    const maquinasIds = pedido.asignadas.map(a => a.maquinaId);
    const accionHistorial = pedido.estado === "PENDIENTE_CANCELACION" ? "CANCELADO" : "CANCELADO_ADMIN";
    const detalleHistorial = pedido.estado === "PENDIENTE_CANCELACION"
      ? { mensaje: "Cancelado por admin" }
      : { mensaje: "Cancelado directamente por admin", estadoAnterior: pedido.estado };

    const actualizado = await prisma.$transaction(async (tx) => {
      if (maquinasIds.length > 0) {
        await tx.maquina.updateMany({ where: { id: { in: maquinasIds } }, data: { estado: "disponible" } });
      }

      return tx.pedido.update({
        where: { id },
        data: {
          estado: "CANCELADO",
          historial: {
            create: {
              accion: accionHistorial,
              usuarioId: admin.id,
              detalle: JSON.stringify(detalleHistorial),
            },
          },
        },
        include: { asignadas: { include: { maquina: true } }, historial: { include: { usuario: { select: { username: true } } }, orderBy: { fecha: "asc" } }, supervisor: true, servicio: true },
      });
    });

    // Notificar al supervisor solicitante
    try {
      if (pedido.supervisor && pedido.supervisor.id) {
        await crearNotificacionesParaUsuarios({
          req,
          usuarioIds: [pedido.supervisor.id],
          pedidoId: pedido.id,
          tipo: pedido.estado === "PENDIENTE_CANCELACION" ? "CANCELACION_APROBADA" : "PEDIDO_CANCELADO_ADMIN",
          estado: actualizado.estado,
          mensaje: pedido.estado === "PENDIENTE_CANCELACION"
            ? `La cancelación del pedido ${pedido.id} fue aprobada por ${usuario}`
            : `El pedido ${pedido.id} fue cancelado por ${usuario}`,
        });
      }
    } catch (e) {
      console.error("Error notificando supervisor (adminAprobarCancelacion):", e);
    }

    res.json({ message: "Pedido cancelado", pedido: actualizado });
  } catch (e) {
    console.error("adminAprobarCancelacion:", e);
    res.status(500).json({ error: "Error aprobando cancelación" });
  }
}

export async function adminExportPedidos(req, res) {
  const pedidos = await prisma.pedido.findMany({
    include: {
      supervisor: { select: { username: true } },
      servicio: { select: { nombre: true } },
      asignadas: { include: { maquina: true } },
      historial: {
        include: { usuario: { select: { username: true } } },
        orderBy: { fecha: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const rows = [];

  // =========================
  // HEADER
  // =========================
  rows.push([
    "ID Pedido",
    "Estado",
    "Destino",
    "Servicio",
    "Supervisor",
    "Fecha Creación",
    "Última Actualización",
    "Máquinas Asignadas",
    "Máquinas Devueltas",
    "Máquinas Faltantes",
    "Observaciones / Comentarios",
    "Tiene Faltantes",
    "Historial Resumido",
  ]);

  pedidos.forEach((p) => {
    const asignadas = p.asignadas.map(a => a.maquina.id);

    let devueltas = [];
    let faltantes = computeFaltantesFinalesFromHistorial(p.historial || []);
    let observaciones = [];
    let historialResumen = [];

    p.historial.forEach(h => {
      historialResumen.push(
        `${h.fecha.toISOString().slice(0, 10)} - ${h.accion} (${h.usuario?.username ?? "sistema"})`
      );

      if (h.detalle) {
        let d;
        try {
          d = typeof h.detalle === "string"
            ? JSON.parse(h.detalle)
            : h.detalle;
        } catch {
          d = null;
        }

        if (d?.devueltas) devueltas.push(...d.devueltas);
        if (d?.devueltasConfirmadas) devueltas.push(...d.devueltasConfirmadas);
        if (d?.observacion) observaciones.push(d.observacion);
        if (d?.mensaje) observaciones.push(d.mensaje);
      }
    });

    // quitar duplicados
    devueltas = [...new Set(devueltas)];
    faltantes = [...new Set(faltantes)];

    rows.push([
      p.id,
      p.estado,
      p.destino,
      p.servicio?.nombre ?? "",
      p.supervisor?.username ?? "",
      p.createdAt.toISOString(),
      p.historial.at(-1)?.fecha.toISOString() ?? "",
      asignadas.join(" | "),
      devueltas.join(" | "),
      faltantes.join(" | "),
      observaciones.join(" | "),
      faltantes.length > 0 ? "SI" : "NO",
      historialResumen.join(" || "),
    ]);
  });

  const csv = rows
    .map(r =>
      r.map(v =>
        `"${String(v ?? "").replaceAll('"', '""').replaceAll("\n", " ")}"`
      ).join(",")
    )
    .join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=pedidos_${new Date().toISOString().slice(0,10)}.csv`
  );

  res.send(csv);
}

