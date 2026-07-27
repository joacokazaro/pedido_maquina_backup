import prisma from "../db/prisma.js";
import ExcelJS from "exceljs";
import {
  buildUserRoleResponse,
  derivePrimaryRole,
  isAllowedRoleCombination,
  normalizeRole,
  normalizeRoles,
  roleLabel,
  rolesFromUser,
  ROLES_VALIDOS,
  whereHasRole,
} from "../services/roles.service.js";
import { requireActor } from "../services/requestActor.service.js";

/* =====================================================
   CONSTANTES
===================================================== */
/* =====================================================
  HELPERS
===================================================== */

function normalizeString(v) {
  return typeof v === "string" ? v.trim() : null;
}

function mapUsuarioResponse(u) {
  return {
    id: u.id,
    username: u.username,
    nombre: u.nombre,
    ...buildUserRoleResponse(u),
    activo: u.activo,
    vtoCarnetConductor: u.vtoCarnetConductor,
    createdAt: u.createdAt,
  };
}

function parseRolesFromPayload(payload, fallbackRole = null) {
  const rolesArray = normalizeRoles(payload?.roles);
  if (rolesArray.length > 0) return rolesArray;

  const single = normalizeRole(payload?.rol ?? fallbackRole);
  return single ? [single] : [];
}

function formatDateForSpreadsheet(value) {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

function parseNullableDate(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/* =====================================================
   GET /admin-users
   ?rol=&activo=&search=
===================================================== */
export async function adminGetUsuarios(req, res) {
  try {
    const { rol, activo, search } = req.query;
    const where = {};
    const andClauses = [];

    // ---- filtro rol ----
    if (rol !== undefined) {
      const rolNorm = normalizeRole(rol);
      if (!ROLES_VALIDOS.includes(rolNorm)) {
        return res.status(400).json({
          error: `Rol inválido. Debe ser uno de: ${ROLES_VALIDOS.join(", ")}`,
        });
      }
      andClauses.push(whereHasRole(rolNorm));
    }

    // ---- filtro activo ----
    if (activo !== undefined) {
      where.activo = ["true", "1", true].includes(activo);
    }

    // ---- búsqueda ----
    if (search && normalizeString(search)) {
      const q = normalizeString(search);
      andClauses.push({
        OR: [
        { username: { contains: q } },
        { nombre: { contains: q } },
        ],
      });
    }

    if (andClauses.length > 0) {
      where.AND = andClauses;
    }

    const usuarios = await prisma.usuario.findMany({
      where,
      include: {
        roles: {
          select: { rol: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(usuarios.map(mapUsuarioResponse));
  } catch (e) {
    console.error("adminGetUsuarios:", e);
    res.status(500).json({ error: "Error listando usuarios" });
  }
}

/* =====================================================
   GET /admin-users/export
   Excel con los datos de los usuarios (nunca la contraseña)
===================================================== */
export async function adminExportUsuarios(req, res) {
  try {
    const actor = await requireActor(req, res, ["admin"]);
    if (!actor) return;

    const usuarios = await prisma.usuario.findMany({
      select: {
        username: true,
        nombre: true,
        rol: true,
        roles: { select: { rol: true } },
        activo: true,
        vtoCarnetConductor: true,
        createdAt: true,
      },
      orderBy: { nombre: "asc" },
    });

    const headers = [
      "NOMBRE Y APELLIDO",
      "USUARIO",
      "ROL",
      "ROLES",
      "ESTADO",
      "VTO CARNET CONDUCTOR",
      "FECHA DE ALTA",
    ];

    const rows = usuarios.map((u) => {
      const roles = rolesFromUser(u);
      return [
        u.nombre || "",
        u.username,
        roleLabel(derivePrimaryRole(roles, u.rol)),
        roles.map(roleLabel).join(" · "),
        u.activo ? "Activo" : "Inactivo",
        formatDateForSpreadsheet(u.vtoCarnetConductor),
        formatDateForSpreadsheet(u.createdAt),
      ];
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Usuarios");
    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true };
    rows.forEach((row) => worksheet.addRow(row));
    headers.forEach((header, index) => {
      worksheet.getColumn(index + 1).width = Math.max(
        header.length + 2,
        ...rows.map((row) => String(row[index] ?? "").length + 2)
      );
    });

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="usuarios-${Date.now()}.xlsx"`
    );
    res.send(buffer);
  } catch (e) {
    console.error("adminExportUsuarios:", e);
    res.status(500).json({ error: "Error exportando usuarios" });
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
      include: {
        roles: {
          select: { rol: true },
        },
      },
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
    const { username, nombre, rol, roles, password, vtoCarnetConductor } = req.body || {};

    const usernameNorm = normalizeString(username);
    const nombreNorm = normalizeString(nombre);
    const rolesNorm = parseRolesFromPayload({ rol, roles });
    const passwordNorm = normalizeString(password);
    const vtoCarnetConductorDate = parseNullableDate(vtoCarnetConductor);

    if (!usernameNorm || rolesNorm.length === 0 || !passwordNorm) {
      return res.status(400).json({
        error: "username, roles y password son obligatorios",
      });
    }

    if (!isAllowedRoleCombination(rolesNorm)) {
      return res.status(400).json({
        error: "Combinación de roles no permitida. Solo se admite un rol, o la combinación DEPOSITO + TALLER.",
      });
    }

    if (vtoCarnetConductor !== undefined && vtoCarnetConductorDate === undefined) {
      return res.status(400).json({ error: "vtoCarnetConductor inválido" });
    }

    const existe = await prisma.usuario.findUnique({
      where: { username: usernameNorm },
    });

    if (existe) {
      return res.status(409).json({
        error: "Ya existe un usuario con ese username",
      });
    }

    const rolPrincipal = derivePrimaryRole(rolesNorm);

    const nuevo = await prisma.usuario.create({
      data: {
        username: usernameNorm,
        nombre: nombreNorm || usernameNorm,
        password: passwordNorm, // plano (decisión del proyecto)
        rol: rolPrincipal,
        activo: true,
        vtoCarnetConductor: vtoCarnetConductorDate ?? null,
        roles: {
          create: rolesNorm.map((r) => ({ rol: r })),
        },
      },
      include: {
        roles: {
          select: { rol: true },
        },
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
    const { nombre, rol, roles, password, activo, vtoCarnetConductor } = req.body || {};

    if (!username) {
      return res.status(400).json({ error: "Username requerido" });
    }

    const vtoCarnetConductorDate = parseNullableDate(vtoCarnetConductor);
    if (vtoCarnetConductor !== undefined && vtoCarnetConductorDate === undefined) {
      return res.status(400).json({ error: "vtoCarnetConductor inválido" });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { username },
      include: {
        roles: {
          select: { rol: true },
        },
      },
    });

    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // ---- rol ----
    const rolesActuales = normalizeRoles((usuario.roles || []).map((r) => r.rol));
    const rolesFinales =
      roles !== undefined || rol !== undefined
        ? parseRolesFromPayload({ roles, rol }, usuario.rol)
        : rolesActuales.length > 0
          ? rolesActuales
          : [normalizeRole(usuario.rol)].filter(Boolean);

    if (rolesFinales.length === 0) {
      return res.status(400).json({
        error: `Rol inválido. Debe ser uno de: ${ROLES_VALIDOS.join(", ")}`,
      });
    }

    if (!isAllowedRoleCombination(rolesFinales)) {
      return res.status(400).json({
        error: "Combinación de roles no permitida. Solo se admite un rol, o la combinación DEPOSITO + TALLER.",
      });
    }

    const rolFinal = derivePrimaryRole(rolesFinales, usuario.rol);

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

    if (vtoCarnetConductor !== undefined) {
      data.vtoCarnetConductor = vtoCarnetConductorDate;
    }

    const actualizado = await prisma.$transaction(async (tx) => {
      await tx.usuarioRol.deleteMany({ where: { usuarioId: usuario.id } });

      for (const role of rolesFinales) {
        await tx.usuarioRol.create({
          data: { usuarioId: usuario.id, rol: role },
        });
      }

      return tx.usuario.update({
        where: { username },
        data,
        include: {
          roles: {
            select: { rol: true },
          },
        },
      });
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
      include: {
        roles: {
          select: { rol: true },
        },
        _count: {
          select: {
            historialAcciones: true,
            pedidosSupervisor: true,
            serviciosAsignados: true,
            notificaciones: true,
          },
        },
      },
    });

    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // ⚠️ Protección mínima: no borrar último admin
    const rolesUsuario = normalizeRoles((usuario.roles || []).map((r) => r.rol));
    if (rolesUsuario.includes("admin")) {
      const admins = await prisma.usuario.count({
        where: whereHasRole("admin"),
      });

      if (admins <= 1) {
        return res.status(409).json({
          error: "No se puede eliminar el último administrador",
        });
      }
    }

    const actualizado = await prisma.usuario.update({
      where: { username },
      data: { activo: false },
    });

    res.json({
      message: "Usuario desactivado correctamente",
      usuario: mapUsuarioResponse(actualizado),
    });
  } catch (e) {
    console.error("adminDeleteUsuario:", e);
    res.status(500).json({ error: "Error eliminando usuario" });
  }
}

