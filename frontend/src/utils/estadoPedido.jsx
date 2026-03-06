import React from "react";

export function formatEstado(estado) {
  if (!estado) return "";
  const e = String(estado).toUpperCase();
  switch (e) {
    case "PENDIENTE_PREPARACION":
      return "Pendiente de preparación";
    case "PREPARADO":
      return "Preparado";
    case "ENTREGADO":
      return "Entregado";
    case "PENDIENTE_CONFIRMACION":
      return "Pend. confirmación";
    case "PENDIENTE_CONFIRMACION_FALTANTES":
      return "Pend. confirmación (faltantes)";
    case "ENTREGA_CONFIRMADA":
      return "Entrega confirmada";
    case "PENDIENTE_CANCELACION":
      return "Solicitud de cancelación";
    case "CANCELADO":
      return "Cancelado";
    case "CERRADO":
      return "Cerrado";
    default:
      return String(estado).replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (t) => t.toUpperCase());
  }
}

export function estadoBadgeClasses(estado) {
  if (!estado) return "bg-gray-200 text-gray-700";
  const e = String(estado).toUpperCase();
  switch (e) {
    case "PENDIENTE_PREPARACION":
      return "bg-yellow-100 text-yellow-700";
    case "PREPARADO":
      return "bg-blue-100 text-blue-700";
    case "ENTREGADO":
      return "bg-green-100 text-green-700";
    case "PENDIENTE_CONFIRMACION":
    case "PENDIENTE_CONFIRMACION_FALTANTES":
      return "bg-orange-100 text-orange-700";
    case "PENDIENTE_CANCELACION":
      return "bg-purple-100 text-purple-700";
    case "CANCELADO":
      return "bg-gray-100 text-gray-700 line-through";
    case "ENTREGA_CONFIRMADA":
      return "bg-teal-100 text-teal-700";
    case "CERRADO":
      return "bg-gray-300 text-gray-800";
    default:
      return "bg-gray-200 text-gray-700";
  }
}

export function EstadoBadge({ estado }) {
  const label = formatEstado(estado);
  const classes = estadoBadgeClasses(estado);
  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${classes}`}>
      {label}
    </span>
  );
}
