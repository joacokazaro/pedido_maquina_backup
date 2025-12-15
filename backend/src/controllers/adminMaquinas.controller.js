import { readDB, writeDB } from "../utils/file.js";

/**
 * GET /admin/maquinas
 * Query params opcionales:
 *  - tipo
 *  - estado
 *  - search (id / modelo / serie / tipo)
 */
export function adminGetMaquinas(req, res) {
  const { tipo, estado, search } = req.query;

  const db = readDB();
  let maquinas = db.maquinas || [];

  if (tipo) {
    maquinas = maquinas.filter(m => m.tipo === tipo);
  }

  if (estado) {
    maquinas = maquinas.filter(m => m.estado === estado);
  }

  if (search) {
    const q = String(search).toLowerCase();

    maquinas = maquinas.filter(m => {
      const id = m.id?.toLowerCase() || "";
      const modelo = m.modelo?.toLowerCase() || "";
      const serie = m.serie?.toLowerCase() || "";
      const tipoM = m.tipo?.toLowerCase() || "";

      return (
        id.includes(q) ||
        modelo.includes(q) ||
        serie.includes(q) ||
        tipoM.includes(q)
      );
    });
  }

  res.json(maquinas);
}

/**
 * GET /admin/maquinas/:id
 */
export function adminGetMaquinaById(req, res) {
  const { id } = req.params;

  const db = readDB();

  const maquina = (db.maquinas || []).find(m => m.id === id);
  if (!maquina) {
    return res.status(404).json({ error: "Máquina no encontrada" });
  }

  // ===============================
  // BUSCAR ASIGNACIÓN EN PEDIDOS
  // ===============================
  let asignacion = null;

  const pedidos = db.pedidos || [];

  for (const p of pedidos) {
    const asignadas = p.itemsAsignados || [];

    const encontrada = asignadas.find(m => m.id === id);
    if (encontrada) {
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
    asignacion
  });
}


/**
 * POST /admin/maquinas
 * body:
 *  - id (obligatorio)
 *  - tipo
 *  - modelo
 *  - serie
 *  - estado (default: disponible)
 */
export function adminCreateMaquina(req, res) {
  const { id, tipo, modelo, serie, estado } = req.body || {};

  if (!id || !tipo || !modelo) {
    return res.status(400).json({
      error: "id, tipo y modelo son obligatorios"
    });
  }

  const db = readDB();
  db.maquinas = db.maquinas || [];

  const existe = db.maquinas.some(m => m.id === id);
  if (existe) {
    return res.status(409).json({
      error: `Ya existe una máquina con código ${id}`
    });
  }

  const nueva = {
    id: String(id),
    tipo: String(tipo),
    modelo: String(modelo),
    serie: serie ? String(serie) : "",
    estado: estado || "disponible"
  };

  db.maquinas.push(nueva);
  writeDB(db);

  res.status(201).json({
    message: "Máquina creada correctamente",
    maquina: nueva
  });
}

/**
 * PUT /admin/maquinas/:id
 * Edita tipo, modelo, serie y estado (NO cambia el id)
 */
export function adminUpdateMaquina(req, res) {
  const { id } = req.params;
  const { tipo, modelo, serie, estado } = req.body || {};

  const db = readDB();
  db.maquinas = db.maquinas || [];

  const idx = db.maquinas.findIndex(m => m.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "Máquina no encontrada" });
  }

  const original = db.maquinas[idx];

  const actualizada = {
    ...original,
    tipo: tipo ?? original.tipo,
    modelo: modelo ?? original.modelo,
    serie: serie ?? original.serie,
    estado: estado ?? original.estado
  };

  db.maquinas[idx] = actualizada;
  writeDB(db);

  res.json({
    message: "Máquina actualizada correctamente",
    maquina: actualizada
  });
}

/**
 * DELETE /admin/maquinas/:id
 * Baja lógica: estado = "baja"
 */
export function adminDeleteMaquina(req, res) {
  const { id } = req.params;

  const db = readDB();
  db.maquinas = db.maquinas || [];

  const maquina = db.maquinas.find(m => m.id === id);

  if (!maquina) {
    return res.status(404).json({ error: "Máquina no encontrada" });
  }

  maquina.estado = "baja";
  writeDB(db);

  res.json({
    message: "Máquina dada de baja correctamente (estado = 'baja')",
    maquina
  });
}

/**
 * PUT /admin/maquinas/:id/estado
 */
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

  if (!ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({
      error: `Estado inválido. Debe ser uno de: ${ESTADOS_VALIDOS.join(", ")}`
    });
  }

  const db = readDB();
  db.maquinas = db.maquinas || [];

  const maquina = db.maquinas.find(m => m.id === id);
  if (!maquina) {
    return res.status(404).json({ error: "Máquina no encontrada" });
  }

  maquina.estado = estado;
  writeDB(db);

  res.json({
    message: "Estado actualizado correctamente",
    maquina
  });
}

/**
 * GET /admin/maquinas/stock-resumen
 * Devuelve:
 *  {
 *    porEstado: { disponible: X, asignada: Y, ... },
 *    porTipo: {
 *      MOTOGUADAÑA: { total, disponible, asignada, ... },
 *      ...
 *    }
 *  }
 */
export function adminResumenStock(req, res) {
  const db = readDB();
  const maquinas = db.maquinas || [];

  const porEstado = {};
  const porTipo = {};

  for (const m of maquinas) {
    const est = m.estado || "desconocido";
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
