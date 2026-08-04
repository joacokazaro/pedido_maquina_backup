// Reconcilia el estado "con faltantes" de los pedidos CERRADO contra la
// realidad actual de las máquinas.
//
// Categoría A (segura, se corrige sola con --apply): el pedido dice que una
// máquina está "faltante" pero Maquina.estado ya no es "no_devuelta", o
// existe un pedido más nuevo con esa misma máquina. En ese caso se agrega
// una entrada de historial DEVOLUCION_CONFIRMADA que cierra el faltante
// (sin pisar el historial viejo) y se actualiza Pedido.itemsDevueltos.
// Nunca se toca Maquina.estado en esta categoría.
//
// Categoría B (requiere revisión manual, NUNCA se aplica sola): máquinas con
// estado "no_devuelta" cuyo historial reconstruido (pedidos + movimientos de
// taller) sugiere que deberían estar en otro estado. Se imprime la línea de
// tiempo encontrada como evidencia. Esta reconstrucción NO puede ver cambios
// hechos a mano vía "Cambiar estado" en el panel admin (PUT
// /admin/maquinas/:id/estado no deja rastro), así que el resultado es una
// sugerencia para revisar caso por caso, no una verdad absoluta.
//
// Uso:
//   node scripts/reconciliar_faltantes_pedidos.mjs            -> solo reporte
//   node scripts/reconciliar_faltantes_pedidos.mjs --apply    -> aplica Categoría A

import prisma from "../src/db/prisma.js";

const ADMIN_USERNAME = "admin";
const CONFIRMACIONES = ["DEVOLUCION_CONFIRMADA", "DEVOLUCION_CONFIRMADA_DIRECTA"];

function safeParse(json, fallback) {
  if (!json) return fallback;
  try {
    const v = JSON.parse(json);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

async function construirTimelineMaquina(maquinaId) {
  const eventos = [];

  const asignaciones = await prisma.pedidoMaquina.findMany({
    where: { maquinaId },
    include: { pedido: { include: { historial: { orderBy: { fecha: "asc" } } } } },
  });

  for (const a of asignaciones) {
    for (const h of a.pedido.historial) {
      const detalle = safeParse(h.detalle, {});

      // Las entradas que corrigen un evento viejo no representan un cambio
      // físico nuevo de la máquina: son un ajuste de papeles sobre un
      // pedido ya superado. Si se las trata como evento real, su fecha
      // (hoy) las hace ganar cualquier comparación cronológica.
      if (detalle?.corrigeHistorialId) continue;

      if (h.accion === "MAQUINAS_ASIGNADAS") {
        eventos.push({ fecha: h.fecha, origen: `${a.pedido.id} MAQUINAS_ASIGNADAS#${h.id}`, estadoResultante: "asignada" });
      } else if (CONFIRMACIONES.includes(h.accion)) {
        const dev = Array.isArray(detalle.devueltasConfirmadas) ? detalle.devueltasConfirmadas : [];
        const falt = Array.isArray(detalle.faltantesConfirmados) ? detalle.faltantesConfirmados : [];
        if (dev.includes(maquinaId))
          eventos.push({ fecha: h.fecha, origen: `${a.pedido.id} ${h.accion}#${h.id}`, estadoResultante: "disponible" });
        if (falt.includes(maquinaId))
          eventos.push({ fecha: h.fecha, origen: `${a.pedido.id} ${h.accion}#${h.id}`, estadoResultante: "no_devuelta" });
      } else if (h.accion === "ADMIN_EDICION_PEDIDO") {
        const quitadas = Array.isArray(detalle.maquinasQuitadas) ? detalle.maquinasQuitadas : [];
        const agregadas = Array.isArray(detalle.maquinasAgregadas) ? detalle.maquinasAgregadas : [];
        if (quitadas.includes(maquinaId))
          eventos.push({ fecha: h.fecha, origen: `${a.pedido.id} ADMIN_EDICION_PEDIDO#${h.id}`, estadoResultante: "disponible" });
        if (agregadas.includes(maquinaId))
          eventos.push({ fecha: h.fecha, origen: `${a.pedido.id} ADMIN_EDICION_PEDIDO#${h.id}`, estadoResultante: "asignada" });
      } else if (h.accion === "CANCELADO" || h.accion === "CANCELADO_ADMIN") {
        eventos.push({ fecha: h.fecha, origen: `${a.pedido.id} ${h.accion}#${h.id}`, estadoResultante: "disponible" });
      }
    }
  }

  const movimientosTaller = await prisma.tallerMovimiento.findMany({
    where: { maquinaId },
    orderBy: { createdAt: "asc" },
  });
  for (const t of movimientosTaller) {
    eventos.push({
      fecha: t.createdAt,
      origen: `TallerMovimiento#${t.id} ${t.accion}`,
      estadoResultante: t.accion === "ingreso" ? "taller" : "disponible",
    });
  }

  eventos.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  return eventos;
}

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(`Modo: ${apply ? "APLICAR correcciones de Categoría A" : "SOLO REPORTE (dry-run)"}\n`);

  let admin = null;
  if (apply) {
    admin = await prisma.usuario.findUnique({ where: { username: ADMIN_USERNAME } });
    if (!admin) throw new Error(`No se encontró el usuario '${ADMIN_USERNAME}' para atribuir las correcciones`);
  }

  /* ============================================================
     1) Pedidos CERRADO con faltantes confirmados vigentes, mismo
        criterio que adminListPedidos (adminPedidos.controller.js)
  ============================================================ */
  const pedidosCerrados = await prisma.pedido.findMany({
    where: { estado: "CERRADO" },
    include: { historial: { orderBy: { fecha: "asc" } } },
  });

  const pedidosConFaltantes = [];
  for (const p of pedidosCerrados) {
    const confirmaciones = p.historial.filter((h) => CONFIRMACIONES.includes(h.accion));
    const ultima = confirmaciones[confirmaciones.length - 1];
    if (!ultima) continue;
    const detalle = safeParse(ultima.detalle, {});
    const faltantes = Array.isArray(detalle.faltantesConfirmados) ? detalle.faltantesConfirmados : [];
    const devueltas = Array.isArray(detalle.devueltasConfirmadas) ? detalle.devueltasConfirmadas : [];
    if (faltantes.length === 0) continue;
    pedidosConFaltantes.push({ pedido: p, ultimaConfirmacion: ultima, faltantes, devueltas });
  }

  console.log(`Pedidos CERRADO marcados "con faltantes" hoy: ${pedidosConFaltantes.length}`);

  /* ============================================================
     2) Estado actual + todos los pedidos de cada máquina involucrada
  ============================================================ */
  const maquinaIds = [...new Set(pedidosConFaltantes.flatMap((c) => c.faltantes))];
  const maquinas = await prisma.maquina.findMany({
    where: { id: { in: maquinaIds } },
    select: { id: true, estado: true, tipo: true, modelo: true },
  });
  const maquinaById = new Map(maquinas.map((m) => [m.id, m]));

  const asignacionesTodas = await prisma.pedidoMaquina.findMany({
    where: { maquinaId: { in: maquinaIds } },
    include: { pedido: { select: { id: true, createdAt: true } } },
  });
  const pedidosPorMaquina = new Map();
  for (const a of asignacionesTodas) {
    const list = pedidosPorMaquina.get(a.maquinaId) || [];
    list.push(a.pedido);
    pedidosPorMaquina.set(a.maquinaId, list);
  }
  for (const list of pedidosPorMaquina.values()) {
    list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  /* ============================================================
     3) Categoría A: faltante desactualizado (seguro de corregir)
  ============================================================ */
  const categoriaA = [];
  for (const c of pedidosConFaltantes) {
    for (const maquinaId of c.faltantes) {
      const maquina = maquinaById.get(maquinaId);
      if (!maquina) continue;

      const pedidosDeEstaMaquina = pedidosPorMaquina.get(maquinaId) || [];
      const masReciente = pedidosDeEstaMaquina[pedidosDeEstaMaquina.length - 1];
      const esElMasReciente = masReciente?.id === c.pedido.id;

      if (maquina.estado !== "no_devuelta" || !esElMasReciente) {
        categoriaA.push({
          pedido: c.pedido,
          ultimaConfirmacion: c.ultimaConfirmacion,
          faltantesOriginales: c.faltantes,
          devueltasOriginales: c.devueltas,
          maquinaId,
          estadoActualMaquina: maquina.estado,
          esElMasReciente,
          pedidoMasReciente: masReciente?.id,
        });
      }
    }
  }

  const porPedido = new Map();
  for (const item of categoriaA) {
    const list = porPedido.get(item.pedido.id) || [];
    list.push(item);
    porPedido.set(item.pedido.id, list);
  }

  console.log(`\n=== CATEGORÍA A: pedidos con "faltante" desactualizado (seguro corregir) ===`);
  console.log(`Pedidos afectados: ${porPedido.size}`);
  for (const [pedidoId, items] of porPedido) {
    console.log(`\n${pedidoId}:`);
    for (const it of items) {
      const motivo = it.esElMasReciente
        ? `máquina está "${it.estadoActualMaquina}" (ya no no_devuelta)`
        : `superado por pedido más nuevo: ${it.pedidoMasReciente}`;
      console.log(`  - ${it.maquinaId}: ${motivo}`);
    }
  }

  /* ============================================================
     4) Categoría B: no_devuelta cuyo historial sugiere otro estado
  ============================================================ */
  const maquinasNoDevueltas = await prisma.maquina.findMany({
    where: { estado: "no_devuelta" },
    select: { id: true, tipo: true, modelo: true },
  });

  const categoriaB = [];
  for (const m of maquinasNoDevueltas) {
    const timeline = await construirTimelineMaquina(m.id);
    const ultimo = timeline[timeline.length - 1];
    if (ultimo && ultimo.estadoResultante !== "no_devuelta") {
      categoriaB.push({ maquinaId: m.id, tipo: m.tipo, modelo: m.modelo, derivado: ultimo.estadoResultante, timeline });
    }
  }

  console.log(`\n=== CATEGORÍA B: "no_devuelta" con historial inconsistente (REVISAR A MANO) ===`);
  console.log(`Máquinas con inconsistencia detectada: ${categoriaB.length}`);
  for (const b of categoriaB) {
    console.log(`\n${b.maquinaId} (${b.tipo} ${b.modelo}): estado actual "no_devuelta", el historial sugiere "${b.derivado}"`);
    for (const ev of b.timeline) {
      console.log(`   ${new Date(ev.fecha).toISOString()}  ${ev.origen}  -> ${ev.estadoResultante}`);
    }
  }
  if (categoriaB.length) {
    console.log(
      `\nNOTA: esta reconstrucción no ve cambios hechos a mano vía "Cambiar estado" en el panel admin ` +
      `(no dejan rastro). Revisar caso por caso antes de tocar Maquina.estado — no se toca automáticamente.`
    );
  }

  /* ============================================================
     5) Aplicar (solo Categoría A)
  ============================================================ */
  if (apply && porPedido.size) {
    console.log(`\nAplicando ${porPedido.size} correcciones de Categoría A...`);
    for (const [pedidoId, items] of porPedido) {
      const { ultimaConfirmacion, faltantesOriginales, devueltasOriginales, pedido } = items[0];
      const maquinasACorregir = new Set(items.map((it) => it.maquinaId));
      const faltantesFinal = faltantesOriginales.filter((id) => !maquinasACorregir.has(id));
      const devueltasFinal = [...new Set([...devueltasOriginales, ...maquinasACorregir])];

      await prisma.$transaction(async (tx) => {
        await tx.historialPedido.create({
          data: {
            pedidoId,
            accion: "DEVOLUCION_CONFIRMADA",
            usuarioId: admin.id,
            detalle: JSON.stringify({
              devueltasConfirmadas: devueltasFinal,
              faltantesConfirmados: faltantesFinal,
              corrigeHistorialId: ultimaConfirmacion.id,
              nota: `Confirmación corregida por script reconciliar_faltantes_pedidos.mjs: ${[...maquinasACorregir].join(", ")} ya no están no_devuelta o fueron superadas por un pedido más nuevo.`,
            }),
          },
        });

        await tx.pedido.update({
          where: { id: pedidoId },
          data: { itemsDevueltos: JSON.stringify(devueltasFinal) },
        });
      });

      console.log(`  ${pedidoId}: corregido (${[...maquinasACorregir].join(", ")})`);
    }
  } else if (!apply && porPedido.size) {
    console.log(`\nEjecutar de nuevo con --apply para aplicar las correcciones de Categoría A.`);
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
