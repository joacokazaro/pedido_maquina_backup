// Auditoría de solo lectura sobre TODA la flota de máquinas: para cada
// máquina reconstruye una línea de tiempo a partir de los eventos que el
// sistema sabe que le cambian el `estado` (asignaciones y devoluciones de
// pedidos, ediciones de admin, movimientos de taller) y compara el estado
// que ese historial sugiere contra el `Maquina.estado` persistido hoy.
//
// No corrige nada — es un reporte para decidir caso por caso. Dos
// limitaciones conocidas, ambas explicadas en el propio reporte:
//   1) No ve cambios hechos a mano vía "Cambiar estado" en el panel admin
//      (PUT /admin/maquinas/:id/estado no deja rastro).
//   2) No puede validar máquinas en "baja"/"fuera_servicio": no hay ningún
//      evento rastreado que derive en esos estados, así que se excluyen del
//      chequeo en lugar de reportarlas como falso positivo.
//
// Uso: node scripts/auditar_flota_maquinas.mjs

import prisma from "../src/db/prisma.js";

const CONFIRMACIONES = ["DEVOLUCION_CONFIRMADA", "DEVOLUCION_CONFIRMADA_DIRECTA"];
const ESTADOS_NO_DERIVABLES = new Set(["baja", "fuera_servicio"]);

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

      // Las entradas que corrigen un evento viejo (ver
      // reconciliar_faltantes_pedidos.mjs) no representan un cambio físico
      // nuevo de la máquina: son un ajuste de papeles sobre un pedido ya
      // superado. Si se las trata como evento real, su fecha (hoy) las hace
      // ganar cualquier comparación cronológica y ensucian el diagnóstico.
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
  const maquinas = await prisma.maquina.findMany({
    select: { id: true, estado: true, tipo: true, modelo: true },
    orderBy: { id: "asc" },
  });

  console.log(`Máquinas en la flota: ${maquinas.length}`);

  const excluidas = maquinas.filter((m) => ESTADOS_NO_DERIVABLES.has(m.estado));
  const aRevisar = maquinas.filter((m) => !ESTADOS_NO_DERIVABLES.has(m.estado));
  console.log(`Excluidas del chequeo (baja/fuera_servicio, no derivables del historial): ${excluidas.length}`);
  console.log(`Máquinas a chequear: ${aRevisar.length}\n`);

  const sinHistorial = [];
  const consistentes = [];
  const inconsistentes = [];

  let procesadas = 0;
  for (const m of aRevisar) {
    const timeline = await construirTimelineMaquina(m.id);
    procesadas += 1;
    if (procesadas % 100 === 0) console.log(`... ${procesadas}/${aRevisar.length}`);

    if (timeline.length === 0) {
      sinHistorial.push(m);
      continue;
    }

    const ultimo = timeline[timeline.length - 1];
    if (ultimo.estadoResultante === m.estado) {
      consistentes.push(m);
    } else {
      inconsistentes.push({ maquina: m, derivado: ultimo.estadoResultante, timeline });
    }
  }

  console.log(`\n=== RESUMEN ===`);
  console.log(`Consistentes (estado actual = lo que sugiere el historial): ${consistentes.length}`);
  console.log(`Sin historial rastreable (no se puede validar): ${sinHistorial.length}`);
  console.log(`Excluidas (baja/fuera_servicio): ${excluidas.length}`);
  console.log(`INCONSISTENTES (revisar a mano): ${inconsistentes.length}`);

  if (inconsistentes.length) {
    console.log(`\n=== DETALLE DE INCONSISTENCIAS ===`);
    for (const inc of inconsistentes) {
      console.log(
        `\n${inc.maquina.id} (${inc.maquina.tipo} ${inc.maquina.modelo}): estado actual "${inc.maquina.estado}", ` +
        `el historial sugiere "${inc.derivado}"`
      );
      for (const ev of inc.timeline) {
        console.log(`   ${new Date(ev.fecha).toISOString()}  ${ev.origen}  -> ${ev.estadoResultante}`);
      }
    }
    console.log(
      `\nNOTA: esta reconstrucción no ve cambios hechos a mano vía "Cambiar estado" en el panel admin ` +
      `(no dejan rastro). Ninguna de estas máquinas fue tocada por este script — es solo diagnóstico.`
    );
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
