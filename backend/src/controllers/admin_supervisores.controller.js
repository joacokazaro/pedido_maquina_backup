import prisma from "../db/prisma.js";
import { whereHasAnyRole, whereHasRole } from "../services/roles.service.js";

/* ========================================================
   HELPERS
======================================================== */
function parseId(raw) {
  const id = Number(raw);
  return Number.isNaN(id) ? null : id;
}

const ESTADOS_PEDIDO_ACTIVOS = [
  "PENDIENTE_PREPARACION",
  "PREPARADO",
  "ENTREGADO",
  "PENDIENTE_CONFIRMACION",
  "PENDIENTE_CONFIRMACION_FALTANTES",
  "PENDIENTE_CANCELACION",
];

const ESTADOS_PEDIDO_TEMPORALES = [...ESTADOS_PEDIDO_ACTIVOS, "CERRADO"];

function computeFaltantesFinalesFromHistorial(historial) {
  if (!Array.isArray(historial) || historial.length === 0) return [];

  const faltantes = new Set();
  const devueltas = new Set();

  for (const h of historial) {
    if (!h || !h.detalle) continue;
    let d = null;
    try {
      d = typeof h.detalle === "string" ? JSON.parse(h.detalle) : h.detalle;
    } catch (e) {
      d = null;
    }
    const f = d?.faltantes || d?.faltantesConfirmados || [];
    const dv = [].concat(d?.devueltas || [], d?.devueltasConfirmadas || [], d?.devueltasDeclaradas || []);

    if (Array.isArray(f)) {
      for (const id of f) if (id) faltantes.add(String(id));
    }

    if (Array.isArray(dv)) {
      for (const id of dv) if (id) devueltas.add(String(id));
    }
  }

  for (const id of devueltas) {
    if (faltantes.has(id)) faltantes.delete(id);
  }

  return Array.from(faltantes);
}

function mapMaquinaSupervisor(maquina) {
  return {
    id: maquina.id,
    tipo: maquina.tipo,
    modelo: maquina.modelo,
    serie: maquina.serie,
    estado: maquina.estado,
    servicio: maquina.servicio
      ? {
          id: maquina.servicio.id,
          nombre: maquina.servicio.nombre,
        }
      : null,
  };
}

function mapVehiculoSupervisor(vehiculo) {
  return {
    id: vehiculo.id,
    empresa: vehiculo.empresa,
    estado: vehiculo.estado,
    vehiculo: vehiculo.vehiculo,
    patente: vehiculo.patente,
    modelo: vehiculo.modelo,
    numeroPoliza: vehiculo.numeroPoliza,
    motor: vehiculo.motor,
    chasis: vehiculo.chasis,
    tipoCobertura: vehiculo.tipoCobertura,
    tarjetaVerde: vehiculo.tarjetaVerde,
    seguro: vehiculo.seguro
      ? {
          id: vehiculo.seguro.id,
          nombre: vehiculo.seguro.nombre,
        }
      : null,
    conductorActual: vehiculo.conductorActual
      ? {
          id: vehiculo.conductorActual.id,
          username: vehiculo.conductorActual.username,
          nombre: vehiculo.conductorActual.nombre,
          vtoCarnetConductor: vehiculo.conductorActual.vtoCarnetConductor,
        }
      : null,
  };
}

/* ========================================================
   GET /admin/supervisores
   Lista supervisores + servicios asignados
======================================================== */
export async function adminGetSupervisores(req, res) {
  try {
   const supervisores = await prisma.usuario.findMany({
  where: {
    ...whereHasAnyRole(["supervisor", "deposito"]),
  },
  include: {
    serviciosAsignados: {
      where: { servicio: { activo: true } },
      include: { servicio: true },
    },
  },
  orderBy: { username: "asc" },
});




    const result = supervisores.map((s) => ({
      id: s.id,
      username: s.username,
      nombre: s.nombre,
      servicios: s.serviciosAsignados.map((us) => us.servicio),
    }));

    res.json(result);
  } catch (e) {
    console.error("adminGetSupervisores:", e);
    res.status(500).json({ error: "Error listando supervisores" });
  }
}

/* ========================================================
   GET /admin/supervisores/:id/servicios
======================================================== */
export async function adminGetServiciosSupervisor(req, res) {
  try {
    const supervisorId = parseId(req.params.id);
    if (!supervisorId) {
      return res.status(400).json({ error: "ID de supervisor inválido" });
    }

    const servicios = await prisma.usuarioServicio.findMany({
      where: {
        usuarioId: supervisorId,
        servicio: { activo: true },
      },
      select: {
        servicio: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
    });

    res.json(servicios.map((s) => s.servicio));
  } catch (e) {
    console.error("adminGetServiciosSupervisor:", e);
    res.status(500).json({ error: "Error obteniendo servicios del supervisor" });
  }
}

/* ========================================================
   PUT /admin/supervisores/:id/servicios
======================================================== */
export async function adminAsignarServiciosSupervisor(req, res) {
  try {
    const supervisorId = parseId(req.params.id);
    const { servicioIds } = req.body;

    if (!supervisorId) {
      return res.status(400).json({ error: "ID de supervisor inválido" });
    }

    if (!Array.isArray(servicioIds)) {
      return res.status(400).json({
        error: "servicioIds debe ser un array",
      });
    }

    const servicioIdsNormalizados = [...new Set(
      servicioIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    )];

    if (servicioIdsNormalizados.length !== servicioIds.length) {
      return res.status(400).json({ error: "Hay IDs de servicio inválidos" });
    }

    if (servicioIdsNormalizados.length > 0) {
      const activos = await prisma.servicio.count({
        where: {
          id: { in: servicioIdsNormalizados },
          activo: true,
        },
      });

      if (activos !== servicioIdsNormalizados.length) {
        return res.status(400).json({
          error: "Solo se pueden asignar servicios activos",
        });
      }
    }

    await prisma.$transaction(async (tx) => {
      // borrar asignaciones actuales
      await tx.usuarioServicio.deleteMany({
        where: { usuarioId: supervisorId },
      });

      // crear nuevas
      for (const servicioId of servicioIdsNormalizados) {
        await tx.usuarioServicio.create({
          data: {
            usuarioId: supervisorId,
            servicioId,
          },
        });
      }
    });

    res.json({ message: "Servicios asignados correctamente" });
  } catch (e) {
    console.error("adminAsignarServiciosSupervisor:", e);
    res.status(500).json({ error: "Error asignando servicios" });
  }
}

/* ========================================================
   GET /admin/usuarios-operativos
   Supervisores + Depósito con servicios asignados
======================================================== */
export async function adminGetUsuariosOperativos(req, res) {
  try {
    const usuarios = await prisma.usuario.findMany({
      where: {
        ...whereHasAnyRole(["supervisor", "deposito"]),
      },
      include: {
        serviciosAsignados: {
          where: { servicio: { activo: true } },
          include: { servicio: true },
        },
      },
      orderBy: { username: "asc" },
    });

    const result = usuarios.map((u) => ({
      id: u.id,
      username: u.username,
      nombre: u.nombre,
      rol: u.rol,
      servicios: u.serviciosAsignados.map((us) => us.servicio),
    }));

    res.json(result);
  } catch (e) {
    console.error("adminGetUsuariosOperativos:", e);
    res.status(500).json({ error: "Error listando usuarios operativos" });
  }
}

/* ========================================================
   GET /supervisores/catalogo
   Lista solo usuarios con rol supervisor
======================================================== */
export async function getSupervisoresCatalogo(req, res) {
  try {
    const supervisores = await prisma.usuario.findMany({
      where: {
        ...whereHasRole("supervisor"),
        activo: true,
      },
      include: {
        serviciosAsignados: {
          where: { servicio: { activo: true } },
          include: { servicio: true },
          orderBy: {
            servicio: {
              nombre: "asc",
            },
          },
        },
      },
      orderBy: [{ nombre: "asc" }, { username: "asc" }],
    });

    res.json(
      supervisores.map((supervisor) => ({
        id: supervisor.id,
        username: supervisor.username,
        nombre: supervisor.nombre,
        rol: supervisor.rol,
        servicios: supervisor.serviciosAsignados.map((item) => ({
          id: item.servicio.id,
          nombre: item.servicio.nombre,
        })),
      }))
    );
  } catch (e) {
    console.error("getSupervisoresCatalogo:", e);
    res.status(500).json({ error: "Error listando supervisores" });
  }
}

/* ========================================================
   GET /supervisores/:id/maquinas
   Máquinas fijas por servicios + temporales por pedido
======================================================== */
export async function getMaquinasPorSupervisor(req, res) {
  try {
    const supervisorId = parseId(req.params.id);
    if (!supervisorId) {
      return res.status(400).json({ error: "ID de supervisor inválido" });
    }

    const supervisor = await prisma.usuario.findFirst({
      where: {
        id: supervisorId,
        ...whereHasRole("supervisor"),
        activo: true,
      },
      include: {
        serviciosAsignados: {
          where: { servicio: { activo: true } },
          include: { servicio: true },
          orderBy: {
            servicio: {
              nombre: "asc",
            },
          },
        },
      },
    });

    if (!supervisor) {
      return res.status(404).json({ error: "Supervisor no encontrado" });
    }

    const servicioIds = supervisor.serviciosAsignados.map((item) => item.servicioId);

    const maquinasFijas = servicioIds.length
      ? await prisma.maquina.findMany({
          where: {
            servicioId: { in: servicioIds },
          },
          include: {
            servicio: {
              select: {
                id: true,
                nombre: true,
              },
            },
          },
          orderBy: [{ tipo: "asc" }, { id: "asc" }],
        })
      : [];

    const pedidosTemporales = await prisma.pedido.findMany({
      where: {
        estado: { in: ESTADOS_PEDIDO_TEMPORALES },
        OR: [
          {
            supervisorId: supervisor.id,
          },
          {
            destino: "SUPERVISOR",
            supervisorDestinoUsername: supervisor.username,
          },
        ],
      },
      include: {
        supervisor: {
          select: {
            username: true,
            nombre: true,
          },
        },
        servicio: {
          select: {
            id: true,
            nombre: true,
          },
        },
        asignadas: {
          include: {
            maquina: {
              include: {
                servicio: {
                  select: {
                    id: true,
                    nombre: true,
                  },
                },
              },
            },
          },
        },
        historial: {
          where: {
            accion: {
              in: [
                "DEVOLUCION_REGISTRADA",
                "FALTANTES_DECLARADOS",
                "DEVOLUCION_CONFIRMADA",
                "DEVOLUCION_CONFIRMADA_DIRECTA",
              ],
            },
          },
          orderBy: { fecha: "asc" },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });

    const maquinasTemporales = pedidosTemporales.flatMap((pedido) => {
      const faltantesFinales =
        pedido.estado === "CERRADO"
          ? new Set(computeFaltantesFinalesFromHistorial(pedido.historial || []))
          : null;

      return pedido.asignadas.flatMap((asignacion) => {
        const faltanteConfirmado = Boolean(faltantesFinales?.has(String(asignacion.maquinaId)));

        // En pedidos cerrados solo quedan como temporales los faltantes finales.
        if (pedido.estado === "CERRADO" && !faltanteConfirmado) {
          return [];
        }

        const esPrestamoRecibido =
          pedido.destino === "SUPERVISOR" &&
          pedido.supervisorDestinoUsername === supervisor.username;

        return {
          ...mapMaquinaSupervisor(asignacion.maquina),
          faltanteConfirmado,
          servicioActual: pedido.servicio
            ? {
                id: pedido.servicio.id,
                nombre: pedido.servicio.nombre,
              }
            : null,
          pedido: {
            id: pedido.id,
            estado: pedido.estado,
            conFaltantes: pedido.estado === "CERRADO" && faltanteConfirmado,
            tipo: esPrestamoRecibido ? "PRESTAMO" : "PEDIDO",
            supervisorSolicitante:
              pedido.supervisor?.nombre || pedido.supervisor?.username || null,
          },
        };
      });
    });

    res.json({
      supervisor: {
        id: supervisor.id,
        username: supervisor.username,
        nombre: supervisor.nombre,
        servicios: supervisor.serviciosAsignados.map((item) => ({
          id: item.servicio.id,
          nombre: item.servicio.nombre,
        })),
      },
      maquinasFijas: maquinasFijas.map(mapMaquinaSupervisor),
      maquinasTemporales,
    });
  } catch (e) {
    console.error("getMaquinasPorSupervisor:", e);
    res.status(500).json({ error: "Error obteniendo máquinas del supervisor" });
  }
}

/* ========================================================
   GET /supervisores/:id/vehiculos
   Vehículos asignados actualmente al usuario
======================================================== */
export async function getVehiculosPorSupervisor(req, res) {
  try {
    const supervisorId = parseId(req.params.id);
    if (!supervisorId) {
      return res.status(400).json({ error: "ID de usuario inválido" });
    }

    const usuario = await prisma.usuario.findFirst({
      where: {
        id: supervisorId,
        ...whereHasRole("supervisor"),
        activo: true,
      },
      select: {
        id: true,
        username: true,
        nombre: true,
        rol: true,
        vtoCarnetConductor: true,
      },
    });

    if (!usuario) {
      return res.status(404).json({ error: "Supervisor no encontrado" });
    }

    const vehiculos = await prisma.vehiculo.findMany({
      where: {
        conductorActualId: supervisorId,
      },
      include: {
        seguro: {
          select: { id: true, nombre: true },
        },
        conductorActual: {
          select: {
            id: true,
            username: true,
            nombre: true,
            vtoCarnetConductor: true,
          },
        },
        asignacionesPedido: {
          where: {
            pedido: { estado: { notIn: ["CERRADO", "CANCELADO"] } },
          },
          take: 1,
          orderBy: { id: "desc" },
          include: {
            pedido: {
              include: {
                supervisor: { select: { username: true, nombre: true } },
                historial: {
                  where: { accion: "DEVOLUCION_CONFIRMADA" },
                  orderBy: { fecha: "desc" },
                  take: 1,
                },
              },
            },
          },
        },
      },
      orderBy: [{ empresa: "asc" }, { vehiculo: "asc" }, { id: "asc" }],
    });

    res.json({
      supervisor: usuario,
      vehiculos: vehiculos.map((v) => {
        const mapped = mapVehiculoSupervisor(v);
        const asignacionPedido = (v.asignacionesPedido || [])[0] || null;
        if (asignacionPedido && asignacionPedido.pedido) {
          mapped.pedidoActivo = {
            id: asignacionPedido.pedido.id,
            estado: asignacionPedido.pedido.estado,
            destino: asignacionPedido.pedido.destino,
            supervisor: asignacionPedido.pedido.supervisor?.username ?? null,
            supervisorNombre:
              asignacionPedido.pedido.supervisor?.nombre ??
              asignacionPedido.pedido.supervisor?.username ??
              null,
            titular: asignacionPedido.pedido.supervisorDestinoUsername ?? null,
          };
          // detectar faltantes a partir del historial de devolucion (considerando devoluciones posteriores)
          mapped.pedidoActivo.conFaltantes = false;
          if (asignacionPedido.pedido.historial?.length) {
            const finales = computeFaltantesFinalesFromHistorial(asignacionPedido.pedido.historial || []);
            mapped.pedidoActivo.conFaltantes = asignacionPedido.pedido.estado === "CERRADO" && finales.length > 0;
          }

          if (mapped.estado !== "baja") mapped.estado = "asignada";
        }

        return mapped;
      }),
    });
  } catch (e) {
    console.error("getVehiculosPorSupervisor:", e);
    res.status(500).json({ error: "Error obteniendo vehículos del supervisor" });
  }
}
