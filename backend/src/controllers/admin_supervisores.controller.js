import prisma from "../db/prisma.js";

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
    rol: { in: ["supervisor", "deposito"] },
  },
  include: {
    serviciosAsignados: {
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
      where: { usuarioId: supervisorId },
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

    await prisma.$transaction(async (tx) => {
      // borrar asignaciones actuales
      await tx.usuarioServicio.deleteMany({
        where: { usuarioId: supervisorId },
      });

      // crear nuevas
      for (const servicioId of servicioIds) {
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
        rol: { in: ["supervisor", "deposito"] },
      },
      include: {
        serviciosAsignados: {
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
        rol: "supervisor",
        activo: true,
      },
      include: {
        serviciosAsignados: {
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
        rol: "supervisor",
        activo: true,
      },
      include: {
        serviciosAsignados: {
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
        estado: { in: ESTADOS_PEDIDO_ACTIVOS },
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
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });

    const maquinasTemporales = pedidosTemporales.flatMap((pedido) =>
      pedido.asignadas.map((asignacion) => {
        const esPrestamoRecibido =
          pedido.destino === "SUPERVISOR" &&
          pedido.supervisorDestinoUsername === supervisor.username;

        return {
          ...mapMaquinaSupervisor(asignacion.maquina),
          servicioActual: pedido.servicio
            ? {
                id: pedido.servicio.id,
                nombre: pedido.servicio.nombre,
              }
            : null,
          pedido: {
            id: pedido.id,
            estado: pedido.estado,
            tipo: esPrestamoRecibido ? "PRESTAMO" : "PEDIDO",
            supervisorSolicitante:
              pedido.supervisor?.nombre || pedido.supervisor?.username || null,
          },
        };
      })
    );

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
        rol: "supervisor",
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
      },
      orderBy: [{ empresa: "asc" }, { vehiculo: "asc" }, { id: "asc" }],
    });

    res.json({
      supervisor: usuario,
      vehiculos: vehiculos.map(mapVehiculoSupervisor),
    });
  } catch (e) {
    console.error("getVehiculosPorSupervisor:", e);
    res.status(500).json({ error: "Error obteniendo vehículos del supervisor" });
  }
}
