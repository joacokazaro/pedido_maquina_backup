import prisma from "../db/prisma.js";
import { canonicalEstadoMaquina } from "./inventarioEstados.service.js";

const PEDIDO_SELECT_ASIGNACION = {
  id: true,
  estado: true,
  createdAt: true,
  destino: true,
  servicio: { select: { id: true, nombre: true } },
};

function mapAsignacion(pedidoMaquina) {
  return {
    pedidoId: pedidoMaquina.pedido.id,
    estadoPedido: pedidoMaquina.pedido.estado,
    destino: pedidoMaquina.pedido.destino,
    servicio: pedidoMaquina.pedido.servicio,
  };
}

// Asignación activa por máquina, chequeada a nivel máquina y no a nivel
// pedido: un pedido puede seguir "abierto" (no CERRADO/CANCELADO) por otros
// ítems todavía faltantes aunque esta máquina puntual ya haya sido
// devuelta y confirmada (su propio `estado` ya volvió a "disponible", o
// pasó a taller/baja/fuera_servicio por otro motivo). Por eso solo se
// confía en el vínculo PedidoMaquina activo cuando el estado propio de la
// máquina todavía indica que sigue afuera.
//
// `maquinas` debe traer al menos { id, estado }. Devuelve un Map<maquinaId,
// asignacion|null>.
export async function getAsignacionActivaPorMaquina(
  maquinas,
  { client = prisma, excludePedidoId = null } = {}
) {
  const resultado = new Map();
  const maquinasIds = maquinas.map((m) => m.id);
  if (!maquinasIds.length) return resultado;

  const whereActivas = {
    maquinaId: { in: maquinasIds },
    pedido: { estado: { notIn: ["CERRADO", "CANCELADO"] } },
  };
  if (excludePedidoId) {
    whereActivas.pedidoId = { not: excludePedidoId };
  }

  const asignacionesActivas = await client.pedidoMaquina.findMany({
    where: whereActivas,
    include: { pedido: { select: PEDIDO_SELECT_ASIGNACION } },
    orderBy: { pedido: { createdAt: "desc" } },
  });

  const maquinasNoDevueltasIds = maquinas
    .filter((m) => canonicalEstadoMaquina(m.estado) === "no_devuelta")
    .map((m) => m.id);

  const asignacionesHistoricas = maquinasNoDevueltasIds.length
    ? await client.pedidoMaquina.findMany({
        where: { maquinaId: { in: maquinasNoDevueltasIds } },
        include: { pedido: { select: PEDIDO_SELECT_ASIGNACION } },
        orderBy: { pedido: { createdAt: "desc" } },
      })
    : [];

  const activaPorMaquina = new Map();
  for (const a of asignacionesActivas) {
    if (!activaPorMaquina.has(a.maquinaId)) activaPorMaquina.set(a.maquinaId, mapAsignacion(a));
  }

  const historicaPorMaquina = new Map();
  for (const a of asignacionesHistoricas) {
    if (!historicaPorMaquina.has(a.maquinaId)) historicaPorMaquina.set(a.maquinaId, mapAsignacion(a));
  }

  for (const m of maquinas) {
    const estadoCanonico = canonicalEstadoMaquina(m.estado);
    const asignacion =
      estadoCanonico === "asignada"
        ? activaPorMaquina.get(m.id) || null
        : estadoCanonico === "no_devuelta"
          ? activaPorMaquina.get(m.id) || historicaPorMaquina.get(m.id) || null
          : null;
    resultado.set(m.id, asignacion);
  }

  return resultado;
}
