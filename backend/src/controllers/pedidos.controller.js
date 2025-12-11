import { readDB, writeDB } from "../utils/file.js";

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
    estado: "PENDIENTE_PREPARACION",
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
          servicio,
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

  if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });

  res.json(pedido);
}

/* ========================================================
   MARCAR ENTREGADO
======================================================== */
export function marcarEntregado(req, res) {
  const { id } = req.params;
  const { usuario } = req.body;

  const db = readDB();
  const pedido = db.pedidos.find((p) => p.id === id);

  if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });

  if (pedido.estado !== "PREPARADO") {
    return res.status(400).json({ error: "Debe estar PREPARADO para ser entregado" });
  }

  pedido.estado = "ENTREGADO";
  pedido.historial.push({
    accion: "ENTREGADO",
    usuario,
    fecha: new Date().toISOString(),
    detalle: { servicio: pedido.servicio }
  });

  writeDB(db);

  res.json({ message: "Pedido marcado como ENTREGADO", pedido });
}

/* ========================================================
   ACTUALIZAR ESTADO
======================================================== */
export function actualizarEstadoPedido(req, res) {
  const { id } = req.params;
  const { estado, usuario } = req.body;

  const db = readDB();
  const pedido = db.pedidos.find((p) => p.id === id);

  if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });

  pedido.estado = estado;
  pedido.historial.push({
    accion: "ESTADO_ACTUALIZADO",
    nuevoEstado: estado,
    usuario,
    fecha: new Date().toISOString(),
    detalle: { servicio: pedido.servicio }
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

  if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });

  const solicitado = {};
  pedido.itemsSolicitados.forEach(i => solicitado[i.tipo] = i.cantidad);

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

  pedido.itemsAsignados = asignadas.map(idmaq => {
    const m = db.maquinas.find(x => x.id === idmaq);
    return m ? { id: m.id, tipo: m.tipo, modelo: m.modelo, serie: m.serie } : null;
  }).filter(Boolean);

  asignadas.forEach(idmaq => {
    const m = db.maquinas.find(x => x.id === idmaq);
    if (m) m.estado = "asignada";
  });

  pedido.historial.push({
    accion: "MAQUINAS_ASIGNADAS",
    usuario,
    fecha: new Date().toISOString(),
    detalle: {
      servicio: pedido.servicio,
      asignadas: pedido.itemsAsignados,
      solicitado,
      asignadoPorTipo,
      justificacion: requiereJustificacion ? justificacion : null
    }
  });

  pedido.estado = "PREPARADO";
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

  if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });
  if (pedido.estado !== "ENTREGADO") {
    return res.status(400).json({ error: "Solo se puede devolver un pedido ENTREGADO" });
  }

  const asignadas = pedido.itemsAsignados.map(m => m.id);
  const faltantes = asignadas.filter(idmaq => !devueltas.includes(idmaq));

  if (faltantes.length > 0 && (!justificacion || justificacion.trim() === "")) {
    return res.status(400).json({
      error: "Debe ingresar una justificación para máquinas no devueltas."
    });
  }

  devueltas.forEach(idmaq => {
    const m = db.maquinas.find(x => x.id === idmaq);
    if (m) m.estado = "disponible";
  });

  faltantes.forEach(idmaq => {
    const m = db.maquinas.find(x => x.id === idmaq);
    if (m) m.estado = "no_devuelta";
  });

  pedido.itemsDevueltos = devueltas;

  pedido.historial.push({
    accion: "DEVOLUCION_REGISTRADA",
    usuario,
    fecha: new Date().toISOString(),
    detalle: {
      servicio: pedido.servicio,
      devueltas,
      faltantes,
      justificacion: justificacion || null
    }
  });

  pedido.estado = "PENDIENTE_CONFIRMACION";
  writeDB(db);

  res.json({ message: "Devolución registrada. Pendiente de confirmación.", pedido });
}

/* ========================================================
   CONFIRMAR DEVOLUCIÓN (DEPÓSITO)
======================================================== */
export function confirmarDevolucion(req, res) {
  const { id } = req.params;
  const { usuario, observacion, devueltas, faltantes } = req.body;

  const db = readDB();
  const pedido = db.pedidos.find(p => p.id === id);

  if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });

  if (pedido.estado !== "PENDIENTE_CONFIRMACION") {
    return res.status(400).json({ error: "El pedido no está pendiente de confirmación" });
  }

  const historialSupervisor = [...pedido.historial]
    .reverse()
    .find(h => h.accion === "DEVOLUCION_REGISTRADA");

  const supervisorDevueltas = historialSupervisor?.detalle?.devueltas || [];
  const supervisorFaltantes = historialSupervisor?.detalle?.faltantes || [];

  const devueltasConfirmadas = devueltas || [];
  const faltantesConfirmados = faltantes || [];

  devueltasConfirmadas.forEach(idmaq => {
    const m = db.maquinas.find(x => x.id === idmaq);
    if (m) m.estado = "disponible";
  });

  faltantesConfirmados.forEach(idmaq => {
    const m = db.maquinas.find(x => x.id === idmaq);
    if (m) m.estado = "no_devuelta";
  });

  pedido.itemsDevueltos = devueltasConfirmadas;

  pedido.estado = "CERRADO";

  pedido.historial.push({
    accion: "DEVOLUCION_CONFIRMADA",
    usuario,
    fecha: new Date().toISOString(),
    detalle: {
      servicio: pedido.servicio,

      supervisorDevueltas,
      supervisorFaltantes,

      devueltasConfirmadas,
      faltantesConfirmados,

      observacion: observacion || null
    }
  });

  writeDB(db);

  res.json({
    message: "Devolución confirmada. Pedido cerrado.",
    pedido
  });
}

/* ========================================================
   LISTAR TODOS
======================================================== */
export function getPedidos(req, res) {
  const db = readDB();
  res.json(db.pedidos || []);
}
