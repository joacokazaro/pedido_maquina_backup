import prisma from "../db/prisma.js";
import { buildUserRoleResponse } from "../services/roles.service.js";
import { verifyToken360 } from "../services/sso360.service.js";

/* ========================================================
   HELPERS
======================================================== */
function normalizeUsername(username) {
  return String(username || "").trim();
}

/* ========================================================
   POST /login
======================================================== */
export async function login(req, res) {
  try {
    const { username, password } = req.body || {};

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

    // 🔐 Token simple (mock / dev)
    const token = `${user.username}-${Date.now()}`;

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
   access_token que ya trae de 360, acá se verifica su firma y se
   resuelve el Usuario local por email. No crea cuentas nuevas: el
   alta sigue siendo manual (ver CLAUDE.md, roles.service.js).
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

    const user = await prisma.usuario.findUnique({
      where: { email },
      select: {
        id: true,
        username: true,
        rol: true,
        roles: { select: { rol: true } },
        activo: true,
      },
    });

    if (!user) {
      return res.status(403).json({
        error: "Tu cuenta de Kazaró 360 todavía no tiene acceso a esta app. Pedile a un admin que te lo habilite.",
      });
    }

    if (!user.activo) {
      return res.status(403).json({ error: "Usuario inactivo" });
    }

    const sessionToken = `${user.username}-${Date.now()}`;

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
