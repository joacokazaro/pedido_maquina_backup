import prisma from "../db/prisma.js";

/* =====================================================
   CONSTANTES
===================================================== */
const ROLES_VALIDOS = ["admin", "supervisor", "deposito"];

/* =====================================================
   HELPERS
===================================================== */
function normalizeRol(rol) {
  return typeof rol === "string" ? rol.toLowerCase().trim() : null;
}

function normalizeString(v) {
  return typeof v === "string" ? v.trim() : null;
}

function mapUsuarioResponse(u) {
  return {
    id: u.id,
    username: u.username,
    nombre: u.nombre,
    rol: u.rol.toUpperCase(), // el front lo espera así
    activo: u.activo,
    createdAt: u.createdAt,
  };
}

/* =====================================================
   GET /admin-users
   ?rol=&activo=&search=
===================================================== */
export async function adminGetUsuarios(req, res) {
  try {
    const { rol, activo, search } = req.query;
    const where = {};

    // ---- filtro rol ----
    if (rol !== undefined) {
      const rolNorm = normalizeRol(rol);
      if (!ROLES_VALIDOS.includes(rolNorm)) {
        return res.status(400).json({
          error: `Rol inválido. Debe ser uno de: ${ROLES_VALIDOS.join(", ")}`,
        });
      }
      where.rol = rolNorm;
    }

    // ---- filtro activo ----
    if (activo !== undefined) {
      where.activo = ["true", "1", true].includes(activo);
    }

    // ---- búsqueda ----
    if (search && normalizeString(search)) {
      const q = normalizeString(search);
      where.OR = [
        { username: { contains: q } },
        { nombre: { contains: q } },
      ];
    }

    const usuarios = await prisma.usuario.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    res.json(usuarios.map(mapUsuarioResponse));
  } catch (e) {
    console.error("adminGetUsuarios:", e);
    res.status(500).json({ error: "Error listando usuarios" });
  }
}

/* =====================================================
   GET /admin-users/:username
===================================================== */
export async function adminGetUsuarioByUsername(req, res) {
  try {
    const username = normalizeString(req.params.username);

    if (!username) {
      return res.status(400).json({ error: "Username requerido" });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { username },
    });

    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json(mapUsuarioResponse(usuario));
  } catch (e) {
    console.error("adminGetUsuarioByUsername:", e);
    res.status(500).json({ error: "Error obteniendo usuario" });
  }
}

/* =====================================================
   POST /admin-users
===================================================== */
export async function adminCreateUsuario(req, res) {
  try {
    const { username, nombre, rol, password } = req.body || {};

    const usernameNorm = normalizeString(username);
    const nombreNorm = normalizeString(nombre);
    const rolNorm = normalizeRol(rol);
    const passwordNorm = normalizeString(password);

    if (!usernameNorm || !rolNorm || !passwordNorm) {
      return res.status(400).json({
        error: "username, rol y password son obligatorios",
      });
    }

    if (!ROLES_VALIDOS.includes(rolNorm)) {
      return res.status(400).json({
        error: `Rol inválido. Debe ser uno de: ${ROLES_VALIDOS.join(", ")}`,
      });
    }

    const existe = await prisma.usuario.findUnique({
      where: { username: usernameNorm },
    });

    if (existe) {
      return res.status(409).json({
        error: "Ya existe un usuario con ese username",
      });
    }

    const nuevo = await prisma.usuario.create({
      data: {
        username: usernameNorm,
        nombre: nombreNorm || usernameNorm,
        password: passwordNorm, // plano (decisión del proyecto)
        rol: rolNorm,
        activo: true,
      },
    });

    res.status(201).json({
      message: "Usuario creado",
      usuario: mapUsuarioResponse(nuevo),
    });
  } catch (e) {
    console.error("adminCreateUsuario:", e);
    res.status(500).json({ error: "Error creando usuario" });
  }
}

/* =====================================================
   PUT /admin-users/:username
===================================================== */
export async function adminUpdateUsuario(req, res) {
  try {
    const username = normalizeString(req.params.username);
    const { nombre, rol, password, activo } = req.body || {};

    if (!username) {
      return res.status(400).json({ error: "Username requerido" });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { username },
    });

    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // ---- rol ----
    let rolFinal = usuario.rol;
    if (rol !== undefined) {
      const rolNorm = normalizeRol(rol);
      if (!ROLES_VALIDOS.includes(rolNorm)) {
        return res.status(400).json({
          error: `Rol inválido. Debe ser uno de: ${ROLES_VALIDOS.join(", ")}`,
        });
      }
      rolFinal = rolNorm;
    }

    // ---- data final ----
    const data = {
      nombre:
        typeof nombre === "string" && nombre.trim() !== ""
          ? nombre.trim()
          : usuario.nombre,

      rol: rolFinal,

      activo:
        typeof activo === "boolean"
          ? activo
          : usuario.activo,
    };

    if (typeof password === "string" && password.trim() !== "") {
      data.password = password.trim();
    }

    const actualizado = await prisma.usuario.update({
      where: { username },
      data,
    });

    res.json({
      message: "Usuario actualizado",
      usuario: mapUsuarioResponse(actualizado),
    });
  } catch (e) {
    console.error("adminUpdateUsuario:", e);
    res.status(500).json({ error: "Error actualizando usuario" });
  }
}


/* =====================================================
   DELETE /admin-users/:username
   (borrado físico)
===================================================== */
export async function adminDeleteUsuario(req, res) {
  try {
    const username = req.params.username;

    if (!username) {
      return res.status(400).json({ error: "Username requerido" });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { username },
    });

    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // ⚠️ Protección mínima: no borrar último admin
    if (usuario.rol === "admin") {
      const admins = await prisma.usuario.count({
        where: { rol: "admin" },
      });

      if (admins <= 1) {
        return res.status(409).json({
          error: "No se puede eliminar el último administrador",
        });
      }
    }

    await prisma.usuario.delete({
      where: { username },
    });

    res.json({ message: "Usuario eliminado correctamente" });
  } catch (e) {
    console.error("adminDeleteUsuario:", e);
    res.status(500).json({ error: "Error eliminando usuario" });
  }
}

