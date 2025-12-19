// backend/src/controllers/auth.controller.js
import prisma from "../db/prisma.js";

export async function login(req, res) {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        error: "Username y password son obligatorios",
      });
    }

    const user = await prisma.usuario.findFirst({
      where: {
        username,
        password, // ⚠️ texto plano, igual que antes
        activo: true,
      },
      select: {
        id: true,
        username: true,
        rol: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const token = `${user.username}-${Date.now()}`;

    res.json({
      message: "Login correcto",
      token,
      user: {
        id: user.id,
        username: user.username,
        rol: user.rol.toUpperCase(), // 👈 contrato del front
      },
    });
  } catch (e) {
    console.error("login:", e);
    res.status(500).json({ error: "Error en login" });
  }
}
