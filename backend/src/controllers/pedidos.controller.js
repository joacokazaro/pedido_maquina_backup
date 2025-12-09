import { readDB, writeDB } from "../utils/file.js";


export function crearPedido(req, res) {
  const { supervisorId, itemsSolicitados } = req.body;

  const db = readDB();

  const id = `P-${String(db.pedidos.length + 1).padStart(4, "0")}`;

  const nuevo = {
    id,
    supervisorId,
    estado: "PENDIENTE_PREPARACION",
    itemsSolicitados, // [{ tipo: "LUSTRADORA", cantidad: 2 }]
    itemsAsignados: [],
    historial: [
      {
        accion: "CREADO",
        usuarioId: supervisorId,
        fecha: new Date().toISOString()
      }
    ]
  };

  db.pedidos.push(nuevo);
  writeDB(db);

  res.json({ message: "Pedido creado", pedido: nuevo });
}

export function getPedidosSupervisor(req, res) {
  const supervisorId = Number(req.params.supervisorId);
  const db = readDB();
  const pedidos = db.pedidos.filter(p => p.supervisorId === supervisorId);
  res.json(pedidos);
}

export function getPedidoById(req, res) {
  const db = readDB();
  const pedido = db.pedidos.find(p => p.id === req.params.id);

  if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });

  res.json(pedido);
}

export function marcarEntregado(req, res) {
  const { id } = req.params;
  const { usuarioId } = req.body;

  const db = readDB();
  const pedido = db.pedidos.find(p => p.id === id);

  if (!pedido) {
    return res.status(404).json({ error: "Pedido no encontrado" });
  }

  // No se puede entregar si no está preparado
  if (pedido.estado !== "PREPARADO") {
    return res.status(400).json({
      error: "El pedido debe estar en estado PREPARADO para entregarse."
    });
  }

  pedido.estado = "ENTREGADO";

  pedido.historial.push({
    accion: "ENTREGADO",
    usuarioId,
    fecha: new Date().toISOString()
  });

  writeDB(db);

  res.json({
    message: "Pedido marcado como ENTREGADO",
    pedido
  });
}


export function actualizarEstadoPedido(req, res) {
  const { id } = req.params;
  const { estado } = req.body;

  const db = readDB();
  const pedido = db.pedidos.find(p => p.id === id);

  if (!pedido) {
    return res.status(404).json({ error: "Pedido no encontrado" });
  }

  pedido.estado = estado;

  pedido.historial.push({
    accion: "ESTADO_ACTUALIZADO",
    nuevoEstado: estado,
    fecha: new Date().toISOString()
  });

  writeDB(db);

  res.json({ message: "Estado actualizado", pedido });
}


export function asignarMaquinas(req, res) {
  const { id } = req.params;
  const { asignadas, justificacion } = req.body;

  const db = readDB();
  const pedido = db.pedidos.find(p => p.id === id);

  if (!pedido) {
    return res.status(404).json({ error: "Pedido no encontrado" });
  }

  // MAPA: cuántas fueron solicitadas por tipo
  const solicitado = {};
  pedido.itemsSolicitados.forEach(i => solicitado[i.tipo] = i.cantidad);

  // MAPA: cuántas se están asignando por tipo
  const asignadoPorTipo = {};
  asignadas.forEach(idmaq => {
    const m = db.maquinas.find(x => x.id === idmaq);
    if (!m) return;

    asignadoPorTipo[m.tipo] = (asignadoPorTipo[m.tipo] || 0) + 1;
  });

  // VALIDAR DIFERENCIAS
  let requiereJustificacion = false;

  for (const tipo in solicitado) {
    const cantSolicitada = solicitado[tipo];
    const cantAsignada = asignadoPorTipo[tipo] || 0;

    if (cantSolicitada !== cantAsignada) {
      requiereJustificacion = true;
    }
  }

  if (requiereJustificacion && (!justificacion || justificacion.trim() === "")) {
    return res.status(400).json({
      error: "Se requiere justificación cuando la cantidad asignada es diferente a la solicitada."
    });
  }

  // Registrar máquinas asignadas al pedido
  pedido.itemsAsignados = asignadas.map(idmaq => {
    const m = db.maquinas.find(x => x.id === idmaq);
    if (!m) return null;

    return {
      id: m.id,
      tipo: m.tipo,
      modelo: m.modelo,
      serie: m.serie
    };
  }).filter(Boolean);

  // Cambiar estado de las máquinas a "asignada"
  asignadas.forEach(idmaq => {
    const m = db.maquinas.find(x => x.id === idmaq);
    if (m) m.estado = "asignada";
  });

  // Registrar historial
  pedido.historial.push({
    accion: "MAQUINAS_ASIGNADAS",
    fecha: new Date().toISOString(),
    detalle: {
      asignadas: pedido.itemsAsignados,
      solicitado,
      asignadoPorTipo,
      justificacion: requiereJustificacion ? justificacion : null
    }
  });

  // Cambiar estado del pedido
  pedido.estado = "PREPARADO";

  writeDB(db);

  return res.json({
    message: "Máquinas asignadas correctamente",
    pedido
  });
}

export function registrarDevolucion(req, res) {
  const { id } = req.params;
  const { devueltas, justificacion, usuarioId } = req.body;

  const db = readDB();
  const pedido = db.pedidos.find(p => p.id === id);

  if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });

  const asignadas = pedido.itemsAsignados.map(m => m.id);

  const faltantes = asignadas.filter(id => !devueltas.includes(id));

  const requiere = faltantes.length > 0;

  if (requiere && (!justificacion || justificacion.trim() === "")) {
    return res.status(400).json({
      error: "Debe ingresar una justificación para máquinas no devueltas."
    });
  }

  // Actualizar estados de máquina
  devueltas.forEach(idmaq => {
    const m = db.maquinas.find(x => x.id === idmaq);
    if (m) m.estado = "disponible";
  });

  faltantes.forEach(idmaq => {
    const m = db.maquinas.find(x => x.id === idmaq);
    if (m) m.estado = "no_devuelta";
  });

  // Registrar historial
  pedido.historial.push({
    accion: "DEVOLUCION_REGISTRADA",
    fecha: new Date().toISOString(),
    detalle: {
      devueltas,
      faltantes,
      justificacion: requiere ? justificacion : null
    },
    usuarioId
  });

  pedido.estado = "CERRADO";

  writeDB(db);

  res.json({ message: "Devolución registrada", pedido });
}

export function getPedidos(req, res) {
  const db = readDB();
  res.json(db.pedidos || []);
}


