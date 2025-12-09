import { readDB, writeDB } from "../utils/file.js";

export function getMaquinas(req, res) {
  const db = readDB();
  return res.json(db.maquinas);
}

export function getMaquinaById(req, res) {
  const db = readDB();
  const maquina = db.maquinas.find(m => m.id === req.params.id);

  if (!maquina) {
    return res.status(404).json({ error: "Máquina no encontrada" });
  }

  return res.json(maquina);
}

export function getMaquinasPorTipo(req, res) {
  const db = readDB();
  const tipo = req.params.tipo.toUpperCase();

  const filtradas = db.maquinas.filter(m => m.tipo.toUpperCase() === tipo);

  return res.json(filtradas);
}

export function actualizarEstado(req, res) {
  const { id } = req.params;
  const { estado } = req.body;

  const db = readDB();
  const maquina = db.maquinas.find(m => m.id === id);

  if (!maquina) {
    return res.status(404).json({ error: "Máquina no encontrada" });
  }

  maquina.estado = estado;
  writeDB(db);

  return res.json({ message: "Estado actualizado", maquina });
}
