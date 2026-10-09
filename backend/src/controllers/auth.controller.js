import prisma from "../db/prisma.js";
import {
  buildUserRoleResponse,
  derivePrimaryRole,
  rolesFromUser,
} from "../services/roles.service.js";
import { leerAcceso360, verifyToken360 } from "../services/sso360.service.js";
import { signSessionToken } from "../services/sessionToken.service.js";

/* ========================================================
   HELPERS
======================================================== */
function normalizeUsername(username) {
  return String(username || "").trim();
}

// Transición: el login con contraseña local sigue andando hasta que todos estén en Kazaró 360.
// Después, PASSWORD_LOGIN_ENABLED=false en backend/.env lo apaga sin tocar código.
function passwordLoginEnabled() {
  return String(process.env.PASSWORD_LOGIN_ENABLED ?? "true").trim().toLowerCase() !== "false";
}

// ROLES_360_MODO=observar (default): el login por 360 NO modifica nada de lo que ya existe en la
// base de la app (ni roles ni email de usuarios existentes): solo avisa en el log si 360 y la app
// no coinciden. ROLES_360_MODO=aplicar: 360 manda y se reescriben roles/email al entrar.
// Dar de alta un Usuario que no existía sí se hace siempre (es solo agregar).
function aplicarCambiosDesde360() {
  return String(process.env.ROLES_360_MODO || "observar").trim().toLowerCase() === "aplicar";
}

function sameRoleSet(a, b) {
  const sa = [...new Set(a)].sort().join(",");
  const sb = [...new Set(b)].sort().join(",");
  return sa === sb;
}

// "juan.perez@kazaro.com.ar" -> "juan.perez"; si ya existe, "juan.perez2", "juan.perez3"...
async function usernameLibre(email) {
  const base =
    (email.split("@")[0] || "usuario").replace(/[^a-z0-9._-]/gi, "").toLowerCase() || "usuario";
  let candidato = base;
  for (
    let n = 2;
    await prisma.usuario.findUnique({ where: { username: candidato }, select: { id: true } });
    n++
  ) {
    candidato = `${base}${n}`;
  }
  return candidato;
}

const SELECT_USUARIO = {
  id: true,
  username: true,
  email: true,
  legajo: true,
  rol: true,
  roles: { select: { rol: true } },
  activo: true,
};

// Une la cuenta de 360 con el Usuario local (que conserva servicios asignados, historial,
// etc.): primero por email, después por legajo (identidad.perfiles.legajo <-> Usuario.legajo,
// para los usuarios viejos que todavía no tienen email cargado). Si no hay ninguno, lo crea.
// El rol SIEMPRE se alinea con lo que dice 360.
async function resolverUsuarioDesde360({ email, acceso }) {
  const rolesApp = acceso.rolesApp; // null si el rol de 360 es el genérico "Usuario"

  let user = await prisma.usuario.findUnique({ where: { email }, select: SELECT_USUARIO });

  if (!user) {
    // Emails cargados a mano con mayúsculas: el índice único es sensible a mayúsculas.
    const filas = await prisma.$queryRaw`SELECT id FROM Usuario WHERE lower(email) = ${email} LIMIT 1`;
    if (filas.length > 0) {
      user = await prisma.usuario.findUnique({ where: { id: filas[0].id }, select: SELECT_USUARIO });
    }
  }

  if (!user && acceso.legajo) {
    const porLegajo = await prisma.usuario.findUnique({
      where: { legajo: acceso.legajo },
      select: SELECT_USUARIO,
    });
    // Solo se vincula si ese legajo no tiene ya OTRO email cargado.
    if (porLegajo && (!porLegajo.email || porLegajo.email.toLowerCase() === email)) {
      user = porLegajo;
    }
  }

  // Rol genérico de 360: solo entra quien YA existe en la app (con el rol que ya tiene). No se crea
  // ninguna cuenta ni se toca ningún rol, porque 360 no dice cuál corresponde.
  if (acceso.generico) {
    if (!user) return null;
    if (user.email !== email && aplicarCambiosDesde360()) {
      return prisma.usuario.update({ where: { id: user.id }, data: { email }, select: SELECT_USUARIO });
    }
    return user;
  }

  if (!user) {
    // El legajo es único: si ya lo usa otra cuenta local (con otro email), se crea sin él.
    const legajoOcupado = acceso.legajo
      ? await prisma.usuario.findUnique({ where: { legajo: acceso.legajo }, select: { id: true } })
      : null;

    return prisma.usuario.create({
      data: {
        username: await usernameLibre(email),
        nombre: acceso.nombre,
        email,
        legajo: legajoOcupado ? null : acceso.legajo,
        rol: derivePrimaryRole(rolesApp),
        roles: { create: rolesApp.map((rol) => ({ rol })) },
      },
      select: SELECT_USUARIO,
    });
  }

  const cambios = {};
  if (user.email !== email) cambios.email = email;
  if (!sameRoleSet(rolesFromUser(user), rolesApp)) {
    cambios.rol = derivePrimaryRole(rolesApp);
    cambios.roles = { deleteMany: {}, create: rolesApp.map((rol) => ({ rol })) };
  }

  if (Object.keys(cambios).length === 0) return user;

  if (!aplicarCambiosDesde360()) {
    console.warn(
      `[360][observar] ${user.username}: la app tiene roles [${rolesFromUser(user).join(",")}] email="${user.email || ""}" ` +
        `y 360 dice [${rolesApp.join(",")}] ${email}. No se modificó nada (ROLES_360_MODO=observar).`
    );
    return user;
  }

  return prisma.usuario.update({ where: { id: user.id }, data: cambios, select: SELECT_USUARIO });
}

/* ========================================================
   POST /login
   Transitorio: contraseña local. Se apaga con PASSWORD_LOGIN_ENABLED=false
   cuando todos entren por Kazaró 360.
======================================================== */
export async function login(req, res) {
  try {
    const { username, password } = req.body || {};

    if (!passwordLoginEnabled()) {
      return res.status(403).json({
        error: "El ingreso con usuario y contraseña está deshabilitado. Entrá con Kazaró 360.",
      });
    }

    if (!username || !password) {
      return res.status(400).json({
        error: "Username y password son obligatorios",
      });
    }

    const usernameNorm = normalizeUsername(username);

    const user = await prisma.usuario.findUnique({
      where: { username: usernameNorm },
      select: {
        id: true,
        username: true,
        password: true,
        rol: true,
        roles: { select: { rol: true } },
        activo: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    if (!user.activo) {
      return res.status(403).json({ error: "Usuario inactivo" });
    }

    if (user.password !== password) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const token = await signSessionToken(user);

    res.json({
      message: "Login correcto",
      token,
      user: {
        id: user.id,
        username: user.username,
        ...buildUserRoleResponse(user),
      },
    });
  } catch (e) {
    console.error("login:", e);
    res.status(500).json({ error: "Error en login" });
  }
}

/* ========================================================
   POST /login-360
   Login delegado a Kazaró 360 (Supabase Auth): el frontend manda el
   access_token que ya trae de 360. Acá se verifica su firma, se lee el
   rol de la cuenta en 360 (identidad.accesos, proyecto app_maquinas), se
   vincula/crea el Usuario local y se emite la sesión firmada de la app.
   Quién entra y con qué rol se administra SOLO desde Kazaró 360.
======================================================== */
export async function loginCon360(req, res) {
  try {
    const { token } = req.body || {};

    if (!token) {
      return res.status(400).json({ error: "Falta el token de Kazaró 360" });
    }

    let email;
    try {
      ({ email } = await verifyToken360(token));
    } catch (e) {
      return res.status(401).json({ error: "Token de Kazaró 360 inválido o vencido" });
    }

    let acceso;
    try {
      acceso = await leerAcceso360(token);
    } catch (e) {
      console.error("loginCon360: no se pudo leer el acceso en 360:", e);
      return res.status(502).json({
        error: "No se pudieron consultar tus permisos en Kazaró 360. Probá de nuevo en un momento.",
      });
    }

    if (!acceso) {
      return res.status(403).json({
        error: "Tu cuenta de Kazaró 360 no tiene acceso a esta app. Pedile a un administrador que te lo habilite.",
      });
    }

    if (!acceso.rolesApp && !acceso.generico) {
      return res.status(403).json({
        error: `Tu rol en Kazaró 360 ("${acceso.rol360}") no corresponde a un rol de esta app. Pedile a un administrador que lo corrija.`,
      });
    }

    const user = await resolverUsuarioDesde360({ email, acceso });

    if (!user) {
      return res.status(403).json({
        error:
          "Tu cuenta de Kazaró 360 tiene acceso a esta app pero todavía no tiene un usuario ni un rol asignado. " +
          "Si ya tenés usuario y contraseña de la app, entrá con ellos; si no, pedile a un administrador que te dé un rol.",
      });
    }

    if (!user.activo) {
      return res.status(403).json({ error: "Usuario inactivo" });
    }

    const sessionToken = await signSessionToken(user);

    res.json({
      message: "Login con Kazaró 360 correcto",
      token: sessionToken,
      user: {
        id: user.id,
        username: user.username,
        ...buildUserRoleResponse(user),
      },
    });
  } catch (e) {
    console.error("loginCon360:", e);
    res.status(500).json({ error: "Error en login con Kazaró 360" });
  }
}
