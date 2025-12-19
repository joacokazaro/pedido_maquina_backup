// backend/src/controllers/admin_usuarios.controller.js
import { RolUsuario } from "@prisma/client";
import prisma from "../db/prisma.js";

/**
 * Helpers
 */
function mapUsuarioResponse(u) {
  return {
    id: u.id,
    username: u.username,
    nombre: u.nombre,
    rol: u.rol.toUpperCase(), // 👈 CLAVE
    activo: u.activo,
    createdAt: u.createdAt,
  };
}

/**
 * GET /admin-users
 */
export async function adminGetUsuarios(req, res) {
  try {
    const { rol, activo, search } = req.query;
    const where = {};

    if (rol) {
      const rolLower = String(rol).toLowerCase();
      if (!Object.values(RolUsuario).includes(rolLower)) {
        return res.status(400).json({
          error: `Rol inválido. Debe ser uno de: ${Object.values(RolUsuario).join(", ")}`,
        });
      }
      where.rol = rolLower;
    }

    if (typeof activo !== "undefined") {
      where.activo = activo === "true" || activo === "1";
    }

    if (search) {
      const q = String(search).toLowerCase();
      where.OR = [
        { username: { contains: q, mode: "insensitive" } },
        { nombre: { contains: q, mode: "insensitive" } },
      ];
    }

    const usuarios = await prisma.usuario.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    res.json(usuarios.map(mapUsuarioResponse));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error listando usuarios" });
  }
}

/**
 * GET /admin-users/:username
 */
export async function adminGetUsuarioByUsername(req, res) {
  try {
    const { username } = req.params;

    const usuario = await prisma.usuario.findUnique({
      where: { username },
    });

    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json(mapUsuarioResponse(usuario));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error obteniendo usuario" });
  }
}

/**
 * POST /admin-users
 */
export async function adminCreateUsuario(req, res) {
  try {
    const { username, nombre, rol, password } = req.body || {};

    if (!username || !rol || !password) {
      return res.status(400).json({
        error: "username, rol y password son obligatorios",
      });
    }

    const rolLower = String(rol).toLowerCase();
    if (!Object.values(RolUsuario).includes(rolLower)) {
      return res.status(400).json({
        error: `Rol inválido. Debe ser uno de: ${Object.values(RolUsuario).join(", ")}`,
      });
    }

    const existe = await prisma.usuario.findUnique({ where: { username } });
    if (existe) {
      return res.status(409).json({
        error: "Ya existe un usuario con ese username",
      });
    }

    const nuevo = await prisma.usuario.create({
      data: {
        username,
        nombre: nombre || username,
        password, // plano por ahora
        rol: rolLower,
        activo: true,
      },
    });

    res.status(201).json({
      message: "Usuario creado",
      usuario: mapUsuarioResponse(nuevo),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error creando usuario" });
  }
}

/**
 * PUT /admin-users/:username
 */
export async function adminUpdateUsuario(req, res) {
  try {
    const { username } = req.params;
    const { nombre, rol, password, activo } = req.body || {};

    const usuario = await prisma.usuario.findUnique({ where: { username } });
    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    let rolFinal = usuario.rol;
    if (rol !== undefined) {
      const rolLower = String(rol).toLowerCase();
      if (!Object.values(RolUsuario).includes(rolLower)) {
        return res.status(400).json({
          error: `Rol inválido. Debe ser uno de: ${Object.values(RolUsuario).join(", ")}`,
        });
      }
      rolFinal = rolLower;
    }

    const actualizado = await prisma.usuario.update({
      where: { username },
      data: {
        nombre: nombre ?? usuario.nombre,
        rol: rolFinal,
        password:
          password && password.trim() !== "" ? password : usuario.password,
        activo: typeof activo === "boolean" ? activo : usuario.activo,
      },
    });

    res.json({
      message: "Usuario actualizado",
      usuario: mapUsuarioResponse(actualizado),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error actualizando usuario" });
  }
}

/**
 * DELETE /admin-users/:username
 */
export async function adminDeleteUsuario(req, res) {
  try {
    const { username } = req.params;

    const usuario = await prisma.usuario.findUnique({ where: { username } });
    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const actualizado = await prisma.usuario.update({
      where: { username },
      data: { activo: false },
    });

    res.json({
      message: "Usuario dado de baja",
      usuario: mapUsuarioResponse(actualizado),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error dando de baja usuario" });
  }
}
