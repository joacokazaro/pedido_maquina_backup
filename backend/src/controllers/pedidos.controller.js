import { readDB, writeDB } from "../utils/file.js";
import {
  ESTADOS_PEDIDO,
  ESTADOS_PEDIDO_VALIDOS,
  normalizeEstadoPedido
} from "../constants/estadosPedidos.js";

/* ========================================================
   CREAR PEDIDO
======================================================== */
export function crearPedido(req, res) {
  const { supervisorUsername, itemsSolicitados, observacion, servicio } = req.body;

  if (!supervisorUsername) {
    return res.status(400).json({ error: "Falta supervisorUsername" });
  }

  if (!servicio || servicio.trim() === "") {
    return res.status(400).json({ error: "Falta el servicio del pedido" });
  }

  const db = readDB();
  const id = `P-${String(db.pedidos.length + 1).padStart(4, "0")}`;

  const nuevo = {
    id,
    supervisor: supervisorUsername,
    servicio,
    estado: ESTADOS_PEDIDO.PENDIENTE_PREPARACION,
    itemsSolicitados,
    itemsAsignados: [],
    observacion: observacion || null,
    itemsDevueltos: null,
    historial: [
      {
        accion: "CREADO",
        usuario: supervisorUsername,
        fecha: new Date().toISOString(),
        detalle: {
          ...(observacion ? { observacion } : {})
        }
      }
    ]
  };

  db.pedidos.push(nuevo);
  writeDB(db);

  res.json({ message: "Pedido creado", pedido: nuevo });
}

/* ========================================================
   LISTAR PEDIDOS POR SUPERVISOR
======================================================== */
export function getPedidosSupervisor(req, res) {
  const supervisor = (req.params.supervisorId || "").trim().toLowerCase();
  const db = readDB();

  const pedidos = db.pedidos.filter(
    (p) => String(p.supervisor).trim().toLowerCase() === supervisor
  );

  res.json(pedidos);
}

/* ========================================================
   OBTENER POR ID
======================================================== */
export function getPedidoById(req, res) {
  const db = readDB();
  const pedido = db.pedidos.find((p) => p.id === req.params.id);

  if (!pedido) {
    return res.status(404).json({ error: "Pedido no encontrado" });
  }

  res.json(pedido);
}

/* ========================================================
   MARCAR ENTREGADO
======================================================== */
export function marcarEntregado(req, res) {
  const { id } = req.params;
  const { usuario, observacion } = req.body;

  const db = readDB();
  const pedido = db.pedidos.find((p) => p.id === id);

  if (!pedido) {
    return res.status(404).json({ error: "Pedido no encontrado" });
  }

  if (pedido.estado !== ESTADOS_PEDIDO.PREPARADO) {
    return res.status(400).json({
      error: "Debe estar PREPARADO para ser entregado"
    });
  }

  pedido.estado = ESTADOS_PEDIDO.ENTREGADO;

  pedido.historial.push({
    accion: "ENTREGADO",
    usuario,
    fecha: new Date().toISOString(),
    detalle: {
      ...(observacion ? { observacion } : {})
    }
  });

  writeDB(db);
  res.json({ message: "Pedido marcado como ENTREGADO", pedido });
}

/* ========================================================
   ACTUALIZAR ESTADO (GENÉRICO)
======================================================== */
export function actualizarEstadoPedido(req, res) {
  const { id } = req.params;
  const { estado, usuario, observacion } = req.body;

  const db = readDB();
  const pedido = db.pedidos.find((p) => p.id === id);

  if (!pedido) {
    return res.status(404).json({ error: "Pedido no encontrado" });
  }

  const estadoNormalizado = normalizeEstadoPedido(estado);

  if (!ESTADOS_PEDIDO_VALIDOS.includes(estadoNormalizado)) {
    return res.status(400).json({
      error: `Estado inválido. Debe ser uno de: ${ESTADOS_PEDIDO_VALIDOS.join(", ")}`
    });
  }

  pedido.estado = estadoNormalizado;

  pedido.historial.push({
    accion: "ESTADO_ACTUALIZADO",
    nuevoEstado: estadoNormalizado,
    usuario,
    fecha: new Date().toISOString(),
    detalle: {
      ...(observacion ? { observacion } : {})
    }
  });

  writeDB(db);
  res.json({ message: "Estado actualizado", pedido });
}

/* ========================================================
   ASIGNAR MÁQUINAS
======================================================== */
export function asignarMaquinas(req, res) {
  const { id } = req.params;
  const { asignadas, justificacion, usuario } = req.body;

  const db = readDB();
  const pedido = db.pedidos.find((p) => p.id === id);
  if (!pedido) {
    return res.status(404).json({ error: "Pedido no encontrado" });
  }

  if (!Array.isArray(asignadas) || asignadas.length === 0) {
    return res.status(400).json({
      error: "Debe enviar la lista de máquinas a asignar"
    });
  }

  // 1) Validar existencia y disponibilidad
  const noDisponibles = [];
  const inexistentes = [];

  for (const idmaq of asignadas) {
    const m = db.maquinas.find((x) => x.id === idmaq);
    if (!m) {
      inexistentes.push(idmaq);
      continue;
    }
    if (m.estado !== "disponible") {
      noDisponibles.push({ id: m.id, estado: m.estado, tipo: m.tipo });
    }
  }

  if (inexistentes.length > 0) {
    return res.status(400).json({
      error: "Hay máquinas inexistentes en la asignación",
      inexistentes
    });
  }

  if (noDisponibles.length > 0) {
    return res.status(400).json({
      error: "Solo se pueden asignar máquinas en estado 'disponible'",
      noDisponibles
    });
  }

  // 2) Validación por tipo
  const solicitado = {};
  pedido.itemsSolicitados.forEach(i => (solicitado[i.tipo] = i.cantidad));

  const asignadoPorTipo = {};
  asignadas.forEach(idmaq => {
    const m = db.maquinas.find(x => x.id === idmaq);
    if (!m) return;
    asignadoPorTipo[m.tipo] = (asignadoPorTipo[m.tipo] || 0) + 1;
  });

  let requiereJustificacion = false;
  for (const tipo in solicitado) {
    if ((asignadoPorTipo[tipo] || 0) !== solicitado[tipo]) {
      requiereJustificacion = true;
    }
  }

  if (requiereJustificacion && (!justificacion || justificacion.trim() === "")) {
    return res.status(400).json({
      error: "Se requiere justificación cuando la cantidad asignada es diferente."
    });
  }

  // 3) Snapshot asignadas
  pedido.itemsAsignados = asignadas
    .map(idmaq => {
      const m = db.maquinas.find(x => x.id === idmaq);
      return m
        ? { id: m.id, tipo: m.tipo, modelo: m.modelo, serie: m.serie }
        : null;
    })
    .filter(Boolean);

  // 4) Cambiar estado de máquinas
  asignadas.forEach(idmaq => {
    const m = db.maquinas.find(x => x.id === idmaq);
    if (m) m.estado = "asignada";
  });

  // 5) Historial + estado
  pedido.historial.push({
    accion: "MAQUINAS_ASIGNADAS",
    usuario,
    fecha: new Date().toISOString(),
    detalle: {
      asignadas: pedido.itemsAsignados,
      solicitado,
      asignadoPorTipo,
      ...(requiereJustificacion ? { justificacion } : {})
    }
  });

  pedido.estado = ESTADOS_PEDIDO.PREPARADO;

  writeDB(db);
  res.json({ message: "Máquinas asignadas", pedido });
}

/* ========================================================
   DEVOLUCIÓN (SUPERVISOR)
======================================================== */
export function registrarDevolucion(req, res) {
  const { id } = req.params;
  const { devueltas, justificacion, usuario } = req.body;

  const db = readDB();
  const pedido = db.pedidos.find((p) => p.id === id);
  if (!pedido) {
    return res.status(404).json({ error: "Pedido no encontrado" });
  }

  if (pedido.estado !== ESTADOS_PEDIDO.ENTREGADO) {
    return res.status(400).json({
      error: "Solo se puede devolver un pedido ENTREGADO"
    });
  }

  const asignadas = pedido.itemsAsignados.map(m => m.id);
  const faltantes = asignadas.filter(idmaq => !devueltas.includes(idmaq));

  if (faltantes.length > 0 && (!justificacion || justificacion.trim() === "")) {
    return res.status(400).json({
      error: "Debe ingresar una justificación para máquinas no devueltas."
    });
  }

  pedido.itemsDevueltos = devueltas;

  pedido.historial.push({
    accion: "DEVOLUCION_REGISTRADA",
    usuario,
    fecha: new Date().toISOString(),
    detalle: {
      devueltas,
      faltantes,
      ...(justificacion ? { justificacion } : {})
    }
  });

  pedido.estado = ESTADOS_PEDIDO.PENDIENTE_CONFIRMACION;

  writeDB(db);
  res.json({ message: "Devolución registrada", pedido });
}

/* ========================================================
   CONFIRMAR DEVOLUCIÓN (DEPÓSITO)
======================================================== */
export function confirmarDevolucion(req, res) {
  const { id } = req.params;
  const { usuario, devueltas, faltantes, observacion } = req.body || {};

  const db = readDB();
  const pedido = db.pedidos.find(p => p.id === id);
  if (!pedido) {
    return res.status(404).json({ error: "Pedido no encontrado" });
  }

  const devSet = new Set(devueltas || []);
  const falSet = new Set(faltantes || []);

  // Devueltas → disponible
  for (const idmaq of devSet) {
    const m = db.maquinas.find(x => x.id === idmaq);
    if (m) m.estado = "disponible";
  }

  // Faltantes → no_devuelta
  for (const idmaq of falSet) {
    const m = db.maquinas.find(x => x.id === idmaq);
    if (m) m.estado = "no_devuelta";
  }

  pedido.historial.push({
    accion: "DEVOLUCION_CONFIRMADA",
    usuario: usuario || "deposito",
    fecha: new Date().toISOString(),
    detalle: {
      devueltasConfirmadas: [...devSet],
      faltantesConfirmados: [...falSet],
      ...(observacion ? { observacion } : {})
    }
  });

  pedido.estado = ESTADOS_PEDIDO.CERRADO;

  writeDB(db);
  res.json({ message: "Devolución confirmada", pedido });
}

/* ========================================================
   COMPLETAR FALTANTES (SUPERVISOR)
======================================================== */
export function completarFaltantes(req, res) {
  const { id } = req.params;
  const { usuario, devueltas, observacion } = req.body || {};

  if (!Array.isArray(devueltas) || devueltas.length === 0) {
    return res.status(400).json({
      error: "Debe indicar al menos una máquina devuelta"
    });
  }

  const db = readDB();
  const pedido = db.pedidos.find(p => p.id === id);
  if (!pedido) {
    return res.status(404).json({ error: "Pedido no encontrado" });
  }

  pedido.historial.push({
    accion: "FALTANTES_DECLARADOS",
    usuario: usuario || "supervisor",
    fecha: new Date().toISOString(),
    detalle: {
      devueltasDeclaradas: devueltas,
      ...(observacion ? { observacion } : {})
    }
  });

  pedido.estado = ESTADOS_PEDIDO.PENDIENTE_CONFIRMACION_FALTANTES;

  writeDB(db);
  res.json({ message: "Faltantes declarados", pedido });
}

/* ========================================================
   LISTAR TODOS
======================================================== */
export function getPedidos(req, res) {
  const db = readDB();
  res.json(db.pedidos || []);
}
