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
    itemsDevueltos: null,
    historial: [
      {
        accion: "CREADO",
        usuario: supervisorUsername,
        fecha: new Date().toISOString(),
        detalle: {
          comentario: observacion || null
        }
      }
    ]
  };

  db.pedidos.push(nuevo);
  writeDB(db);

  res.json({ message: "Pedido creado", pedido: nuevo });
}

/* ========================================================
   OBTENER POR ID
======================================================== */
export function getPedidoById(req, res) {
  const db = readDB();
  const pedido = db.pedidos.find(p => p.id === req.params.id);
  if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });
  res.json(pedido);
}

/* ========================================================
   MARCAR ENTREGADO
======================================================== */
export function marcarEntregado(req, res) {
  const { id } = req.params;
  const { usuario, comentario } = req.body;

  const db = readDB();
  const pedido = db.pedidos.find(p => p.id === id);
  if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });

  pedido.estado = "ENTREGADO";
  pedido.historial.push({
    accion: "ENTREGADO",
    usuario,
    fecha: new Date().toISOString(),
    detalle: {
      comentario: comentario || null
    }
  });

  writeDB(db);
  res.json({ message: "Pedido marcado como ENTREGADO", pedido });
}

/* ========================================================
   ASIGNAR MÁQUINAS
======================================================== */
export function asignarMaquinas(req, res) {
  const { id } = req.params;
  const { asignadas, justificacion, usuario } = req.body;

  const db = readDB();
  const pedido = db.pedidos.find(p => p.id === id);
  if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });

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
      comentario: justificacion || null
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
  const pedido = db.pedidos.find(p => p.id === id);
  if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });

  const asignadas = pedido.itemsAsignados.map(m => m.id);
  const faltantes = asignadas.filter(idmaq => !devueltas.includes(idmaq));

  pedido.itemsDevueltos = devueltas;
  pedido.estado = "PENDIENTE_CONFIRMACION";

  pedido.historial.push({
    accion: "DEVOLUCION_REGISTRADA",
    usuario,
    fecha: new Date().toISOString(),
    detalle: {
      devueltas,
      faltantes,
      comentario: justificacion || null
    }
  });

  writeDB(db);
  res.json({ message: "Devolución registrada", pedido });
}

/* ========================================================
   CONFIRMAR DEVOLUCIÓN (DEPÓSITO)
======================================================== */
export function confirmarDevolucion(req, res) {
  const { id } = req.params;
  const { usuario, devueltas, faltantes, observacion } = req.body;

  const db = readDB();
  const pedido = db.pedidos.find(p => p.id === id);
  if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });

  devueltas.forEach(idMaq => {
    const m = db.maquinas.find(x => x.id === idMaq);
    if (m) m.estado = "disponible";
  });

  faltantes.forEach(idMaq => {
    const m = db.maquinas.find(x => x.id === idMaq);
    if (m) m.estado = "no_devuelta";
  });

  pedido.estado = "CERRADO";
  pedido.historial.push({
    accion: "DEVOLUCION_CONFIRMADA",
    usuario,
    fecha: new Date().toISOString(),
    detalle: {
      devueltasConfirmadas: devueltas,
      faltantesConfirmados: faltantes,
      comentario: observacion || null
    }
  });

  writeDB(db);
  res.json({ message: "Devolución confirmada", pedido });
}

/* ========================================================
   COMPLETAR FALTANTES (SUPERVISOR)
======================================================== */
export function completarFaltantes(req, res) {
  const { id } = req.params;
  const { usuario, devueltas, comentario } = req.body;

  const db = readDB();
  const pedido = db.pedidos.find(p => p.id === id);
  if (!pedido) return res.status(404).json({ error: "Pedido no encontrado" });

  pedido.estado = "PENDIENTE_CONFIRMACION_FALTANTES";
  pedido.historial.push({
    accion: "FALTANTES_DECLARADOS",
    usuario,
    fecha: new Date().toISOString(),
    detalle: {
      devueltasDeclaradas: devueltas,
      comentario: comentario || null
    }
  });

  writeDB(db);
  res.json({ message: "Faltantes declarados", pedido });
}
