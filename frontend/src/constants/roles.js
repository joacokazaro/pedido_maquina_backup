// Roles del sistema (en MAYÚSCULAS, como los normaliza el backend/AuthContext).
//
// "ENCARGADO_EV" es el rename directo del ex-rol "SUPERVISOR": mismas funcionalidades.
// "SUPERVISOR_LIMPIEZA" hereda TODO lo del encargado y además es el único que puede
// cargar las máquinas y vehículos utilizados de un eventual (única diferencia; ver
// `puedeCargarComponentes` en SupervisorEventualDetalle).
// "SUPERVISOR_EV" NO integra este grupo a propósito: no es "el" supervisor asignado de
// UN eventual, sino un rol transversal que opera sobre TODOS (ver ROLES_PEDIDO_TITULAR).
export const ROLES_SUPERVISION = ["ENCARGADO_EV", "SUPERVISOR_LIMPIEZA"];

// Roles que pueden crear/operar pedidos como TITULAR (reciben las máquinas a su nombre):
// los supervisores y, además, el coordinador, que puede pedir a su propio nombre como
// "un supervisor más". Todos ellos pueden ser supervisor asignado de un eventual y crear
// pedidos para los eventuales que tengan asignados.
// "SUPERVISOR_EV" se suma acá (y no a ROLES_SUPERVISION) para heredar la plomería de
// titular de pedido, pero con permisos ampliados a CUALQUIER eventual (bypasses puntuales
// en el backend, ver eventuales.service.js y pedidos.controller.js).
export const ROLES_PEDIDO_TITULAR = [...ROLES_SUPERVISION, "COORDINADOR", "SUPERVISOR_EV"];

// Etiquetas legibles para los ABM de usuarios y pantallas que muestren el rol.
export const ROLE_LABELS = {
  ADMIN: "Admin",
  COORDINADOR: "Coordinador",
  CONSULTOR: "Consultor",
  TALLER: "Taller",
  DEPOSITO: "Depósito",
  ENCARGADO_EV: "Encargado EV",
  SUPERVISOR_LIMPIEZA: "Supervisor Limpieza",
  SUPERVISOR_EV: "Supervisor Espacios Verdes",
};

export function roleLabel(role) {
  const key = String(role || "").toUpperCase();
  return ROLE_LABELS[key] || key;
}
