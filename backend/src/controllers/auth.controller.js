import { readDB } from "../utils/file.js";

export function login(req, res) {
  const { username, password } = req.body;

  const db = readDB();
  if (!db) return res.status(500).json({ error: "DB no disponible" });

  const user = db.usuarios.find(
    u => u.username === username && u.password === password
  );

  if (!user) return res.status(401).json({ error: "Credenciales inválidas" });

  const token = `${user.username}-${Date.now()}`;

  return res.json({
    message: "Login correcto",
    token,
    user: {
      id: user.id,
      username: user.username,
      rol: user.rol
    }
  });
}
