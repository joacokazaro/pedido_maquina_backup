import prisma from "../db/prisma.js";

/* ========================================================
   HELPERS
======================================================== */
function parseId(raw) {
  const id = Number(raw);
  return Number.isNaN(id) ? null : id;
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
