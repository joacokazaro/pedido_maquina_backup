import prisma from "../db/prisma.js";

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
        rol: user.rol.toUpperCase(), // 👈 contrato con el front
      },
    });
  } catch (e) {
    console.error("login:", e);
    res.status(500).json({ error: "Error en login" });
  }
}
