import { readDB, writeDB } from "../utils/file.js";

/* ========================================================
   NORMALIZAR ESTADO (FUENTE DE VERDAD)
======================================================== */
function normalizeEstado(raw) {
  const v = String(raw || "").trim().toLowerCase();

  if (
    [
      "disponible",
      "asignada",
      "no_devuelta",
      "fuera_servicio",
      "reparacion",
      "baja"
    ].includes(v)
  ) {
    return v;
  }

  if (v === "no devuelta" || v === "nodevuelta") return "no_devuelta";
  if (v === "fuera de servicio") return "fuera_servicio";
  if (v === "en reparacion" || v === "en reparación" || v === "reparación")
    return "reparacion";

  return v || "desconocido";
}

/* ========================================================
   GET /admin/maquinas
======================================================== */
export function adminGetMaquinas(req, res) {
  const { tipo, estado, search } = req.query;

  const db = readDB();
  let maquinas = (db.maquinas || []).map(m => ({
    ...m,
    estado: normalizeEstado(m.estado)
  }));

  if (tipo) {
    maquinas = maquinas.filter(m => m.tipo === tipo);
  }

  if (estado) {
    const estNorm = normalizeEstado(estado);
    maquinas = maquinas.filter(m => m.estado === estNorm);
  }

  if (search) {
    const q = String(search).toLowerCase();
    maquinas = maquinas.filter(m =>
      (m.id || "").toLowerCase().includes(q) ||
      (m.tipo || "").toLowerCase().includes(q) ||
      (m.modelo || "").toLowerCase().includes(q) ||
      (m.serie || "").toLowerCase().includes(q)
    );
  }

  res.json(maquinas);
}

/* ========================================================
   GET /admin/maquinas/:id
======================================================== */
export function adminGetMaquinaById(req, res) {
  const { id } = req.params;
  const db = readDB();

  const maquina = (db.maquinas || []).find(m => m.id === id);
  if (!maquina) {
    return res.status(404).json({ error: "Máquina no encontrada" });
  }

  let asignacion = null;
  for (const p of db.pedidos || []) {
    if ((p.itemsAsignados || []).some(m => m.id === id)) {
      asignacion = {
        pedidoId: p.id,
        servicio: p.servicio || null,
        estadoPedido: p.estado
      };
      break;
    }
  }

  res.json({
    ...maquina,
    estado: normalizeEstado(maquina.estado),
    asignacion
  });
}

/* ========================================================
   POST /admin/maquinas
======================================================== */
export function adminCreateMaquina(req, res) {
  const { id, tipo, modelo, serie, estado } = req.body || {};

  if (!id || !tipo || !modelo) {
    return res.status(400).json({
      error: "id, tipo y modelo son obligatorios"
    });
  }

  const db = readDB();
  db.maquinas = db.maquinas || [];

  if (db.maquinas.some(m => m.id === id)) {
    return res.status(409).json({
      error: `Ya existe una máquina con código ${id}`
    });
  }

  const nueva = {
    id: String(id),
    tipo: String(tipo),
    modelo: String(modelo),
    serie: serie ? String(serie) : "",
    estado: normalizeEstado(estado || "disponible")
  };

  db.maquinas.push(nueva);
  writeDB(db);

  res.status(201).json({
    message: "Máquina creada correctamente",
    maquina: nueva
  });
}

/* ========================================================
   PUT /admin/maquinas/:id
======================================================== */
export function adminUpdateMaquina(req, res) {
  const { id } = req.params;
  const { tipo, modelo, serie, estado } = req.body || {};

  const db = readDB();
  const idx = (db.maquinas || []).findIndex(m => m.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "Máquina no encontrada" });
  }

  const original = db.maquinas[idx];

  db.maquinas[idx] = {
    ...original,
    tipo: tipo ?? original.tipo,
    modelo: modelo ?? original.modelo,
    serie: serie ?? original.serie,
    estado: estado !== undefined ? normalizeEstado(estado) : normalizeEstado(original.estado)
  };

  writeDB(db);
  res.json({
    message: "Máquina actualizada correctamente",
    maquina: db.maquinas[idx]
  });
}

/* ========================================================
   DELETE /admin/maquinas/:id (BAJA LÓGICA)
======================================================== */
export function adminDeleteMaquina(req, res) {
  const { id } = req.params;
  const db = readDB();

  const maquina = (db.maquinas || []).find(m => m.id === id);
  if (!maquina) {
    return res.status(404).json({ error: "Máquina no encontrada" });
  }

  maquina.estado = "baja";
  writeDB(db);

  res.json({
    message: "Máquina dada de baja correctamente",
    maquina
  });
}

/* ========================================================
   PUT /admin/maquinas/:id/estado
======================================================== */
export function adminCambiarEstado(req, res) {
  const { id } = req.params;
  const { estado } = req.body || {};

  if (!estado) {
    return res.status(400).json({ error: "Debe enviar el nuevo estado" });
  }

  const ESTADOS_VALIDOS = [
    "disponible",
    "asignada",
    "no_devuelta",
    "fuera_servicio",
    "reparacion",
    "baja"
  ];

  const estadoNorm = normalizeEstado(estado);
  if (!ESTADOS_VALIDOS.includes(estadoNorm)) {
    return res.status(400).json({
      error: `Estado inválido. Debe ser uno de: ${ESTADOS_VALIDOS.join(", ")}`
    });
  }

  const db = readDB();
  const maquina = (db.maquinas || []).find(m => m.id === id);
  if (!maquina) {
    return res.status(404).json({ error: "Máquina no encontrada" });
  }

  maquina.estado = estadoNorm;
  writeDB(db);

  res.json({
    message: "Estado actualizado correctamente",
    maquina
  });
}

/* ========================================================
   GET /admin/maquinas/stock-resumen
======================================================== */
export function adminResumenStock(req, res) {
  const db = readDB();
  const maquinas = db.maquinas || [];

  const porEstado = {};
  const porTipo = {};

  for (const m of maquinas) {
    const est = normalizeEstado(m.estado);
    porEstado[est] = (porEstado[est] || 0) + 1;

    const tipo = m.tipo || "SIN_TIPO";
    if (!porTipo[tipo]) {
      porTipo[tipo] = {
        total: 0,
        disponible: 0,
        asignada: 0,
        no_devuelta: 0,
        fuera_servicio: 0,
        reparacion: 0,
        baja: 0
      };
    }

    porTipo[tipo].total += 1;
    if (porTipo[tipo][est] !== undefined) {
      porTipo[tipo][est] += 1;
    }
  }

  res.json({ porEstado, porTipo });
}
