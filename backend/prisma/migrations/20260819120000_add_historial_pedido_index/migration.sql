-- Índice para lookups por pedido + fecha (usado por estadísticas: pedidos estancados y tiempo de ciclo)
CREATE INDEX "HistorialPedido_pedidoId_fecha_idx" ON "HistorialPedido"("pedidoId", "fecha");
