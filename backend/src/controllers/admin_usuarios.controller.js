// backend/src/controllers/admin_usuarios.controller.js
import { readDB, writeDB } from "../utils/file.js";

/**
 * GET /admin-users
 * Query opcionales:
 *  - rol  (ADMIN | SUPERVISOR | DEPOSITO)
 *  - activo (true / false / 1 / 0)
 *  - search (username o nombre)
 */
export function adminGetUsuarios(req, res) {
  const { rol, activo, search } = req.query;

  const db = readDB();
  let usuarios = db.usuarios || [];

  if (rol) {
    const rolUpper = String(rol).toUpperCase();
    usuarios = usuarios.filter(u => (u.rol || "").toUpperCase() === rolUpper);
  }

  if (typeof activo !== "undefined") {
    const flag = activo === "true" || activo === "1";
    usuarios = usuarios.filter(u => u.activo === flag);
  }

  if (search) {
    const q = String(search).toLowerCase();
    usuarios = usuarios.filter(u => {
      const username = (u.username || "").toLowerCase();
      const nombre = (u.nombre || "").toLowerCase();
      return username.includes(q) || nombre.includes(q);
    });
  }

  res.json(usuarios);
}

/**
 * GET /admin-users/:username
 */
export function adminGetUsuarioByUsername(req, res) {
  const { username } = req.params;

  const db = readDB();
  const usuario = (db.usuarios || []).find(u => u.username === username);

  if (!usuario) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  res.json(usuario);
}

/**
 * POST /admin-users
 * body:
 *  - username (obligatorio)
 *  - nombre   (opcional, si falta usamos username)
 *  - rol      (ADMIN | SUPERVISOR | DEPOSITO)
 *  - password
 */
export function adminCreateUsuario(req, res) {
  const { username, nombre, rol, password } = req.body || {};

  if (!username || !rol || !password) {
    return res.status(400).json({
      error: "username, rol y password son obligatorios",
    });
  }

  const db = readDB();
  db.usuarios = db.usuarios || [];

  // normalizamos rol a MAYÚSCULAS
  const rolUpper = String(rol).toUpperCase();

  const ROLES_VALIDOS = ["ADMIN", "SUPERVISOR", "DEPOSITO"];
  if (!ROLES_VALIDOS.includes(rolUpper)) {
    return res.status(400).json({
      error: `Rol inválido. Debe ser uno de: ${ROLES_VALIDOS.join(", ")}`,
    });
  }

  if (db.usuarios.some(u => u.username === username)) {
    return res
      .status(409)
      .json({ error: "Ya existe un usuario con ese username" });
  }

  // calculamos próximo ID numérico
  const maxId = db.usuarios.reduce((max, u) => {
    const idNum = Number(u.id);
    return Number.isFinite(idNum) && idNum > max ? idNum : max;
  }, 0);
  const nextId = maxId + 1;

  const nuevo = {
    id: nextId,
    username,
    nombre: nombre || username,
    password,
    rol: rolUpper,
    activo: true,
    creadoEn: new Date().toISOString(),
  };

  db.usuarios.push(nuevo);
  writeDB(db);

  // devolvemos sin password
  const { password: _pw, ...rest } = nuevo;
  res.status(201).json({ message: "Usuario creado", usuario: rest });
}

/**
 * PUT /admin-users/:username
 * Permite editar nombre, rol, password y activo
 */
export function adminUpdateUsuario(req, res) {
  const { username } = req.params;
  const { nombre, rol, password, activo } = req.body || {};

  const db = readDB();
  db.usuarios = db.usuarios || [];

  const idx = db.usuarios.findIndex(u => u.username === username);
  if (idx === -1) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  const original = db.usuarios[idx];

  let rolFinal = original.rol;
  if (rol !== undefined) {
    const rolUpper = String(rol).toUpperCase();
    const ROLES_VALIDOS = ["ADMIN", "SUPERVISOR", "DEPOSITO"];
    if (!ROLES_VALIDOS.includes(rolUpper)) {
      return res.status(400).json({
        error: `Rol inválido. Debe ser uno de: ${ROLES_VALIDOS.join(", ")}`,
      });
    }
    rolFinal = rolUpper;
  }

  const actualizado = {
    ...original,
    nombre: nombre ?? original.nombre,
    rol: rolFinal,
    password: password && password.trim() !== "" ? password : original.password,
    activo:
      typeof activo === "boolean" || activo === true || activo === false
        ? Boolean(activo)
        : original.activo,
  };

  db.usuarios[idx] = actualizado;
  writeDB(db);

  const { password: _pw, ...rest } = actualizado;
  res.json({ message: "Usuario actualizado", usuario: rest });
}

/**
 * DELETE /admin-users/:username
 * Baja lógica: activo = false
 */
export function adminDeleteUsuario(req, res) {
  const { username } = req.params;

  const db = readDB();
  db.usuarios = db.usuarios || [];

  const usuario = db.usuarios.find(u => u.username === username);
  if (!usuario) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  usuario.activo = false;
  writeDB(db);

  const { password: _pw, ...rest } = usuario;
  res.json({ message: "Usuario dado de baja", usuario: rest });
}
