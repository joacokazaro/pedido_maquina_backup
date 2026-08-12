import prisma from "../db/prisma.js";
import { getAsignacionActivaPorMaquina } from "./asignacionesPedido.service.js";

const MAQUINA_EXPORT_INCLUDE = {
  servicio: {
    select: {
      id: true,
      nombre: true,
      supervisores: {
        where: { usuario: { activo: true } },
        select: { usuario: { select: { nombre: true, username: true } } },
      },
    },
  },
  servicioAmortizacion: {
    select: { id: true, nombre: true },
  },
  tipoMaquina: {
    select: { id: true, nombre: true },
  },
};

function estadoAmortizacionLabel(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "AMORTIZADA") return "Amortizada";
  if (normalized === "NO_AMORTIZADA") return "No amortizada";
  return "Sin datos";
}

function nombreOUsername(usuario) {
  return usuario?.nombre || usuario?.username || "";
}

export const MAQUINA_EXPORT_FIELDS = [
  ["codigo", "Codigo"],
  ["tipo", "Tipo"],
  ["modelo", "Modelo"],
  ["serie", "Serie"],
  ["estado", "Estado"],
  ["servicioOriginal", "Servicio Original"],
  ["fechaCompra", "Fecha compra"],
  ["proveedorFactura", "Proveedor/N factura"],
  ["valorCompra", "Valor compra"],
  ["empresa", "Empresa"],
  ["anio", "Año"],
  ["amortizacion", "Amortización"],
  ["estadoAmortizacion", "Estado amortización"],
  ["antiguedad", "Antigüedad"],
  ["valorUsadaUSD", "Valor usada USD"],
  ["valorUsadaARS", "Valor usada ARS"],
  ["valorNuevaUSD", "Valor nueva USD"],
  ["valorNuevaARS", "Valor nueva ARS"],
  ["origenInfo", "Origen info"],
  ["servicioAmortizacion", "Servicio amortización"],
  ["comentarios", "Comentarios"],
  ["pedidoActivo", "Pedido Activo"],
  ["estadoPedidoActivo", "Estado Pedido Activo"],
  ["destinoPedidoActivo", "Destino Pedido Activo"],
  ["servicioPrestamo", "Servicio Prestamo"],
  ["titular", "Titular"],
  ["solicitante", "Solicitante"],
  ["fechaPedido", "Fecha del pedido"],
];

export async function getMaquinasParaExport({ where } = {}) {
  const maquinas = await prisma.maquina.findMany({
    where,
    include: MAQUINA_EXPORT_INCLUDE,
    orderBy: [{ tipo: "asc" }, { id: "asc" }],
  });

  const asignacionPorMaquina = await getAsignacionActivaPorMaquina(maquinas);

  return { maquinas, asignacionPorMaquina };
}

export function buildMaquinaExportRecord(maquina, asignacion) {
  const titular = (maquina.servicio?.supervisores || [])
    .map((s) => nombreOUsername(s.usuario))
    .filter(Boolean)
    .join(", ");

  return {
    codigo: maquina.id,
    tipo: maquina.tipo,
    modelo: maquina.modelo,
    serie: maquina.serie,
    estado: maquina.estado,
    servicioOriginal: maquina.servicio?.nombre ?? "",
    fechaCompra: maquina.fechaCompra ? maquina.fechaCompra.toISOString().slice(0, 10) : "",
    proveedorFactura: maquina.proveedorFactura ?? "",
    valorCompra: maquina.valorCompra ?? "",
    empresa: maquina.empresa ?? "",
    anio: maquina.anio ?? "",
    amortizacion: maquina.amortizacion ?? "",
    estadoAmortizacion: estadoAmortizacionLabel(maquina.estadoAmortizacion),
    antiguedad: maquina.antiguedad ?? "",
    valorUsadaUSD: maquina.valorUsadaDolares ?? "",
    valorUsadaARS: maquina.valorUsadaPesos ?? "",
    valorNuevaUSD: maquina.valorNuevaDolares ?? "",
    valorNuevaARS: maquina.valorNuevaPesos ?? "",
    origenInfo: maquina.origenInfo ?? "",
    servicioAmortizacion: maquina.servicioAmortizacion?.nombre ?? "",
    comentarios: maquina.comentarios ?? "",
    pedidoActivo: asignacion?.pedidoId ?? "",
    estadoPedidoActivo: asignacion?.estadoPedido ?? "",
    destinoPedidoActivo: asignacion?.destino ?? "",
    servicioPrestamo: asignacion?.servicio?.nombre ?? "",
    titular,
    solicitante: nombreOUsername(asignacion?.supervisor),
    fechaPedido: asignacion?.createdAt ? asignacion.createdAt.toISOString().slice(0, 10) : "",
  };
}
